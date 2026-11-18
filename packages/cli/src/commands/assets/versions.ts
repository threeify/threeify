import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import { logOutput } from '../../lib/output.ts';
import { formatOption } from '../../lib/args.ts';
import { listAssetVersions } from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
export const command = defineCommand({
  command: 'versions [assetReference]',
  describe: 'List asset versions in descending version order',
  builder: (yargs) =>
    withAssetInput(yargs).options({
      ...formatOption,
      ...getOrgOption(),
      ...getProjectOption(),
    }),
  handler: async (argv) => {
    const { assetName } = resolveAssetInput(argv);
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const versions = await listAssetVersions(client, {
      params: { orgName: argv.org, projectName: argv.project, assetName },
    });
    logOutput(versions, argv.format, deps.logger);
  },
});
