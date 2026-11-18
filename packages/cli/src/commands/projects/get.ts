import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'get',
  describe: 'Get project details',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...getProjectOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const project = await sdk.getProject(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
      },
    });

    logOutput(project, argv.format, deps.logger);
  },
});
