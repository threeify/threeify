import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'get <userName>',
  describe: 'Get user details',
  builder: (yargs) =>
    yargs
      .positional('userName', {
        type: 'string',
        description: 'User name',
        demandOption: true,
      })
      .options({
        ...formatOption,
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const user = await sdk.getUser(client, {
      params: { userName: argv.userName },
    });
    logOutput(user, argv.format, deps.logger);
  },
});
