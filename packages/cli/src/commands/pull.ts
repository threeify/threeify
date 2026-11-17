import pLimit from 'p-limit';
import { relativeAssetPath } from '@landofassets/runtime/node';
import { defineCommand } from 'yargs-file-commands';
import { ignoreLocalAssets, loadProject, resolveProject, saveProject } from '../lib/asset-manager/project.ts';
import { pullAsset, registerProject, storePath } from '../lib/asset-manager/store.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'pull',
  aliases: ['install'],
  describe: 'Pull locked native assets and direct URLs locally; leave file: references live',
  builder: (yargs) =>
    yargs.options({
      parallel: { type: 'number', default: 4, description: 'Number of concurrent asset downloads' },
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
    if (!argv.frozenLockfile) await saveProject(project, lock);
    const entries = Object.values(lock.importers).flatMap((importer) => Object.values(importer.assets));
    const store = storePath();
    if (entries.some((entry) => entry.kind === 'loa')) await registerProject(store, project.root);
    await ignoreLocalAssets(project.root);
    const limit = pLimit(argv.parallel);
    // Different aliases may share one source. Avoid duplicate downloads/materializations within this pull.
    const unique = [
      ...new Map(
        entries.map((entry) => [entry.kind === 'file' ? `file:${entry.path}` : relativeAssetPath(entry), entry]),
      ).values(),
    ];
    const results = await Promise.allSettled(
      unique.map((entry) => limit(() => pullAsset(entry, project.root, store, argv.refresh))),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    deps.logger.info('Assets are available locally');
  },
});
