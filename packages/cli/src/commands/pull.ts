import pLimit from 'p-limit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetInstallPaths, assetSourceKey, relativeAssetPath } from '@landofassets/runtime/node';
import { defineCommand } from 'yargs-file-commands';
import {
  atomicWrite,
  ignoreLocalAssets,
  loadProject,
  resolveProject,
  saveProject,
} from '../lib/asset-manager/project.ts';
import {
  installAlias,
  prepareAssetDirectories,
  pullAsset,
  registerProject,
  storePath,
} from '../lib/asset-manager/store.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'pull',
  aliases: ['install'],
  describe: 'Pull locked native assets and direct URLs locally; leave file: references live',
  builder: (yargs) =>
    yargs.options({
      parallel: { type: 'number', default: 8, description: 'Number of concurrent asset downloads' },
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
    const lock = await resolveProject(project, (await getConfig(deps)).host, { frozen: argv.frozenLockfile });
    const paths = assetInstallPaths(lock);
    await prepareAssetDirectories(project.root, paths.keys());
    if (!argv.frozenLockfile) await saveProject(project, lock);
    const entries = Object.values(lock.importers).flatMap((importer) => Object.values(importer.assets));
    const store = storePath();
    if (entries.some((entry) => entry.kind === 'loa')) await registerProject(store, project.root);
    await ignoreLocalAssets(project.root);
    const limit = pLimit(argv.parallel);
    // Prefer the canonical binding as the real local file. Other bindings of that selection link to it.
    const sources = new Map<string, { entry: (typeof entries)[number]; path: string }>();
    for (const [path, entry] of paths) {
      const key = assetSourceKey(entry);
      if (!sources.has(key) || path === relativeAssetPath(entry)) sources.set(key, { entry, path });
    }
    const unique = [...sources.values()];
    // URLs have no content hash. Remember which URL owns each public file so changing a source refreshes it.
    const urlReceipt = join(project.root, 'assets', '.loa-urls.json');
    let installedUrls: Record<string, string> = {};
    if (unique.some(({ entry }) => entry.kind === 'url')) {
      try {
        installedUrls = JSON.parse(await readFile(urlReceipt, 'utf8')) as Record<string, string>;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    let completed = 0;
    const started = performance.now();
    const interactive = process.stderr.isTTY;
    let downloaded = 0;
    let lastProgress = 0;
    const progress = (force = false) => {
      const now = performance.now();
      if (interactive && (force || now - lastProgress >= 100)) {
        process.stderr.write(
          `\r\x1b[2KInstalling assets: ${completed}/${unique.length}, ${(downloaded / 1048576).toFixed(1)} MiB downloaded`,
        );
        lastProgress = now;
      }
    };
    const onBytes = (count: number) => {
      downloaded += count;
      progress();
    };
    progress(true);
    const results = await Promise.allSettled(
      unique.map(({ entry, path }) =>
        limit(async () => {
          await pullAsset(
            entry,
            project.root,
            store,
            argv.refresh || (entry.kind === 'url' && installedUrls[path] !== entry.url),
            onBytes,
            path,
          );
          completed++;
          progress(true);
        }),
      ),
    );
    if (interactive) process.stderr.write('\n');
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    for (const [path, entry] of paths) {
      await installAlias(project.root, path.slice('assets/'.length), entry, sources.get(assetSourceKey(entry))!.path);
    }
    if (unique.some(({ entry }) => entry.kind === 'url')) {
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
