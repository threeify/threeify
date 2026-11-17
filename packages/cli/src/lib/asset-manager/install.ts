import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetInstallPaths, assetSourceKey, relativeAssetPath, type LockedAsset } from '@landofassets/runtime/node';
import { atomicWrite, ignoreLocalAssets, resolveProject, saveProject, type Project } from './project.ts';
import {
  cacheNativeAsset,
  materialize,
  installCachedAsset,
  prepareAssetDirectories,
  pullAsset,
  registerProject,
  storePath,
} from './store.ts';
import { runTaskQueue } from './task-queue.ts';
import { requiredAssetTree, scanAssetTree, planAssetPrune, removeLocalEntry } from './local-tree.ts';
import type { Logger } from '../logger.ts';

export async function installProject(
  project: Project,
  host: string,
  logger: Pick<Logger, 'info'>,
  options: { parallel?: number; frozen?: boolean; refresh?: boolean; changedManifests?: string[] } = {},
): Promise<void> {
  const { parallel = 8, frozen = false, refresh = false } = options;
  if (!Number.isInteger(parallel) || parallel < 1) throw new Error('--parallel must be a positive integer');
  const store = storePath();
  const cached = new Map<string, Promise<string>>();
  let paths: ReturnType<typeof assetInstallPaths> = new Map();
  let total = 0;
  let completed = 0;
  let resolving = true;
  const started = performance.now();
  const interactive = process.stderr.isTTY;
  let downloaded = 0;
  let lastProgress = 0;
  const progress = (force = false) => {
    const now = performance.now();
    if (interactive && (force || now - lastProgress >= 100)) {
      const status = resolving ? 'Resolving assets' : `Installing assets: ${completed}/${total}`;
      process.stderr.write(`\r\x1b[2K${status}, ${(downloaded / 1048576).toFixed(1)} MiB downloaded`);
      lastProgress = now;
    }
  };
  const onBytes = (count: number) => {
    downloaded += count;
    progress();
  };
  const urlReceipt = join(project.root, 'assets', '.loa-urls.json');
  progress(true);
  try {
    await runTaskQueue(parallel, async (schedule) => {
      const lock = await resolveProject(project, host, {
        frozen: frozen,
        schedule,
        onResolved(entry) {
          // Metadata jobs add downloads to the same FIFO queue, then release their slot.
          if (entry.kind === 'loa' && !cached.has(entry.hash))
            cached.set(
              entry.hash,
              schedule(() => cacheNativeAsset(entry, store, onBytes)),
            );
        },
      });
      // Validate all public paths before writing project assets. Native downloads can
      // already be running in the global cache while the last metadata requests finish.
      paths = assetInstallPaths(lock);
      const layout = await requiredAssetTree(project.root, lock, paths.keys(), store);
      const snapshot = await schedule(() => scanAssetTree(project.root, layout));
      const prune = planAssetPrune(snapshot, layout);
      // Obsolete entries blocking a new file/directory shape must go before local writes.
      await Promise.all(prune.before.map((entry) => schedule(() => removeLocalEntry(project.root, entry))));
      await prepareAssetDirectories(project.root, paths.keys());
      if (!frozen) await saveProject(project, lock, options.changedManifests);
      if (cached.size) await registerProject(store, project.root);
      await ignoreLocalAssets(project.root);
      const sources = new Map<
        string,
        { entry: Exclude<LockedAsset, { kind: 'file' }>; path: string; aliases: string[] }
      >();
      for (const [path, entry] of paths) {
        const key = assetSourceKey(entry);
        const existing = sources.get(key);
        if (existing) {
          existing.aliases.push(path);
          if (path === relativeAssetPath(entry)) existing.path = path;
        } else sources.set(key, { entry, path, aliases: [path] });
      }
      let installedUrls: Record<string, string> = {};
      if ([...sources.values()].some(({ entry }) => entry.kind === 'url')) {
        try {
          installedUrls = JSON.parse(await readFile(urlReceipt, 'utf8')) as Record<string, string>;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      resolving = false;
      total = sources.size;
      progress(true);
      for (const { entry, path, aliases } of sources.values()) {
        void schedule(async () => {
          const source = entry.kind === 'loa' ? await cached.get(entry.hash)! : join(project.root, path);
          if (entry.kind === 'loa') await installCachedAsset(source, join(project.root, path));
          else await pullAsset(entry, project.root, store, refresh || installedUrls[path] !== entry.url, onBytes, path);
          completed++;
          progress(true);
          for (const alias of aliases) {
            if (alias === path) continue;
            // Native aliases all target the cache directly. Unverified URLs use local copies.
            void schedule(() =>
              entry.kind === 'loa'
                ? installCachedAsset(source, join(project.root, alias))
                : materialize(source, join(project.root, alias)),
            );
          }
        });
      }
      for (const entry of prune.parallel) void schedule(() => removeLocalEntry(project.root, entry));
    });
  } finally {
    if (interactive) process.stderr.write('\n');
  }
  if ([...paths.values()].some((entry) => entry.kind === 'url')) {
    const urls = Object.fromEntries(
      [...paths]
        .filter(([, entry]) => entry.kind === 'url')
        .map(([path, entry]) => [path, entry.kind === 'url' ? entry.url : '']),
    );
    await atomicWrite(urlReceipt, JSON.stringify(urls, null, 2) + '\n');
  }
  logger.info(
    `Assets are available locally (${completed} ${completed === 1 ? 'source' : 'sources'}, ${(downloaded / 1048576).toFixed(1)} MiB downloaded, ${((performance.now() - started) / 1000).toFixed(1)}s)`,
  );
}
