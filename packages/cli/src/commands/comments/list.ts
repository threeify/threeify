import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption, paginationOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'list [assetReference]',
  describe: 'List comments for an asset by path',
  builder: (yargs) =>
    withAssetInput(yargs).options({
      ...getOrgOption(),
      ...getProjectOption(),
      ...paginationOption,
      ...formatOption,
    }),
  handler: async (argv) => {
    const { assetName } = resolveAssetInput(argv);
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const result = await sdk.listComments(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
        assetName,
      },
      query: {
        pageOffset: argv['page-offset'],
        pageSize: argv['page-size'],
      },
    });
    logOutput(result, argv.format, deps.logger);
  },
});
