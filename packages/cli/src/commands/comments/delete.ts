import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'delete <commentId> [assetReference]',
  describe: 'Delete a comment on an asset by path',
  builder: (yargs) =>
    withAssetInput(yargs)
      .options({
        ...getOrgOption(),
        ...getProjectOption(),
      })
      .positional('commentId', {
        type: 'number',
        description: 'Comment ID',
        demandOption: true,
      }),
  handler: async (argv) => {
    const { assetName } = resolveAssetInput(argv);
    const client = await createClient(getCliDeps(argv));
    await sdk.deleteComment(client, {
      params: {
        orgName: argv.org,
        projectName: argv.project,
        assetName,
        commentId: argv.commentId,
      },
    });
  },
});
