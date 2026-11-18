import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { descriptionOption, formatOption, getOrgOption, getVisibilityRequiredOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create',
  describe: 'Create a new organization',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...descriptionOption,
      ...getVisibilityRequiredOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const org = await sdk.createOrg(client, {
      body: {
        name: argv.org,
        description: argv.description,
        visibility: argv.visibility,
      },
    });

    logOutput(org, argv.format, deps.logger);
  },
});
