import { AxiosError } from 'axios';
import * as z from 'zod';
import type { ApiClient } from '../client.js';
import { parseResult } from '../client.js';
import { buildPath } from '../lib/buildPath.js';
import { Enums } from '../lib/enums.js';
import type { SortingFromFields } from '../lib/list.js';
import { createSortingOptionalSchema, listResultSchema, paginationOptionalSchema } from '../lib/list.js';
import {
  assetNameSchema,
  assetParamsSchema,
  assetReferenceParamsSchema,
  assetVisibilitySchema,
  booleanPropSchema,
  descriptionSchema,
  orgNameSchema,
  projectNameSchema,
  projectParamsSchema,
} from '../lib/schemas.js';
import { assetVersionSchema } from '../lib/semver.js';

/** Summary of a MATERIAL asset's MaterialX document, extracted on upload. */
export const materialInfoSchema = z.object({
  version: z.string().optional(),
  colorspace: z.string().optional(),
  materials: z.array(z.object({ name: z.string().optional(), category: z.string() })),
  nodeGraphCount: z.number().int(),
  topLevelNodeCount: z.number().int(),
  referencedTextures: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type MaterialInfo = z.infer<typeof materialInfoSchema>;

/** Summary of a LIGHT asset's IES photometry, extracted on upload. */
export const lightInfoSchema = z.object({
  version: z.string(),
  metadata: z.record(z.string(), z.string()),
  photometricType: z.number().int().min(1).max(3),
  photometricTypeName: z.enum(['A', 'B', 'C']),
  photometry: z.enum(['absolute', 'relative']),
  manufacturer: z.string(),
  luminaire: z.string(),
  lightSource: z.string(),
  lampCatalog: z.string(),
  lampCount: z.number().int(),
  lumensPerLamp: z.number(),
  inputWatts: z.number(),
  peakCandela: z.number(),
  verticalAngles: z.number().int(),
  horizontalAngles: z.number().int(),
  units: z.enum(['feet', 'meters']),
  dimensions: z.object({ width: z.number(), length: z.number(), height: z.number() }),
  hasTilt: z.boolean(),
  warnings: z.array(z.string()),
});

export type LightInfo = z.infer<typeof lightInfoSchema>;

/** Extracted facts use canonical units; unknown measurements are null, never guessed. */
const analysisCount = z.number().int().nonnegative();
const analysisValue = z.number().nonnegative();
export const assetTextureInfoSchema = z.object({
  id: z.string(),
  path: z.string().nullable(),
  widthPixels: analysisCount.nullable(),
  heightPixels: analysisCount.nullable(),
  format: z.string().nullable(),
  mimeType: z.string().nullable(),
  byteSize: analysisCount.nullable(),
  mipLevelCount: analysisCount.nullable().optional(),
  colorSpace: z.string().nullable().optional(),
  usages: z.array(z.string()).optional(),
});
export type AssetTextureInfo = z.infer<typeof assetTextureInfoSchema>;
export const assetAnalysisDiagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  location: z.string().optional(),
});
export const assetValidationSchema = z.object({
  status: z.enum(['valid', 'invalid', 'unassessed']),
  validator: z.string(),
  validatorVersion: z.string(),
  rules: z.array(z.string()),
  issues: z.array(assetAnalysisDiagnosticSchema),
});
export const modelAnalysisDataSchema = z.object({
  kind: z.literal('model'),
  dimensions: z
    .object({
      widthMeters: analysisValue,
      depthMeters: analysisValue,
      heightMeters: analysisValue,
      unitSource: z.enum(['format-defined', 'declared', 'assumed', 'unknown']),
      measurementBasis: z.string(),
    })
    .nullable(),
  meshCount: analysisCount,
  geometryCount: analysisCount,
  triangleCount: analysisCount,
  vertexCount: analysisCount,
  materialCount: analysisCount,
  textureCount: analysisCount,
  textures: z.array(assetTextureInfoSchema),
});
export const materialAnalysisDataSchema = materialInfoSchema.extend({
  kind: z.literal('material'),
  nodeCount: analysisCount,
  textureCount: analysisCount,
  textures: z.array(assetTextureInfoSchema),
});
export const lightAnalysisDataSchema = lightInfoSchema.extend({
  kind: z.literal('light'),
  luminousFluxLumens: analysisValue.nullable(),
  efficacyLumensPerWatt: analysisValue.nullable(),
  beamAngleDegrees: analysisValue.nullable(),
  fieldAngleDegrees: analysisValue.nullable(),
  declaredLampFluxLumens: analysisValue.nullable().optional(),
  downwardFluxLumens: analysisValue.nullable().optional(),
  upwardFluxLumens: analysisValue.nullable().optional(),
  metricsTiltDegrees: z.number().optional(),
  beamAngles: z
    .array(
      z.object({
        horizontalDegrees: z.number(),
        peakDirectionDegrees: z.number(),
        peakCandela: analysisValue,
        beamAngleDegrees: analysisValue.nullable(),
        fieldAngleDegrees: analysisValue.nullable(),
        beamAngleStatus: z.enum(['ok', 'no-light', 'no-crossing', 'multiple-lobes']),
        fieldAngleStatus: z.enum(['ok', 'no-light', 'no-crossing', 'multiple-lobes']),
      }),
    )
    .optional(),
  metricsStatus: z.enum(['supported', 'unsupported', 'unavailable']),
});
export const envmapAnalysisDataSchema = z.object({
  kind: z.literal('envmap'),
  widthPixels: analysisCount,
  heightPixels: analysisCount,
  format: z.string(),
  colorSpace: z.string(),
  projection: z.enum(['equirectangular', 'unknown']),
  brightnessUnit: z.enum(['relative', 'cd/m2']),
  calibration: z.string().nullable(),
  minimumBrightness: analysisValue,
  maximumBrightness: analysisValue,
  averageBrightness: analysisValue,
  percentile01Brightness: analysisValue,
  percentile99Brightness: analysisValue,
  dynamicRangeStops: analysisValue.nullable(),
});
export const assetAnalysisDataSchema = z.discriminatedUnion('kind', [
  modelAnalysisDataSchema,
  materialAnalysisDataSchema,
  lightAnalysisDataSchema,
  envmapAnalysisDataSchema,
]);
export type AssetAnalysisData = z.infer<typeof assetAnalysisDataSchema>;
export type ModelAnalysisData = z.infer<typeof modelAnalysisDataSchema>;
export type MaterialAnalysisData = z.infer<typeof materialAnalysisDataSchema>;
export type LightAnalysisData = z.infer<typeof lightAnalysisDataSchema>;
export type EnvmapAnalysisData = z.infer<typeof envmapAnalysisDataSchema>;
export const assetAnalysisSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceFileOid: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/),
    analyzerId: z.string().min(1),
    analyzerVersion: z.string().min(1),
    status: z.enum(['pending', 'running', 'succeeded', 'failed', 'unsupported']),
    analyzedAt: z.iso.datetime().nullable(),
    data: assetAnalysisDataSchema.nullable(),
    validation: assetValidationSchema.nullable(),
    diagnostics: z.array(assetAnalysisDiagnosticSchema),
  })
  .superRefine((value, ctx) => {
    const issue = (message: string, path: string[]) => ctx.addIssue({ code: 'custom', message, path });
    if (value.status === 'succeeded' && value.data === null) issue('Successful analysis requires data', ['data']);
    if (value.status === 'pending' || value.status === 'running') {
      if (value.data !== null) issue('Pending or running analysis cannot contain completed data', ['data']);
      if (value.analyzedAt !== null)
        issue('Pending or running analysis cannot have a completion timestamp', ['analyzedAt']);
    } else if (value.analyzedAt === null) {
      issue('Completed analysis requires a completion timestamp', ['analyzedAt']);
    }
    if (value.validation) {
      const hasError = value.validation.issues.some((entry) => entry.severity === 'error');
      if (value.validation.status === 'valid' && hasError)
        issue('Valid results cannot contain validation errors', ['validation', 'status']);
      if (value.validation.status === 'invalid' && !hasError)
        issue('Invalid results require a validation error', ['validation', 'issues']);
    }
    if (value.data?.kind === 'envmap' && value.data.brightnessUnit === 'cd/m2' && !value.data.calibration?.trim())
      issue('Physical brightness units require calibration provenance', ['data', 'calibration']);
  });
export type AssetAnalysis = z.infer<typeof assetAnalysisSchema>;

/** Bounded listing payload: scalar facts only; inventories and diagnostics remain on version details. */
export const assetAnalysisSummaryDataSchema = z.discriminatedUnion('kind', [
  modelAnalysisDataSchema.omit({ textures: true }),
  materialAnalysisDataSchema
    .omit({ textures: true, materials: true, referencedTextures: true, warnings: true })
    .extend({ materialCount: analysisCount }),
  lightAnalysisDataSchema.omit({ metadata: true, warnings: true, beamAngles: true }),
  envmapAnalysisDataSchema,
]);
export type AssetAnalysisSummaryData = z.infer<typeof assetAnalysisSummaryDataSchema>;
export const assetAnalysisSummarySchema = z.object({
  schemaVersion: z.literal(1),
  sourceFileOid: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]+$/),
  analyzerId: z.string().min(1),
  analyzerVersion: z.string().min(1),
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'unsupported']),
  analyzedAt: z.iso.datetime().nullable(),
  validationStatus: z.enum(['valid', 'invalid', 'unassessed']).nullable(),
  errorCount: analysisCount,
  warningCount: analysisCount,
  data: assetAnalysisSummaryDataSchema.nullable(),
});
export type AssetAnalysisSummary = z.infer<typeof assetAnalysisSummarySchema>;

export const assetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(Enums.AssetType),
  visibility: assetVisibilitySchema,
  projectId: z.number().int(),
  projectName: z.string(),
  orgId: z.number().int(),
  orgName: z.string(),
  description: z.string(),
  keywords: z.string(),
  shareLicense: z.enum(Enums.ShareLicense),
  commentMode: z.enum(Enums.CommentMode),
  reported: z.boolean(),
  likeCount: z.int(),
  shareCount: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archived: z.boolean(),
  metadata: z.string().max(10_240),
  originalSize: z.number().int().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  depth: z.number().nullable().optional(),
  version: assetVersionSchema,
  latestVersion: assetVersionSchema,
  versionId: z.number().int(),
  originalExtension: z.string(),
  fileOid: z.string(),
  thumbnailOid: z.string().nullable().optional(),
  analysis: assetAnalysisSchema.nullable().optional(),
  analysisSummary: assetAnalysisSummarySchema.nullable().optional(),
  materialInfo: materialInfoSchema.optional(),
  lightInfo: lightInfoSchema.optional(),
});

export type Asset = z.infer<typeof assetSchema>;

export const listAssetsSortFields = ['createdAt', 'updatedAt', 'name', 'likeCount', 'shareCount'] as const;

export const listAssetsQuerySchema = paginationOptionalSchema
  .merge(createSortingOptionalSchema(listAssetsSortFields))
  .merge(
    z.strictObject({
      visibility: assetVisibilitySchema.optional().describe('Filter by visibility (PUBLIC or PRIVATE)'),
      searchText: z.string().max(256).optional().describe('Search text to filter assets by name or description'),
      type: z.enum(Enums.AssetType).optional().describe('Filter by asset type'),
      userName: z.string().max(100).optional().describe('Filter by username'),
      orgName: orgNameSchema.optional().describe('Filter by organization name'),
      projectName: projectNameSchema.optional().describe('Filter by project name'),
      archived: booleanPropSchema
        .optional()
        .describe('Filter by archived status (true for archived, false for non-archived)'),
    }),
  );

export type ListAssetQuery = z.infer<typeof listAssetsQuerySchema>;

export const listAssetsResultSchema = listResultSchema(assetSchema);

export type ListAssetResult = z.infer<typeof listAssetsResultSchema>;

export const listAssetPropsSchema = z.object({ query: listAssetsQuerySchema }).strict();
export type ListAssetProps = z.infer<typeof listAssetPropsSchema>;

/** @internal */
export const listAssetSortFields = listAssetsSortFields;

/** @internal */
export const listAssetDefaultSort: SortingFromFields<typeof listAssetSortFields> = {
  sortBy: 'createdAt',
  sortDir: 'desc',
};

export type ListAssetSortField = (typeof listAssetSortFields)[number];

/**
 * Lists assets with optional filtering and pagination.
 *
 * @operationId list-assets-in-project
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.query - Query parameters for filtering, pagination, and sorting
 * @returns Promise resolving to a paginated list of assets
 * @example
 * ```typescript
 * const assets = await listAssets(client, {
 *   query: { visibility: 'PUBLIC', pageOffset: 0, pageSize: 20 }
 * });
 * ```
 */
export const listAssets = async (client: ApiClient, props: ListAssetProps): Promise<ListAssetResult> => {
  const { query } = listAssetPropsSchema.parse(props);
  const path = '/assets';
  const response = await client.axios.get(path, {
    params: query,
  });
  return parseResult(client, listAssetsResultSchema, response.data);
};

export const createAssetParamsSchema = projectParamsSchema;

export type CreateAssetParams = z.infer<typeof createAssetParamsSchema>;

export const createAssetBodySchema = z.strictObject({
  version: assetVersionSchema.optional(),
  name: assetNameSchema.describe('The name of the asset'),
  description: descriptionSchema.optional().describe('Optional description of the asset'),
  type: z.enum(Enums.AssetType).describe('The type of asset'),
  uploadToken: z.string().describe('The upload token from prepareAssetUpload'),
  visibility: assetVisibilitySchema.describe('Visibility level: PUBLIC (anyone can view) or PRIVATE (members only)'),
  shareLicense: z.enum(Enums.ShareLicense).describe('The license for sharing the asset'),
  commentMode: z.enum(Enums.CommentMode).optional().describe('Comment mode: ENABLED (default), MEMBERS_ONLY, or NONE'),
  metadata: z.string().max(10_240).optional().describe('Optional metadata as a string (max 10240 characters)'),
});

export type CreateAssetBody = z.infer<typeof createAssetBodySchema>;

export type CreateAssetResult = z.infer<typeof assetSchema>;

export const createAssetPropsSchema = z
  .object({ params: createAssetParamsSchema, body: createAssetBodySchema })
  .strict();
export type CreateAssetProps = z.infer<typeof createAssetPropsSchema>;

/**
 * Creates a new asset in a project.
 *
 * @operationId create-asset
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.params - Path parameters (orgName, projectName)
 * @param props.body - Request body with asset details
 * @returns Promise resolving to the created asset
 * @example
 * ```typescript
 * const asset = await createAsset(client, {
 *   params: { orgName: 'my-org', projectName: 'my-project' },
 *   body: {
 *     name: 'my-asset',
 *     type: 'MODEL',
 *     uploadToken: '...',
 *     visibility: 'PUBLIC',
 *     shareLicense: 'CC_BY'
 *   }
 * });
 * ```
 */
export const createAsset = async (client: ApiClient, props: CreateAssetProps): Promise<CreateAssetResult> => {
  const { params, body } = createAssetPropsSchema.parse(props);
  const path = buildPath('/assets/$orgName/$projectName', params);
  const response = await client.axios.post(path, body);
  return parseResult(client, assetSchema, response.data);
};

export const getAssetParamsSchema = assetReferenceParamsSchema;

export type GetAssetParams = z.infer<typeof getAssetParamsSchema>;

export type GetAssetResult = z.infer<typeof assetSchema>;

export const getAssetPropsSchema = z.object({ params: getAssetParamsSchema }).strict();
export type GetAssetProps = z.infer<typeof getAssetPropsSchema>;

/**
 * Gets asset metadata by org, project, and asset names.
 *
 * @operationId get-asset-metadata
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.params - Path parameters (orgName, projectName, assetName)
 * @returns Promise resolving to the asset metadata
 * @example
 * ```typescript
 * const asset = await getAsset(client, {
 *   params: { orgName: 'my-org', projectName: 'my-project', assetName: 'my-asset' }
 * });
 * ```
 */
export const getAsset = async (client: ApiClient, props: GetAssetProps): Promise<GetAssetResult> => {
  const { params } = getAssetPropsSchema.parse(props);
  const path = buildPath('/assets/$orgName/$projectName/$assetName', params);
  const response = await client.axios.get(path);
  return parseResult(client, assetSchema, response.data);
};

export const assetExists = async (client: ApiClient, props: GetAssetProps): Promise<boolean> => {
  const { params } = getAssetPropsSchema.parse(props);
  const path = buildPath('/assets/$orgName/$projectName/$assetName', params);
  try {
    await client.axios.get(path);
    return true;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return false;
    }
    throw error;
  }
};

export const updateAssetParamsSchema = assetParamsSchema;

export type UpdateAssetParams = z.infer<typeof updateAssetParamsSchema>;

export const updateAssetBodySchema = z.strictObject({
  name: assetNameSchema.optional().describe('Optional name of the asset, to rename asset'),
  description: descriptionSchema.optional().describe('Optional description of the asset'),
  keywords: z.string().max(10_240).optional().describe('Optional keywords of the asset'),
  visibility: assetVisibilitySchema.optional().describe('Optional visibility of the asset'),
  shareLicense: z.enum(Enums.ShareLicense).optional().describe('Optional share license of the asset'),
  commentMode: z.enum(Enums.CommentMode).optional().describe('Optional comment mode: ENABLED, MEMBERS_ONLY, or NONE'),
  projectName: projectNameSchema
    .optional()
    .describe('Optional project name of the asset, to transfer asset to a different project/organization'),
  orgName: orgNameSchema
    .optional()
    .describe('Optional organization name of the asset, to transfer asset to a different project/organization'),
  archived: z.boolean().optional().describe('Optional archived status (true to archive, false to unarchive)'),
  metadata: z.string().max(10_240).optional().describe('Optional metadata as a string (max 10240 characters)'),
});

export type UpdateAssetBody = z.infer<typeof updateAssetBodySchema>;

export type UpdateAssetResult = z.infer<typeof assetSchema>;

export const updateAssetPropsSchema = z
  .object({ params: updateAssetParamsSchema, body: updateAssetBodySchema })
  .strict();
export type UpdateAssetProps = z.infer<typeof updateAssetPropsSchema>;

/**
 * Updates an asset's metadata.
 *
 * @operationId update-asset
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.params - Path parameters (orgName, projectName, assetName)
 * @param props.body - Request body with fields to update
 * @returns Promise resolving to the updated asset
 * @example
 * ```typescript
 * const asset = await updateAsset(client, {
 *   params: { orgName: 'my-org', projectName: 'my-project', assetName: 'my-asset' },
 *   body: { description: 'Updated description' }
 * });
 * ```
 */
export const updateAsset = async (client: ApiClient, props: UpdateAssetProps): Promise<UpdateAssetResult> => {
  const { params, body } = updateAssetPropsSchema.parse(props);
  const path = buildPath('/assets/$orgName/$projectName/$assetName', params);
  const response = await client.axios.patch(path, body);
  return parseResult(client, assetSchema, response.data);
};

export const deleteAssetParamsSchema = assetParamsSchema;

export type DeleteAssetParams = z.infer<typeof deleteAssetParamsSchema>;

export const deleteAssetResultSchema = z.void();

export const deleteAssetPropsSchema = z.object({ params: deleteAssetParamsSchema }).strict();
export type DeleteAssetProps = z.infer<typeof deleteAssetPropsSchema>;

/**
 * Deletes an asset.
 *
 * @operationId delete-asset
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.params - Path parameters (orgName, projectName, assetName)
 * @returns Promise that resolves when the asset is deleted
 * @example
 * ```typescript
 * await deleteAsset(client, {
 *   params: { orgName: 'my-org', projectName: 'my-project', assetName: 'my-asset' }
 * });
 * ```
 */
export const deleteAsset = async (client: ApiClient, props: DeleteAssetProps): Promise<void> => {
  const { params } = deleteAssetPropsSchema.parse(props);
  const path = buildPath('/assets/$orgName/$projectName/$assetName', params);
  await client.axios.delete(path);
};

export const prepareAssetUploadParamsSchema = projectParamsSchema;

export type PrepareAssetUploadParams = z.infer<typeof prepareAssetUploadParamsSchema>;

export const prepareAssetUploadBodySchema = z.strictObject({
  filename: z.string().min(1).max(255).describe('The filename of the asset'),
  contentType: z.string().min(1).max(255).describe('The content type of the asset'),
  size: z.number().int().positive().describe('The size of the asset'),
});

export type PrepareAssetUploadBody = z.infer<typeof prepareAssetUploadBodySchema>;

export const prepareAssetUploadResultSchema = z.strictObject({
  uploadUrl: z.url(),
  uploadToken: z.string(),
});

export type PrepareAssetUploadResult = z.infer<typeof prepareAssetUploadResultSchema>;

export const prepareAssetUploadPropsSchema = z
  .object({ params: prepareAssetUploadParamsSchema, body: prepareAssetUploadBodySchema })
  .strict();
export type PrepareAssetUploadProps = z.infer<typeof prepareAssetUploadPropsSchema>;

/**
 * Prepares an asset upload by generating an upload URL and token.
 *
 * @operationId prepare-asset-upload
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.params - Path parameters (orgName, projectName)
 * @param props.body - Request body with file information
 * @returns Promise resolving to upload URL, token, and user upload ID
 * @example
 * ```typescript
 * const upload = await prepareAssetUpload(client, {
 *   params: { orgName: 'my-org', projectName: 'my-project' },
 *   body: { filename: 'model.glb', contentType: 'model/gltf-binary', size: 1024000 }
 * });
 * ```
 */
export const prepareAssetUpload = async (
  client: ApiClient,
  props: PrepareAssetUploadProps,
): Promise<PrepareAssetUploadResult> => {
  const { params, body } = prepareAssetUploadPropsSchema.parse(props);
  const path = buildPath('/assets/$orgName/$projectName/prepare-upload', params);
  const response = await client.axios.post(path, body);
  return parseResult(client, prepareAssetUploadResultSchema, response.data);
};

export const assetVersionResultSchema = z.object({
  originalExtension: z.string().optional(),
  analysis: assetAnalysisSchema.nullable().optional(),
  analysisSummary: assetAnalysisSummarySchema.nullable().optional(),
  description: descriptionSchema.default(''),
  id: z.number().int(),
  assetId: z.number().int(),
  version: assetVersionSchema,
  fileOid: z.string(),
  thumbnailOid: z.string().nullable(),
  createdAt: z.iso.datetime(),
  createdByUserId: z.number().int().nullable(),
  createdByUserName: z.string().nullable(),
  originalSize: z.number().int().nullable(),
});
export type AssetVersion = z.infer<typeof assetVersionResultSchema>;
export const listAssetVersionsResultSchema = z.array(assetVersionResultSchema);
export const createAssetVersionBodySchema = z.strictObject({
  description: descriptionSchema.optional(),
  uploadToken: z.string(),
  version: assetVersionSchema.optional(),
});
export async function listAssetVersions(
  client: ApiClient,
  props: { params: AssetParamsForVersions },
): Promise<AssetVersion[]> {
  const params = assetParamsSchema.parse(props.params);
  const response = await client.axios.get(buildPath('/assets/$orgName/$projectName/$assetName/versions', params));
  return parseResult(client, listAssetVersionsResultSchema, response.data);
}
type AssetParamsForVersions = z.infer<typeof assetParamsSchema>;
export async function createAssetVersion(
  client: ApiClient,
  props: { params: AssetParamsForVersions; body: z.infer<typeof createAssetVersionBodySchema> },
): Promise<Asset> {
  const params = assetParamsSchema.parse(props.params);
  const body = createAssetVersionBodySchema.parse(props.body);
  const response = await client.axios.post(
    buildPath('/assets/$orgName/$projectName/$assetName/versions', params),
    body,
  );
  return parseResult(client, assetSchema, response.data);
}
// Exact and floating references use the same read operation as an unversioned asset.
export const getAssetVersion = getAsset;

/** Edit release notes without changing the immutable version file. */
export const updateAssetVersionParamsSchema = assetParamsSchema.extend({ version: assetVersionSchema });
export const updateAssetVersionBodySchema = z.strictObject({ description: descriptionSchema });
export async function updateAssetVersion(
  client: ApiClient,
  props: {
    params: z.infer<typeof updateAssetVersionParamsSchema>;
    body: z.infer<typeof updateAssetVersionBodySchema>;
  },
): Promise<AssetVersion> {
  const params = updateAssetVersionParamsSchema.parse(props.params);
  const body = updateAssetVersionBodySchema.parse(props.body);
  const response = await client.axios.patch(
    buildPath('/assets/$orgName/$projectName/$assetName/versions/$version', params),
    body,
  );
  return parseResult(client, assetVersionResultSchema, response.data);
}
