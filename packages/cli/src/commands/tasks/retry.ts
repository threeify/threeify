import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'retry <task-id>',
  describe: 'Retry a task by re-queuing it for execution',
  builder: (yargs) =>
    yargs
      .positional('task-id', { type: 'number', demandOption: true, description: 'Positive integer task ID' })
      .options({ ...getOrgOption(), ...getProjectOption(), ...formatOption })
      .check((argv) => {
        if (!Number.isSafeInteger(argv['task-id']) || argv['task-id'] <= 0) {
          throw new Error('task-id must be a positive safe integer');
        }
        return true;
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const result = await sdk.resubmitTask(client, {
      params: { orgName: argv.org, projectName: argv.project, taskId: argv['task-id'] },
    });
    logOutput(result, argv.format, deps.logger);
  },
});
