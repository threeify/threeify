import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete <webhookId>',
  describe: 'Delete a webhook',
  builder: (yargs) =>
    yargs
      .positional('webhookId', {
        type: 'number',
        description: 'ID of the webhook to delete',
        demandOption: true,
      })
      .options({
        ...getOrgOption(),
        ...getProjectOptionalOption(),
      }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));

    await sdk.deleteWebhook(client, {
      params: { webhookId: argv.webhookId },
    });
  },
});
