# @threeify/sdk

<p align="center">
  <a href="https://www.npmjs.com/package/@threeify/sdk"><img src="https://img.shields.io/npm/v/@threeify/sdk.svg" alt="@threeify/sdk version on npm"></a>
  <a href="https://docs.landofassets.com/sdk"><img src="https://img.shields.io/badge/docs-read-blue?style=flat" alt="documentation"></a>
  <a href="https://discord.gg/mrags8WyuH"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat&logo=discord" alt="Discord community"></a>
</p>

Official SDK for the [Threeify](https://threeify.com) REST API.

## Installation

```bash
npm install @threeify/sdk
# or
pnpm add @threeify/sdk
# or
yarn add @threeify/sdk
```

## Quick Start

The SDK uses a **functional approach** - all API operations are exported as standalone functions that take a client instance as their first parameter.

```typescript
import { createSecretTokenInstance, listAssets, getAsset } from '@threeify/sdk';

const orgName = 'my-org';
const projectName = 'my-project';

// Create a client instance (host defaults to https://api.threeify.com)
const client = createSecretTokenInstance({
  secretToken: 'your-api-token',
});

// List assets
const assets = await listAssets(client, {
  query: { orgName, projectName },
});

// Get a specific asset
const asset = await getAsset(client, {
  params: { orgName, projectName, assetName: 'my-asset' },
});
```

## Features

- **Functional API design** - All operations are exported as standalone functions
- Full TypeScript support with complete type definitions
- Zod schema validation for requests and responses
- Axios-based HTTP client with automatic error handling
- Support for all Threeify API endpoints:
  - Assets and asset versions
  - Organizations and projects
  - Users and authentication
  - Comments and notifications
  - File uploads and downloads
  - API tokens and service accounts

## Uploading Assets

The SDK provides a simple helper function for uploading files. Here's a complete example:

```typescript
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createSecretTokenInstance, uploadFile, createAsset } from '@threeify/sdk';

const orgName = 'my-org';
const projectName = 'my-project';

const client = createSecretTokenInstance({
  secretToken: 'your-api-token',
});

// Read the file and extract filename
const fileData = await readFile('model.glb');
const filename = basename('model.glb');

// Upload the file (infers MIME type and uploads)
const uploadToken = await uploadFile(client, {
  params: { orgName, projectName },
  fileData,
  filename,
});

// Create the asset record with the upload token
const asset = await createAsset(client, {
  params: { orgName, projectName },
  body: {
    name: 'My 3D Model',
    description: 'A beautiful 3D model',
    type: 'MODEL',
    uploadToken,
    visibility: 'PUBLIC',
    shareLicense: 'CC_BY',
  },
});
```

The `uploadFile` helper:

- Accepts file data (Buffer or Uint8Array) and filename
- Infers the MIME type from the file extension
- Prepares the upload and gets a signed URL
- Uploads the file to the signed URL
- Returns the upload token for use in `createAsset`

**Note:** In Node.js environments, you'll need to read the file yourself using `readFile` from `node:fs/promises` before calling `uploadFile`. In browser environments, you can pass a `File` object directly to `uploadFileToUploadUrl()` or convert it to an `ArrayBuffer`/`Uint8Array` for `uploadFile`.

For more control, you can use `prepareAssetUpload()` and `uploadFileToUploadUrl()` directly.

IES photometric files use asset type `LIGHT`. Upload a `.ies` file with `uploadFile()` (which infers
`application/ies`) and pass `type: 'LIGHT'` to `createAsset()`. Light assets include an optional typed
`lightInfo` summary with manufacturer and luminaire metadata, peak candela, lamp data, dimensions,
angle counts, and validation warnings. Download the original with `getMediaOriginalUrl()` using
`extension: '.ies'`; request a preview with the existing WebP media format. Filter lights with
`listAssets(client, { query: { type: 'LIGHT' } })`.

## API Reference

### Client Configuration

The SDK provides several client creation functions depending on your authentication method:

```typescript
import {
  createSecretTokenInstance, // For API tokens (most common)
  createFrontendTokenInstance, // For frontend tokens
  createSessionInstance, // For user sessions
  createAnonymousClient, // For anonymous access
} from '@threeify/sdk';

// Most common: API token authentication
// host defaults to 'https://api.threeify.com' if not provided
const client = createSecretTokenInstance({
  secretToken: 'your-api-token',
  // host: 'https://api.threeify.com', // Optional, defaults to production API
});
```

**Note:** For normal users, you typically don't need to specify the `host` parameter as it defaults to `https://api.threeify.com`. Only internal developers may need to override this for testing against different environments.

### Available Functions

The SDK exports functions for all API operations. Here are the main categories:

**Assets:**

- `listAssets()` - List assets in a project
- `getAsset()` - Get asset metadata
- `createAsset()` - Create a new asset
- `updateAsset()` - Update asset metadata
- `deleteAsset()` - Delete an asset
- `uploadFile()` - Upload a file and get upload token (helper function)
- `prepareAssetUpload()` - Get signed upload URL and token
- `uploadFileToUploadUrl()` - Upload file to signed URL

**Organizations:**

- `listOrgs()` - List organizations
- `getOrg()` - Get organization details
- `createOrg()` - Create an organization
- `updateOrg()` - Update organization
- `deleteOrg()` - Delete an organization

**Projects:**

- `listProjects()` - List projects in an organization
- `getProject()` - Get project details
- `createProject()` - Create a project
- `updateProject()` - Update project
- `deleteProject()` - Delete a project

**Other resources:**

- Users, authentication, comments, notifications
- API tokens, service accounts
- Organization members and member invites

All functions follow the pattern: `functionName(client, props)` where `client` is the API client instance and `props` contains the request parameters.

## Zod Schemas

The SDK exports Zod schemas for all API request and response types, enabling runtime validation:

```typescript
import { assetSchema, createAssetBodySchema } from '@threeify/sdk';

// Validate an asset object
const validatedAsset = assetSchema.parse(assetData);

// Validate create asset input
const validatedInput = createAssetBodySchema.parse(createAssetInput);
```

## Requirements

- Node.js >= 22

## License

MIT

## Asset versions

Asset uploads create immutable `major.minor.patch` versions. New assets default to `1.0.0`; `createAssetVersion` defaults to the next major. Supply an unused exact `version` to publish a minor, patch, or older version explicitly. `updateAsset` edits metadata only.

```typescript
const params = { orgName: 'acme', projectName: 'library', assetName: 'chair' };
const published = await createAssetVersion(client, { params, body: { uploadToken, version: '2.1.0' } });
const versions = await listAssetVersions(client, { params });
const selected = await getAsset(client, { params: { ...params, assetName: 'chair@2' } });
const preview = getMediaUrl(client, {
  params: { ...params, assetName: `chair@${selected.version}` },
  format: 'glb',
});
const original = getMediaOriginalUrl(client, {
  params: { ...params, assetName: `chair@${selected.version}` },
  extension: selected.originalExtension,
});
```

Reads accept `@2.1.0`, `@2.1`, `@2`, or `@latest`. Omission means latest. Automatic references select the highest matching numeric version, irrespective of upload time. Each version has `createdByUserId`, `createdByUserName`, and `createdAt`; migrated uploader information may be null. Original files and thumbnails belong to individual versions.

Media URLs use file extensions: `/media/acme/library/chair@2.1.0.glb`, `chair@latest.glb`, or `chair.glb`. Source downloads use their actual extension and `?original=true`, including `.mtlx.zip` for materials. Previous grouped media paths and `/original` paths are removed. Only stable numeric versions are supported initially; custom tags, prereleases, build suffixes, and version ranges are unsupported.

Media helpers accept an optional separate version selector or label:

```ts
const url = getMediaUrl(client, {
  params: { orgName: 'acme', projectName: 'demo', assetName: 'chair', version: '1.2.3' },
  format: 'webp',
});
```

The same `params.version` works for original downloads, conversion task requests, and polling/download helpers. Omit it for the current version. Labels are resolved by the server; accepting a label in the SDK does not create a server-side label mapping. `assetName` must be a bare asset name. Embedded references such as `assetName: 'chair@1.2.3'` are rejected; supply `assetName: 'chair', version: '1.2.3'` instead.
