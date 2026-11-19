import { defineCommand } from 'yargs-file-commands';
import { installProject } from '../lib/asset-manager/install.ts';
import { loadProject } from '../lib/asset-manager/project.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'pull',
  aliases: ['install'],
  describe:
    'Pull locked native assets and direct URLs locally; skip remoteDependencies and leave file: references live',
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
    await installProject(await loadProject(), (await getConfig(deps)).host, deps.logger, {
      parallel: argv.parallel,
      frozen: argv.frozenLockfile,
      refresh: argv.refresh,
    });
  },
});
