import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'get [assetReference]',
  describe: 'Get asset details',
  builder: (yargs) =>
    withAssetInput(yargs, { version: 'read' }).options({
      ...getOrgOption(),
      ...getProjectOption(),
      ...formatOption,
    }),
  handler: async (argv) => {
    const { assetName, version: requestedVersion } = resolveAssetInput(argv, { version: 'read' });
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const asset = await sdk.getAsset(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
        assetName: sdk.formatAssetReference(assetName, requestedVersion),
      },
    });

    logOutput(asset, argv.format, deps.logger);
  },
});
