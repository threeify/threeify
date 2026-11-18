import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption, paginationOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'list',
  describe: 'List tasks for a project',
  builder: (yargs) =>
    yargs
      .options({
        ...getOrgOption(),
        ...getProjectOption(),
        ...paginationOption,
        ...formatOption,
        'sort-by': {
          type: 'string',
          choices: sdk.listTasksSortFields,
          default: 'createdAt' as const,
          description: 'Field to sort by',
        },
        'sort-dir': {
          type: 'string',
          choices: ['asc', 'desc'] as const,
          default: 'desc' as const,
          description: 'Sort direction',
        },
      })
      .check((argv) => {
        sdk.listTasksQuerySchema.parse({ pageOffset: argv['page-offset'], pageSize: argv['page-size'] });
        return true;
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const result = await sdk.listTasks(client, {
      params: { orgName: argv.org, projectName: argv.project },
      query: {
        pageOffset: argv['page-offset'],
        pageSize: argv['page-size'],
        sortBy: argv['sort-by'],
        sortDir: argv['sort-dir'],
      },
    });
    logOutput(result, argv.format, deps.logger);
  },
});
