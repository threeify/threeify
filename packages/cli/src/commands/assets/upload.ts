import { resolveAssetInput, withAssetInput } from '../../lib/asset-input.ts';
import { logOutput } from '../../lib/output.ts';
import { formatOption } from '../../lib/args.ts';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createAssetVersion, uploadFile } from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getOrgOption, getProjectOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
export const command = defineCommand({
  command: 'upload [assetReference]',
  describe: 'Upload a new asset version (defaults to the next major)',
  builder: (yargs) =>
    withAssetInput(yargs, { version: 'exact' }).options({
      file: { type: 'string', demandOption: true, description: 'File to upload' },
      ...formatOption,
      ...getOrgOption(),
      ...getProjectOption(),
    }),
  handler: async (argv) => {
    const { assetName, version } = resolveAssetInput(argv, { version: 'exact' });
    const deps = getCliDeps(argv);
    const client = await createClient(deps);
    const params = { orgName: argv.org, projectName: argv.project, assetName };
    const uploadToken = await uploadFile(client, {
      params: { orgName: argv.org, projectName: argv.project },
      fileData: await readFile(argv.file),
      filename: basename(argv.file),
    });
    const asset = await createAssetVersion(client, { params, body: { uploadToken, version } });
    logOutput(asset, argv.format, deps.logger);
  },
});
