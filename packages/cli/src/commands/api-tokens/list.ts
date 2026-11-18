import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';
export const command = defineCommand({
  command: 'list',
  describe: 'List API tokens',
  builder: (yargs) =>
    yargs.options({
      type: {
        type: 'string',
        choices: sdk.Enums.ApiTokenType,
        description: 'Filter by token type',
      },
      ...getOrgOption(),
      ...getProjectOptionalOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const result = await sdk.listAPITokens(client, {
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
        tokenType: argv.type,
      },
    });
    logOutput(result, argv.format, deps.logger);
  },
});
