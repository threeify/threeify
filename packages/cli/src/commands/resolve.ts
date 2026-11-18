import { join, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { applyLocalOverrides, buildResolution, nativeHashHex, relativeAssetPath } from '@threeify/runtime/node';
import { defineCommand } from 'yargs-file-commands';
import { atomicWrite, loadProject, resolveProject } from '../lib/asset-manager/project.ts';
import { getConfig } from '../lib/config.ts';
import { getCliDeps } from '../lib/deps.ts';
import { hashFileSha256 } from '../lib/hash.ts';

export const command = defineCommand({
  command: 'resolve',
  describe: 'Generate a runtime URL map, preferring locally pulled files',
  builder: (yargs) =>
    yargs.options({
      mode: {
        type: 'string',
        choices: ['auto', 'remote', 'local'] as const,
        default: 'auto' as const,
        description: 'Prefer locally pulled files when present, or force remote/local URLs',
      },
      output: { type: 'string', description: 'Output JSON file (default: asset-resolution.json at workspace root)' },
      'base-url': { type: 'string', default: '/', description: 'Public URL prefix used for local assets' },
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const project = await loadProject();
    const lock = applyLocalOverrides(
      await resolveProject(project, (await getConfig(deps)).host, { frozen: true }),
      project.root,
    );
    const map = buildResolution(lock, { mode: argv.mode === 'auto' ? 'remote' : argv.mode, baseUrl: argv.baseUrl });
    if (argv.mode === 'auto') {
      const local = buildResolution(lock, { mode: 'local', baseUrl: argv.baseUrl });
      for (const importer of Object.values(lock.importers))
        for (const [alias, entry] of Object.entries(importer.assets)) {
          if (entry.kind === 'file') continue;
          const path = join(project.root, relativeAssetPath(entry, alias));
          try {
            if (!(await stat(path)).isFile()) continue;
          } catch (error) {
            if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) continue;
            throw error;
          }
          if (entry.kind === 'loa' && (await hashFileSha256(path)) !== nativeHashHex(entry.hash)) {
            throw new Error(`Local asset integrity mismatch: ${path}; run threeify pull to repair it`);
          }
          map[alias] = local[alias]!;
        }
    }
    const output = argv.output ? resolve(argv.output) : join(project.root, 'asset-resolution.json');
    await atomicWrite(output, JSON.stringify(map, null, 2) + '\n');
    deps.logger.info(`Wrote ${output}`);
  },
});
