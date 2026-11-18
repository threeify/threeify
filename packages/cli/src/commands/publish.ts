import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  assetVersionSchema,
  createAsset,
  createAssetVersion,
  getAsset,
  getAssetTypeFromFileFormat,
  getFileFormatInfoFromFileName,
  FileFormat,
  uploadFile,
} from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { parseRef } from '../lib/asset-manager/project.ts';
import { createClient } from '../lib/client.ts';
import { getCliDeps } from '../lib/deps.ts';
import { getLicenseOption } from '../lib/args.ts';

export const command = defineCommand({
  command: 'publish <file>',
  describe: 'Publish a public immutable version; the web service validates self-contained resources',
  builder: (yargs) =>
    yargs
      .version(false)
      .positional('file', { type: 'string', demandOption: true, description: 'File to publish' })
      .options({
        to: { type: 'string', demandOption: true, description: 'Canonical org/project/asset ref' },
        version: { type: 'string', demandOption: true, description: 'Exact major.minor.patch version' },
        description: { type: 'string', description: 'Asset description or version release notes' },
        ...getLicenseOption(),
      }),
  handler: async (argv) => {
    assetVersionSchema.parse(argv.version);
    const { ref, selector } = parseRef(argv.to);
    if (selector) throw new Error('Use --version to specify the published version');
    const [orgName, projectName, assetName] = ref.split('/') as [string, string, string];
    const client = await createClient(getCliDeps(argv));
    let exists = false;
    try {
      const existing = await getAsset(client, { params: { orgName, projectName, assetName } });
      if (existing.visibility !== 'PUBLIC') throw new Error('Asset manager publication requires a public asset');
      exists = true;
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
    }
    // Packaging and resource validation deliberately remain in the web service.
    const uploadToken = await uploadFile(client, {
      params: { orgName, projectName },
      fileData: await readFile(argv.file),
      filename: basename(argv.file),
    });
    if (exists) {
      await createAssetVersion(client, {
        params: { orgName, projectName, assetName },
        body: { uploadToken, version: argv.version, description: argv.description },
      });
    } else {
      const info = getFileFormatInfoFromFileName(basename(argv.file), FileFormat);
      const type = info ? getAssetTypeFromFileFormat(info.format) : undefined;
      if (!type) throw new Error('Cannot infer asset type from file extension');
      await createAsset(client, {
        params: { orgName, projectName },
        body: {
          name: assetName,
          type,
          uploadToken,
          version: argv.version,
          visibility: 'PUBLIC',
          description: argv.description,
          shareLicense: argv.license ?? 'CC_BY',
        },
      });
    }
    getCliDeps(argv).logger.info(`Published ${ref}@${argv.version}`);
  },
});
