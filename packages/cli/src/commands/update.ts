import { defineCommand } from 'yargs-file-commands';
import { loadProject, registry, resolveProject, saveProject } from '../lib/asset-manager/project.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'update [alias]',
  describe: 'Re-resolve native assets within their selectors, or rewrite pins with --latest',
  builder: (yargs) =>
    yargs
      .positional('alias', { type: 'string', description: 'Alias to update (all native assets when omitted)' })
      .option('latest', {
        type: 'boolean',
        default: false,
        description: 'Select the latest version and replace the manifest pin',
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const project = await loadProject();
    const host = (await getConfig(deps)).host;
    const previous = await resolveProject(project, host);
    project.lock = previous;
    const update = new Set<string>();
    const changed = new Set<string>();
    let found = argv.alias === undefined;
    for (const [key, importer] of Object.entries(previous.importers)) {
      for (const [alias, entry] of Object.entries(importer.assets)) {
        if (argv.alias !== undefined && argv.alias !== alias) continue;
        found = true;
        if (entry.kind !== 'loa') continue;
        update.add(alias);
        if (argv.latest) {
          const latest = await registry.resolve(entry.host, entry.ref, 'latest');
          const specifier = `${entry.ref}@${latest.version}`;
          const current = project.manifests[key]!.assets[alias]!;
          project.manifests[key]!.assets[alias] =
            alias === entry.ref && !current.includes('/') ? latest.version : specifier;
          importer.assets[alias] = { ...entry, ...latest, specifier };
          update.delete(alias);
          changed.add(key);
        }
      }
    }
    if (!found) throw new Error(`Unknown asset alias: ${argv.alias}`);
    const lock = await resolveProject(project, host, { update });
    await saveProject(project, lock, [...changed]);
    deps.logger.info('Updated assets-lock.json');
  },
});
