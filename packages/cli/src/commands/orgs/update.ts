import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { descriptionOption, formatOption, getOrgOption, getVisibilityOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'update',
  describe: 'Update organization',
  builder: (yargs) =>
    yargs.options({
      newName: {
        type: 'string',
        description: 'New organization name',
      },
      ...getOrgOption(),
      ...descriptionOption,
      ...getVisibilityOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const org = await sdk.updateOrg(client, {
      params: { orgName: argv.org },
      body: {
        name: argv.newName,
        description: argv.description,
        visibility: argv.visibility,
      },
    });

    logOutput(org, argv.format, deps.logger);
  },
});
