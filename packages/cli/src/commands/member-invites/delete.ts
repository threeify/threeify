import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete <memberInviteId>',
  describe: 'Delete a member invite',
  builder: (yargs) =>
    yargs.positional('memberInviteId', {
      type: 'number',
      description: 'ID of the member invite to delete',
      demandOption: true,
    }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    await sdk.deleteMemberInvite(client, {
      params: { memberInviteId: argv.memberInviteId },
    });
  },
});
