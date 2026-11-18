import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'list',
  describe: 'List assets',
  builder: (yargs) =>
    yargs.options({
      type: {
        type: 'string',
        choices: sdk.Enums.AssetType,
        description: 'Filter by asset type',
      },
      visibility: {
        type: 'string',
        choices: sdk.Enums.AssetVisibility,
        description: 'Filter by visibility',
      },
      search: {
        type: 'string',
        description: 'Search text',
      },
      'page-offset': {
        type: 'number',
        description: 'Page offset for pagination',
        default: 0,
      },
      'page-size': {
        type: 'number',
        description: 'Page size for pagination',
        default: 20,
      },
      ...getOrgOption(),
      ...getProjectOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const result = await sdk.listAssets(client, {
      query: {
        orgName: argv.org,
        projectName: argv.project,
        type: argv.type,
        visibility: argv.visibility,
        searchText: argv.search,
        pageOffset: argv['page-offset'],
        pageSize: argv['page-size'],
      },
    });

    logOutput(result, argv.format, deps.logger);
  },
});
