import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'mark-all-read',
  describe: 'Mark all notifications as read',
  builder: (yargs) => yargs,
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    await sdk.markAllNotificationsAsRead(client, {
      body: { status: 'READ' },
    });
  },
});
