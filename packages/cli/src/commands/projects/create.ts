import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import {
  descriptionOption,
  formatOption,
  getOrgOption,
  getProjectOption,
  getVisibilityRequiredOption,
} from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create',
  describe: 'Create a new project',
  builder: (yargs) =>
    yargs.options({
      ...getOrgOption(),
      ...getProjectOption(),
      ...descriptionOption,
      ...getVisibilityRequiredOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const project = await sdk.createProject(client, {
      params: { orgName: argv.org },
      body: {
        name: argv.project,
        description: argv.description,
        visibility: argv.visibility,
      },
    });

    logOutput(project, argv.format, deps.logger);
  },
});
