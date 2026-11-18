import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'get',
  describe: 'Get organization details',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const org = await sdk.getOrg(client, {
      params: { orgName: argv.org },
    });

    logOutput(org, argv.format, deps.logger);
  },
});
