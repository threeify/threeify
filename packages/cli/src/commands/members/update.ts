import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'update <userName>',
  describe: 'Update member role',
  builder: (yargs) =>
    yargs
      .positional('userName', {
        type: 'string',
        description: 'User name',
        demandOption: true,
      })
      .options({
        role: {
          type: 'string',
          choices: sdk.Enums.MemberRole,
          description: 'Member role',
          demandOption: true,
        },
        ...getOrgOption(),
        ...getProjectOptionalOption(),
        ...formatOption,
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const member = await sdk.updateMember(client, {
      query: {
        userName: argv.userName,
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
      body: {
        role: argv.role,
      },
    });
    logOutput(member, argv.format, deps.logger);
  },
});
