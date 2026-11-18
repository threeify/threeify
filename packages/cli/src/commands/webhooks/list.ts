import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'list',
  describe: 'List webhooks for an organization or project',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...getProjectOptionalOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const query = argv.project ? { orgName: argv.org, projectName: argv.project } : { orgName: argv.org };

    const result = await sdk.listWebhooks(client, { query });

    logOutput(result, argv.format, deps.logger);
  },
});
