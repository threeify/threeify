import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete <serviceAccount>',
  describe: 'Delete service account',
  builder: (yargs) =>
    yargs
      .positional('serviceAccount', {
        type: 'string',
        description: 'Service account name',
        demandOption: true,
      })
      .options({
        ...getOrgOption(),
        ...getProjectOptionalOption(),
      }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    await sdk.deleteServiceAccount(client, {
      params: { serviceAccountName: argv.serviceAccount },
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
    });
  },
});
