import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import {
  descriptionOption,
  formatOption,
  getOrgOption,
  getProjectOption,
  getVisibilityOption,
} from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'update',
  describe: 'Update project',
  builder: (yargs) =>
    yargs.options({
      newName: {
        type: 'string',
        description: 'New project name',
      },
      ...getOrgOption(),
      ...getProjectOption(),
      ...descriptionOption,
      ...getVisibilityOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const project = await sdk.updateProject(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
      },
      body: {
        name: argv.newName,
        description: argv.description,
        visibility: argv.visibility,
      },
    });

    logOutput(project, argv.format, deps.logger);
  },
});
