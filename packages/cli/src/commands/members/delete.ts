import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete <userName>',
  describe: 'Delete member',
  builder: (yargs) =>
    yargs
      .positional('userName', {
        type: 'string',
        description: 'User name',
        demandOption: true,
      })
      .options({
        ...getOrgOption(),
        ...getProjectOptionalOption(),
      }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    await sdk.deleteMember(client, {
      query: {
        userName: argv.userName,
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
    });
  },
});
