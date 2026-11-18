import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create <serviceAccount>',
  describe: 'Create service account',
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
        ...formatOption,
        role: {
          type: 'string',
          choices: ['ADMIN', 'MEMBER', 'VIEWER'],
          default: 'MEMBER',
          description: 'Role for the service account',
        },
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const account = await sdk.createServiceAccount(client, {
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
      body: {
        name: argv.serviceAccount,
        role: argv.role as 'ADMIN' | 'MEMBER' | 'VIEWER',
      },
    });
    logOutput(account, argv.format, deps.logger);
  },
});
