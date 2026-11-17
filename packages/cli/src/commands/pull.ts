import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetInstallPaths, assetSourceKey, relativeAssetPath, type LockedAsset } from '@landofassets/runtime/node';
import { defineCommand } from 'yargs-file-commands';
import {
  atomicWrite,
  ignoreLocalAssets,
  loadProject,
  resolveProject,
  saveProject,
} from '../lib/asset-manager/project.ts';
import {
  cacheNativeAsset,
  materialize,
  installAlias,
  prepareAssetDirectories,
  pullAsset,
  registerProject,
  storePath,
} from '../lib/asset-manager/store.ts';
import { runTaskQueue } from '../lib/asset-manager/task-queue.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'pull',
  aliases: ['install'],
  describe: 'Pull locked native assets and direct URLs locally; leave file: references live',
  builder: (yargs) =>
    yargs.options({
      parallel: { type: 'number', default: 8, description: 'Concurrent metadata, download, and installation tasks' },
      'frozen-lockfile': {
        type: 'boolean',
        default: false,
        description: 'Fail if the lockfile is missing or differs from manifests',
      },
      refresh: { type: 'boolean', default: false, description: 'Refresh project-local direct URL downloads' },
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    if (!Number.isInteger(argv.parallel) || argv.parallel < 1) throw new Error('--parallel must be a positive integer');
    const project = await loadProject();
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
      await runTaskQueue(argv.parallel, async (schedule) => {
        const lock = await resolveProject(project, (await getConfig(deps)).host, {
          frozen: argv.frozenLockfile,
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
        await prepareAssetDirectories(project.root, paths.keys());
        if (!argv.frozenLockfile) await saveProject(project, lock);
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
            if (entry.kind === 'loa') await materialize(await cached.get(entry.hash)!, join(project.root, path));
            else
              await pullAsset(
                entry,
                project.root,
                store,
                argv.refresh || installedUrls[path] !== entry.url,
                onBytes,
                path,
              );
            completed++;
            progress(true);
            for (const alias of aliases) {
              if (alias !== path)
                void schedule(() => installAlias(project.root, alias.slice('assets/'.length), entry, path));
            }
          });
        }
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
    deps.logger.info(
      `Assets are available locally (${completed} ${completed === 1 ? 'source' : 'sources'}, ${(downloaded / 1048576).toFixed(1)} MiB downloaded, ${((performance.now() - started) / 1000).toFixed(1)}s)`,
    );
  },
});
