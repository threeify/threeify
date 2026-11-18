import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOption, textOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create [assetReference]',
  describe: 'Create a comment on an asset by path',
  builder: (yargs) =>
    withAssetInput(yargs).options({
      ...getOrgOption(),
      ...getProjectOption(),
      ...textOption,
      ...formatOption,
    }),
  handler: async (argv) => {
    const { assetName } = resolveAssetInput(argv);
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const comment = await sdk.createComment(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
        assetName,
      },
      body: { text: argv.text },
    });
    logOutput(comment, argv.format, deps.logger);
  },
});
