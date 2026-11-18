import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ApiClient, Enums } from '@threeify/sdk';
import {
  createAsset,
  FileFormat,
  getAssetTypeFromFileFormat,
  getFileFormatInfoFromFileName,
  uploadFile,
} from '@threeify/sdk';

export type CreateAssetFromUploadOptions = {
  orgName: string;
  projectName: string;
  filePath: string;
  assetName?: string;
  description?: string;
  visibility?: Enums.AssetVisibility;
  shareLicense?: Enums.ShareLicense;
  assetType?: Enums.AssetType;
  metadata?: string;
  version?: string;
};

/**
 * Upload a file and create an asset
 */
export async function createAssetFromUpload(client: ApiClient, options: CreateAssetFromUploadOptions): Promise<void> {
  const filename = basename(options.filePath);
  const fileData = await readFile(options.filePath);
  const fileFormatInfo = getFileFormatInfoFromFileName(filename, FileFormat);
  const inferredAssetType = fileFormatInfo ? getAssetTypeFromFileFormat(fileFormatInfo.format) : undefined;

  // Upload file (infers MIME type and uploads)
  const uploadToken = await uploadFile(client, {
    params: {
      orgName: options.orgName,
      projectName: options.projectName,
    },
    fileData,
    filename,
  });

  // Create asset
  await createAsset(client, {
    params: {
      orgName: options.orgName,
      projectName: options.projectName,
    },
    body: {
      name: options.assetName || filename,
      description: options.description,
      type: options.assetType || inferredAssetType || 'MODEL',
      uploadToken,
      visibility: options.visibility || 'PUBLIC',
      shareLicense: options.shareLicense || 'CC_BY',
      metadata: options.metadata,
      version: options.version,
    },
  });
}
