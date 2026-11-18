import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'mark-read <notificationId>',
  describe: 'Mark notification as read',
  builder: (yargs) =>
    yargs.positional('notificationId', {
      type: 'number',
      description: 'Notification ID',
      demandOption: true,
    }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    await sdk.markNotificationAsRead(client, {
      params: { notificationId: argv.notificationId },
      body: { status: 'READ' },
    });
  },
});
