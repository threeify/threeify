import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption, paginationOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'list',
  describe: 'List member invites',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...getProjectOptionalOption(),
      ...paginationOption,
      ...formatOption,
      status: {
        type: 'string',
        choices: sdk.Enums.MemberInviteStatus,
        description: 'Filter by invite status',
      },
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const result = await sdk.listMemberInvites(client, {
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
        pageOffset: argv['page-offset'],
        pageSize: argv['page-size'],
        ...(argv.status ? { status: argv.status } : {}),
      },
    });
    logOutput(result, argv.format, deps.logger);
  },
});
