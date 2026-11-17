import * as z from 'zod';
import { type ApiClient, parseResult } from '../client.js';
import { buildPath } from '../lib/buildPath.js';
import { Enums } from '../lib/enums.js';
import { fetchBinary } from '../lib/fetchBinary.js';
import { assetParamsSchema, booleanPropSchema } from '../lib/schemas.js';
import {
  type BinaryResponse,
  type BinaryResponseType,
  defaultBinaryResponse,
  ImageResizeOptionsSchema,
} from '../lib/types.js';
import { makeUrl } from '../lib/url.js';

// Content-Disposition format: inline; filename="filename.glb"
const FILENAME_REGEX = /filename="([^"]+)"/;
const debugMediaTaskTrace = process.env.DEBUG_MEDIA_TASK_TRACE === '1' || process.env.DEBUG_MEDIA_TASK_TRACE === 'true';

function logMediaTaskTrace(event: string, details: Record<string, unknown>): void {
  if (!debugMediaTaskTrace) {
    return;
  }
  console.log('[media-task-trace]', event, details);
}

/**
 * Extracts filename from Content-Disposition header
 */
function extractFilenameFromContentDisposition(contentDisposition: string | undefined): string | undefined {
  if (!contentDisposition) {
    return;
  }
  const match = contentDisposition.match(FILENAME_REGEX);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Media API (explicit GET read-only + POST to start tasks)
// Path pattern: /media/:orgName/:projectName/:assetName.:extension
// ---------------------------------------------------------------------------

/** A selector is an opaque URL token here; the server resolves numeric versions or labels. */
export const mediaVersionSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/);
export const mediaParamsSchema = assetParamsSchema.extend({ version: mediaVersionSchema.optional() });
export type MediaParams = z.infer<typeof mediaParamsSchema>;

function mediaPathParams(input: MediaParams) {
  const { version, ...params } = mediaParamsSchema.parse(input);
  return { ...params, assetName: version === undefined ? params.assetName : `${params.assetName}@${version}` };
}

// --- original ---

export const mediaOriginalQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type MediaOriginalQuery = z.infer<typeof mediaOriginalQuerySchema>;

/** GET /media/:orgName/:projectName/:assetName.:extension - original uploaded file */
export const getMediaOriginalUrl = (
  client: ApiClient,
  props: { params: MediaParams; query?: MediaOriginalQuery; extension: string },
): URL => {
  const extension = z
    .string()
    .regex(/^\.[a-z0-9]+(?:\.[a-z0-9]+)*$/i)
    .parse(props.extension);
  const path = buildPath(
    `/media/$orgName/$projectName/$assetName${extension.toLowerCase()}`,
    mediaPathParams(props.params),
  );
  return makeUrl(client.host, path.replaceAll('%40', '@'), { ...props.query, original: true });
};

// --- 202 response schema ---

/** 202 response when POST starts a task */
export const mediaTaskAcceptedSchema = z.object({
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED']),
  taskId: z.number().int().optional(),
  taskUrl: z.url().optional(),
  eventsUrl: z.url().optional(),
});
export type MediaTaskAccepted = z.infer<typeof mediaTaskAcceptedSchema>;

// --- HDR images (EXR / HDR / UltraHDR) ---

export const HdrImageFormat = z.enum(['exr', 'hdr', 'ultrahdr']);
export type HdrImageFormat = z.infer<typeof HdrImageFormat>;

export const hdrImageQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type HdrImageQuery = z.infer<typeof hdrImageQuerySchema>;

export const hdrImageTaskQuerySchema = hdrImageQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type HdrImageTaskQuery = z.infer<typeof hdrImageTaskQuerySchema>;

// Per-format aliases kept for API route imports
export const imageHdrQuerySchema = hdrImageQuerySchema;
export type ImageHdrQuery = HdrImageQuery;
export const imageHdrTaskQuerySchema = hdrImageTaskQuerySchema;
export type ImageHdrTaskQuery = HdrImageTaskQuery;
export const imageExrQuerySchema = hdrImageQuerySchema;
export type ImageExrQuery = HdrImageQuery;
export const imageExrTaskQuerySchema = hdrImageTaskQuerySchema;
export type ImageExrTaskQuery = HdrImageTaskQuery;

export const imageJxlQuerySchema = hdrImageQuerySchema;
export type ImageJxlQuery = HdrImageQuery;
export const imageJxlTaskQuerySchema = hdrImageTaskQuerySchema;
export type ImageJxlTaskQuery = HdrImageTaskQuery;

// --- Standard images (WebP, extensible to future raster formats) ---

export const ImageFormat = z.enum(['webp']);
export type ImageFormat = z.infer<typeof ImageFormat>;

export const imageQuerySchema = ImageResizeOptionsSchema.and(
  z.object({ download: booleanPropSchema.optional(), original: booleanPropSchema.optional() }),
);
export type ImageQuery = z.infer<typeof imageQuerySchema>;

export const imageTaskQuerySchema = imageQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type ImageTaskQuery = z.infer<typeof imageTaskQuerySchema>;

// Per-format alias kept for API route imports
export const imageWebpQuerySchema = imageQuerySchema;
export type ImageWebpQuery = ImageQuery;
export const imageWebpTaskQuerySchema = imageTaskQuerySchema;
export type ImageWebpTaskQuery = ImageTaskQuery;

// --- Model: GLB ---

export const modelGlbQuerySchema = z.object({
  original: booleanPropSchema.optional(),
  download: booleanPropSchema.optional(),
  meshCompress: z.enum(Enums.GlbMeshCompress as unknown as [string, ...string[]]).optional(),
  textureCompress: z.enum(Enums.GlbTextureCompress as unknown as [string, ...string[]]).optional(),
});
export type ModelGlbQuery = z.infer<typeof modelGlbQuerySchema>;

export const modelGlbTaskQuerySchema = modelGlbQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type ModelGlbTaskQuery = z.infer<typeof modelGlbTaskQuerySchema>;

// --- Model: USDZ ---

export const modelUsdzQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type ModelUsdzQuery = z.infer<typeof modelUsdzQuerySchema>;

export const modelUsdzTaskQuerySchema = modelUsdzQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type ModelUsdzTaskQuery = z.infer<typeof modelUsdzTaskQuerySchema>;

// --- Model: Blend ---

export const modelBlendQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type ModelBlendQuery = z.infer<typeof modelBlendQuerySchema>;

export const modelBlendTaskQuerySchema = modelBlendQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type ModelBlendTaskQuery = z.infer<typeof modelBlendTaskQuerySchema>;

// --- Model: FBX ---

export const modelFbxQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type ModelFbxQuery = z.infer<typeof modelFbxQuerySchema>;

export const modelFbxTaskQuerySchema = modelFbxQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type ModelFbxTaskQuery = z.infer<typeof modelFbxTaskQuerySchema>;

// --- CAD: FCStd / IGES / STEP ---

export const cadFcstdQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type CadFcstdQuery = z.infer<typeof cadFcstdQuerySchema>;

export const cadFcstdTaskQuerySchema = cadFcstdQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type CadFcstdTaskQuery = z.infer<typeof cadFcstdTaskQuerySchema>;

export const cadIgesQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type CadIgesQuery = z.infer<typeof cadIgesQuerySchema>;

export const cadIgesTaskQuerySchema = cadIgesQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type CadIgesTaskQuery = z.infer<typeof cadIgesTaskQuerySchema>;

export const cadStepQuerySchema = z.object({
  download: booleanPropSchema.optional(),
  original: booleanPropSchema.optional(),
});
export type CadStepQuery = z.infer<typeof cadStepQuerySchema>;

export const cadStepTaskQuerySchema = cadStepQuerySchema.and(z.object({ cache: booleanPropSchema.optional() }));
export type CadStepTaskQuery = z.infer<typeof cadStepTaskQuerySchema>;

// --- Unified media helpers ---

export const MediaFormat = z.enum([
  'webp',
  'exr',
  'hdr',
  'ultrahdr',
  'glb',
  'usdz',
  'blend',
  'fbx',
  'fcstd',
  'iges',
  'step',
]);
export type MediaFormat = z.infer<typeof MediaFormat>;

export type MediaGetUrlProps =
  | { params: MediaParams; format: 'webp'; query?: ImageQuery }
  | { params: MediaParams; format: 'exr' | 'hdr' | 'ultrahdr'; query?: HdrImageQuery }
  | { params: MediaParams; format: 'glb'; query?: ModelGlbQuery }
  | { params: MediaParams; format: 'usdz'; query?: ModelUsdzQuery }
  | { params: MediaParams; format: 'blend'; query?: ModelBlendQuery }
  | { params: MediaParams; format: 'fbx'; query?: ModelFbxQuery }
  | { params: MediaParams; format: 'fcstd'; query?: CadFcstdQuery }
  | { params: MediaParams; format: 'iges'; query?: CadIgesQuery }
  | { params: MediaParams; format: 'step'; query?: CadStepQuery };

export type MediaUrlProps =
  | { params: MediaParams; format: 'webp'; query?: ImageQuery | ImageTaskQuery }
  | { params: MediaParams; format: 'exr' | 'hdr' | 'ultrahdr'; query?: HdrImageQuery | HdrImageTaskQuery }
  | { params: MediaParams; format: 'glb'; query?: ModelGlbQuery | ModelGlbTaskQuery }
  | { params: MediaParams; format: 'usdz'; query?: ModelUsdzQuery | ModelUsdzTaskQuery }
  | { params: MediaParams; format: 'blend'; query?: ModelBlendQuery | ModelBlendTaskQuery }
  | { params: MediaParams; format: 'fbx'; query?: ModelFbxQuery | ModelFbxTaskQuery }
  | { params: MediaParams; format: 'fcstd'; query?: CadFcstdQuery | CadFcstdTaskQuery }
  | { params: MediaParams; format: 'iges'; query?: CadIgesQuery | CadIgesTaskQuery }
  | { params: MediaParams; format: 'step'; query?: CadStepQuery | CadStepTaskQuery };

export type StartMediaTaskProps =
  | { params: MediaParams; format: 'webp'; query?: ImageTaskQuery }
  | { params: MediaParams; format: 'exr' | 'hdr' | 'ultrahdr'; query?: HdrImageTaskQuery }
  | { params: MediaParams; format: 'glb'; query?: ModelGlbTaskQuery }
  | { params: MediaParams; format: 'usdz'; query?: ModelUsdzTaskQuery }
  | { params: MediaParams; format: 'blend'; query?: ModelBlendTaskQuery }
  | { params: MediaParams; format: 'fbx'; query?: ModelFbxTaskQuery }
  | { params: MediaParams; format: 'fcstd'; query?: CadFcstdTaskQuery }
  | { params: MediaParams; format: 'iges'; query?: CadIgesTaskQuery }
  | { params: MediaParams; format: 'step'; query?: CadStepTaskQuery };

/**
 * Builds a typed media URL for GET routes across image/envmap/model formats.
 */
export const getMediaUrl = (client: ApiClient, props: MediaUrlProps): URL => {
  const format = MediaFormat.parse(props.format);
  const extension = format === 'ultrahdr' ? 'ultrahdr.jpg' : format;
  const path = buildPath(`/media/$orgName/$projectName/$assetName.${extension}`, mediaPathParams(props.params));
  return makeUrl(client.host, path.replaceAll('%40', '@'), props.query);
};

/**
 * Starts or reuses a media task via POST routes.
 * Returns a task status payload (202).
 */
export const startMediaTask = async (client: ApiClient, props: StartMediaTaskProps): Promise<MediaTaskAccepted> => {
  const url = getMediaUrl(client, props);
  logMediaTaskTrace('sdk.startMediaTask.request', {
    format: props.format,
    url: url.toString(),
    params: props.params,
    query: props.query ?? null,
  });
  const response = await client.axios.post(
    url.toString(),
    {},
    {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: (status) => status === 202,
    },
  );

  const parsed = parseResult(client, mediaTaskAcceptedSchema, response.data);
  logMediaTaskTrace('sdk.startMediaTask.accepted', {
    format: props.format,
    taskId: parsed.taskId ?? null,
    status: parsed.status,
    taskUrl: parsed.taskUrl ?? null,
  });
  return parsed;
};

export async function getMedia<T extends BinaryResponse>(
  client: ApiClient,
  props: Extract<MediaGetUrlProps, { format: 'webp' | 'exr' | 'hdr' | 'ultrahdr' }>,
  binaryResponse?: T,
): Promise<BinaryResponseType<T>>;
export async function getMedia<T extends BinaryResponse>(
  client: ApiClient,
  props: Extract<MediaGetUrlProps, { format: 'glb' | 'usdz' | 'blend' | 'fbx' | 'fcstd' | 'iges' | 'step' }>,
  binaryResponse?: T,
): Promise<{ data: BinaryResponseType<T>; fileName: string | undefined; mimeType: string | undefined }>;
/**
 * Downloads media from typed GET routes.
 * Returns binary for image/envmap formats, and binary + metadata for model formats.
 */
export async function getMedia<T extends BinaryResponse>(
  client: ApiClient,
  props: MediaGetUrlProps,
  binaryResponse = defaultBinaryResponse<T>(),
): Promise<
  BinaryResponseType<T> | { data: BinaryResponseType<T>; fileName: string | undefined; mimeType: string | undefined }
> {
  const url = getMediaUrl(client, props);
  const response = await fetchBinary(client.axios, url.toString(), { maxRedirects: 5 }, binaryResponse);
  if (
    props.format === 'glb' ||
    props.format === 'usdz' ||
    props.format === 'blend' ||
    props.format === 'fbx' ||
    props.format === 'fcstd' ||
    props.format === 'iges' ||
    props.format === 'step'
  ) {
    const headers = response.headers as Record<string, string>;
    return {
      data: response.data,
      fileName: extractFilenameFromContentDisposition(headers['content-disposition']),
      mimeType: headers['content-type'],
    };
  }
  return response.data;
}
