import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import {
  descriptionOption,
  getAssetVisibilityRequiredOption,
  getLicenseOption,
  getOrgOption,
  getProjectOption,
  metadataOption,
} from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { createAssetFromUpload } from '../../lib/upload.ts';
export const command = defineCommand({
  command: 'create [assetReference]',
  describe: 'Create a new asset from a file',
  builder: (yargs) =>
    withAssetInput(yargs, { version: 'exact', required: false }).options({
      file: {
        alias: 'f',
        type: 'string',
        description: 'Path to file to upload',
        demandOption: true,
      },
      type: {
        type: 'string',
        choices: sdk.Enums.AssetType,
        description: 'Asset type (inferred from file extension when omitted; .ies creates LIGHT)',
      },
      ...getAssetVisibilityRequiredOption(),
      ...getLicenseOption(),
      ...getOrgOption(),
      ...getProjectOption(),
      ...descriptionOption,
      ...metadataOption,
    }),
  handler: async (argv) => {
    const { assetName, version } = resolveAssetInput(argv, { version: 'exact', required: false });
    const orgName = argv.org;
    const projectName = argv.project;

    const client = await createClient(getCliDeps(argv));

    await createAssetFromUpload(client, {
      orgName,
      projectName,
      filePath: argv.file,
      assetName,
      description: argv.description,
      assetType: argv.type,
      visibility: argv.visibility,
      shareLicense: argv.license,
      metadata: argv.metadata,
      version,
    });
  },
});
