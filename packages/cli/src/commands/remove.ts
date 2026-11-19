import { defineCommand } from 'yargs-file-commands';
import { bindings, loadProject } from '../lib/asset-manager/project.ts';
import { installProject } from '../lib/asset-manager/install.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'remove <alias>',
  describe: 'Remove an asset binding and prune obsolete local assets; retain the global cache',
  builder: (yargs) =>
    yargs
      .option('parallel', { type: 'number', default: 8, description: 'Concurrent installation and pruning tasks' })
      .positional('alias', {
        type: 'string',
        demandOption: true,
        description: 'Asset alias in the current manifest',
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const project = await loadProject();
    const binding = bindings(project.manifests[project.current]!).find((item) => item.alias === argv.alias);
    if (!binding) throw new Error(`Unknown alias in current manifest: ${argv.alias}`);
    delete binding.list[argv.alias];
    await installProject(project, (await getConfig(deps)).host, deps.logger, {
      parallel: argv.parallel,
      changedManifests: [project.current],
    });
    deps.logger.info(`Removed ${argv.alias}`);
  },
});
