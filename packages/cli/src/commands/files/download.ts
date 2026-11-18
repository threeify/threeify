import { open, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createAnonymousClient, fileParamsSchema, getFile } from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getConfig } from '../../lib/config.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'download <oid>',
  describe: 'Download a storage file by OID (no authentication required)',
  builder: (yargs) =>
    yargs
      .positional('oid', {
        type: 'string',
        demandOption: true,
        description: 'SHA256 file OID (64 lowercase hexadecimal characters)',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output file path (defaults to the OID); existing files are not overwritten',
      })
      .check((argv) => {
        fileParamsSchema.parse({ oid: argv.oid });
        return true;
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const { host } = await getConfig(deps);
    const client = createAnonymousClient({ host });
    const output = argv.output ?? argv.oid;
    const file = await open(output, 'wx');
    try {
      const stream = await getFile(client, { params: { oid: argv.oid } }, 'stream');
      await pipeline(stream, file.createWriteStream());
    } catch (error) {
      await file.close();
      await rm(output, { force: true });
      throw error;
    }
    deps.logger.info(`Downloaded to ${output}`);
  },
});
