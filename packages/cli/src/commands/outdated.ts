import { defineCommand } from 'yargs-file-commands';
import { loadProject, registry, resolveProject } from '../lib/asset-manager/project.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';

export const command = defineCommand({
  command: 'outdated',
  describe: 'List native asset aliases with newer published versions',
  builder: (yargs) => yargs,
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const project = await loadProject();
    const lock = await resolveProject(project, (await getConfig(deps)).host, { frozen: true });
    const rows: { alias: string; current: string; latest: string }[] = [];
    for (const importer of Object.values(lock.importers))
      for (const [alias, entry] of Object.entries(importer.dependencies)) {
        if (entry.kind !== 'loa') continue;
        const latest = await registry.resolve(entry.host, entry.ref, 'latest');
        const currentParts = entry.version.split('.').map(Number);
        const latestParts = latest.version.split('.').map(Number);
        const difference = latestParts.findIndex((part, index) => part !== currentParts[index]);
        if (difference >= 0 && latestParts[difference]! > currentParts[difference]!)
          rows.push({ alias, current: entry.version, latest: latest.version });
      }
    deps.logger.info(
      JSON.stringify(
        rows.toSorted((a, b) => a.alias.localeCompare(b.alias)),
        null,
        2,
      ),
    );
  },
});
