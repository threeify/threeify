import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create <usernameOrEmail>',
  describe: 'Invite a user to an organization or project',
  builder: (yargs) =>
    yargs
      .positional('usernameOrEmail', {
        type: 'string',
        description: 'Username or email of the user to invite',
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
          description: 'Role for the invited member',
        },
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const invite = await sdk.createMemberInvite(client, {
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
      body: {
        usernameOrEmail: argv.usernameOrEmail,
        role: argv.role as 'ADMIN' | 'MEMBER' | 'VIEWER',
      },
    });
    logOutput(invite, argv.format, deps.logger);
  },
});
