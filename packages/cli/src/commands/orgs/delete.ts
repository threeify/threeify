import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete',
  describe: 'Delete organization',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
    }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));

    await sdk.deleteOrg(client, {
      params: { orgName: argv.org },
    });
  },
});
