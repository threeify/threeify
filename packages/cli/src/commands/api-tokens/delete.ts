import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete <token>',
  describe: 'Delete API token',
  builder: (yargs) =>
    yargs
      .positional('token', {
        type: 'string',
        description: 'Token name',
        demandOption: true,
      })
      .options({
        ...getOrgOption(),
        ...getProjectOptionalOption(),
      }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    await sdk.deleteAPIToken(client, {
      params: { apiTokenName: argv.token },
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
    });
  },
});
