import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete',
  describe: 'Delete project',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...getProjectOption(),
    }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));

    await sdk.deleteProject(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
      },
    });
  },
});
