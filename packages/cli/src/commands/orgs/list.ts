import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getVisibilityOption, paginationOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'list',
  describe: 'List organizations',
  builder: (yargs) =>
    yargs.options({
      user: {
        type: 'string',
        description: 'Filter by user name',
      },
      ...getVisibilityOption(),
      ...paginationOption,
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const result = await sdk.listOrgs(client, {
      query: {
        visibility: argv.visibility,
        userName: argv.user,
        pageOffset: argv['page-offset'],
        pageSize: argv['page-size'],
      },
    });

    logOutput(result, argv.format, deps.logger);
  },
});
