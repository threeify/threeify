import type { Enums } from './enums.js';

const FILE_FORMAT_DEFINITIONS = {
  '3ds': { name: '3DS', mimeType: 'model/3ds', extension: '.3ds' },
  avif: { name: 'AVIF', mimeType: 'image/avif', extension: '.avif' },
  blend: { name: 'Blender (BLEND)', mimeType: 'application/x-blender', extension: '.blend' },
  dae: { name: 'COLLADA', mimeType: 'model/vnd.collada+xml', extension: '.dae' },
  dxf: { name: 'AutoCAD DXF', mimeType: 'application/dxf', extension: '.dxf' },
  exr: { name: 'OpenEXR (EXR)', mimeType: 'image/x-exr', extension: '.exr', alternativeMimeTypes: ['image/aces'] },
  fcstd: {
    name: 'FreeCAD (FCStd)',
    mimeType: 'application/zip',
    extension: '.fcstd',
    alternativeMimeTypes: ['application/x-freecad'],
  },
  fbx: {
    name: 'Autodesk FBX',
    mimeType: 'model/fbx',
    extension: '.fbx',
    alternativeMimeTypes: ['application/x.autodesk.fbx'],
  },
  gif: { name: 'GIF', mimeType: 'image/gif', extension: '.gif' },
  glb: { name: 'Khronos glTF (GLB)', mimeType: 'model/gltf-binary', extension: '.glb' },
  gltf: { name: 'Khronos glTF (GLTF)', mimeType: 'model/gltf+json', extension: '.gltf' },
  hdr: { name: 'Radiance (HDR)', mimeType: 'image/vnd.radiance', extension: '.hdr' },
  ies: {
    name: 'IES photometric light (IES)',
    mimeType: 'application/ies',
    extension: '.ies',
    alternativeMimeTypes: ['text/plain', 'application/octet-stream'],
  },
  iges: {
    name: 'IGES',
    mimeType: 'model/iges',
    extension: '.iges',
    alternativeExtensions: ['.igs'],
    alternativeMimeTypes: ['/application/iges'],
  },
  jpg: { name: 'JPEG', mimeType: 'image/jpeg', extension: '.jpg', alternativeExtensions: ['.jpeg'] },
  mtlx: {
    name: 'MaterialX (MTLX.ZIP)',
    mimeType: 'application/vnd.materialx+zip',
    extension: '.mtlx.zip',
    // A loose .mtlx is packaged into a .mtlx.zip on ingest.
    alternativeExtensions: ['.mtlx'],
    alternativeMimeTypes: ['application/zip', 'application/xml', 'text/xml'],
  },
  obj: { name: 'Wavefront OBJ', mimeType: 'model/obj', extension: '.obj' },
  pdf: { name: 'Portable Document Format (PDF)', mimeType: 'application/pdf', extension: '.pdf' },
  ply: { name: 'PLY', mimeType: 'model/ply', extension: '.ply' },
  png: { name: 'PNG', mimeType: 'image/png', extension: '.png' },
  step: {
    name: 'STEP',
    mimeType: 'application/step',
    extension: '.step',
    alternativeExtensions: ['.stp', '.stpnc'],
    alternativeMimeTypes: ['model/step'],
  },
  stl: { name: 'STL', mimeType: 'model/stl', extension: '.stl' },
  svg: { name: 'SVG', mimeType: 'image/svg+xml', extension: '.svg' },
  tif: { name: 'TIFF', mimeType: 'image/tiff', extension: '.tif', alternativeExtensions: ['.tiff'] },
  usdz: { name: 'Universal Scene Description (USDZ)', mimeType: 'model/vnd.usdz+zip', extension: '.usdz' },
  webp: { name: 'WebP', mimeType: 'image/webp', extension: '.webp' },
  zip: { name: 'ZIP Archive', mimeType: 'application/zip', extension: '.zip' },
} as const;

export type FileFormat = keyof typeof FILE_FORMAT_DEFINITIONS;
export const FileFormat = Object.keys(FILE_FORMAT_DEFINITIONS) as FileFormat[];
export const MimeType = [
  ...new Set(Object.values(FILE_FORMAT_DEFINITIONS).map((definition) => definition.mimeType)),
] as const;
export type MimeType = (typeof MimeType)[number];

export type FileFormatInfo = {
  format: FileFormat;
  name: string;
  mimeType: MimeType;
  extension: string;
  alternativeExtensions: readonly string[];
  alternativeMimeTypes: readonly string[];
};

export const FileFormatToFileFormatInfo: Record<FileFormat, FileFormatInfo> = FileFormat.reduce(
  (acc, format) => {
    const definition = FILE_FORMAT_DEFINITIONS[format];
    const alternativeExtensions = 'alternativeExtensions' in definition ? definition.alternativeExtensions : [];
    const alternativeMimeTypes = 'alternativeMimeTypes' in definition ? definition.alternativeMimeTypes : [];
    acc[format] = { format, ...definition, alternativeExtensions, alternativeMimeTypes };
    return acc;
  },
  {} as Record<FileFormat, FileFormatInfo>,
);

export type AssetTypeFileMapping = {
  fileFormats: readonly FileFormat[];
  description: string;
};
export function getFileFormatInfos(formats: readonly FileFormat[]): FileFormatInfo[] {
  return formats.map((format) => FileFormatToFileFormatInfo[format]);
}

export const MODEL_ASSET_FILE_FORMATS = ['glb', 'usdz', 'blend', 'fbx'] as const satisfies readonly FileFormat[];
export const IMAGE_ASSET_FILE_FORMATS = ['jpg', 'png', 'webp'] as const satisfies readonly FileFormat[];
export const ENVMAP_ASSET_FILE_FORMATS = ['hdr', 'exr'] as const satisfies readonly FileFormat[];
export const CAD_ASSET_FILE_FORMATS = ['fcstd', 'iges', 'step'] as const satisfies readonly FileFormat[];
export const MATERIAL_ASSET_FILE_FORMATS = ['mtlx'] as const satisfies readonly FileFormat[];
export const LIGHT_ASSET_FILE_FORMATS = ['ies'] as const satisfies readonly FileFormat[];

function getDescriptionExtensionList(fileFormatInfos: readonly FileFormatInfo[]): string {
  return Array.from(
    new Set(
      fileFormatInfos.flatMap((fileFormatInfo) =>
        [fileFormatInfo.extension, ...fileFormatInfo.alternativeExtensions].map((ext) =>
          ext.replace('.', '').toUpperCase(),
        ),
      ),
    ),
  ).join(', ');
}

function buildAssetTypeDescription(prefix: string, fileFormatInfos: readonly FileFormatInfo[]): string {
  return `${prefix} (${getDescriptionExtensionList(fileFormatInfos)})`;
}

export const ASSET_TYPE_FILE_MAPPINGS: Record<Enums.AssetType, AssetTypeFileMapping> = {
  LIGHT: {
    fileFormats: LIGHT_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('Photometric lights', getFileFormatInfos(LIGHT_ASSET_FILE_FORMATS)),
  },
  MODEL: {
    fileFormats: MODEL_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('3D model files', getFileFormatInfos(MODEL_ASSET_FILE_FORMATS)),
  },
  MATERIAL: {
    fileFormats: MATERIAL_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('MaterialX materials', getFileFormatInfos(MATERIAL_ASSET_FILE_FORMATS)),
  },
  SCENE: {
    fileFormats: MODEL_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('Scene files', getFileFormatInfos(MODEL_ASSET_FILE_FORMATS)),
  },
  IMAGE: {
    fileFormats: IMAGE_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('Image files', getFileFormatInfos(IMAGE_ASSET_FILE_FORMATS)),
  },
  ENVMAP: {
    fileFormats: ENVMAP_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('Environment maps', getFileFormatInfos(ENVMAP_ASSET_FILE_FORMATS)),
  },
  CAD: {
    fileFormats: CAD_ASSET_FILE_FORMATS,
    description: buildAssetTypeDescription('CAD files', getFileFormatInfos(CAD_ASSET_FILE_FORMATS)),
  },
};

export const AVATAR_FILE_FORMATS = ['png', 'jpg', 'gif', 'webp'] as const satisfies readonly FileFormat[];

export const REFERENCE_IMAGE_FILE_FORMATS = ['png', 'jpg', 'gif', 'webp'] as const satisfies readonly FileFormat[];

function normalizeExtension(ext: string): string {
  return ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
}

export function getFileFormatMimeTypes(fileFormats: readonly FileFormat[]): MimeType[] {
  return [...new Set(fileFormats.map((fileFormat) => FileFormatToFileFormatInfo[fileFormat].mimeType))] as MimeType[];
}

export function getFileFormatExtensions(fileFormats: readonly FileFormat[]): string[] {
  return [
    ...new Set(
      fileFormats.flatMap((fileFormat) => {
        const info = FileFormatToFileFormatInfo[fileFormat];
        return [info.extension, ...info.alternativeExtensions];
      }),
    ),
  ];
}

export function getFileFormatInfoAcceptObject(fileFormats: readonly FileFormat[]): Record<string, string[]> {
  const acceptObject: Record<string, string[]> = {};
  for (const fileFormatInfo of getFileFormatInfos(fileFormats)) {
    const extensions = [
      fileFormatInfo.extension,
      ...fileFormatInfo.alternativeExtensions,
      ...(acceptObject[fileFormatInfo.mimeType] ?? []),
    ];
    acceptObject[fileFormatInfo.mimeType] = [...new Set(extensions)];
  }
  return acceptObject;
}

export function getFileFormatInfoFromMimeType(
  mimeType: string,
  fileFormats: readonly FileFormat[],
): FileFormatInfo | undefined {
  return getFileFormatInfos(fileFormats).find(
    (fileFormatInfo) => fileFormatInfo.mimeType === mimeType || fileFormatInfo.alternativeMimeTypes.includes(mimeType),
  );
}

export function getFileFormatInfoFromExtension(
  ext: string,
  fileFormats: readonly FileFormat[],
): FileFormatInfo | undefined {
  const normalizedExt = normalizeExtension(ext);
  return getFileFormatInfos(fileFormats).find(
    (fileFormatInfo) =>
      fileFormatInfo.extension === normalizedExt || fileFormatInfo.alternativeExtensions.includes(normalizedExt),
  );
}

/** Match a file name against the formats' extensions, longest extension first, so `x.mtlx.zip` is mtlx, not zip. */
export function getFileFormatInfoFromFileName(
  fileName: string,
  fileFormats: readonly FileFormat[],
): FileFormatInfo | undefined {
  const lowerFileName = fileName.toLowerCase();
  let best: { info: FileFormatInfo; length: number } | undefined;
  for (const info of getFileFormatInfos(fileFormats)) {
    for (const ext of [info.extension, ...info.alternativeExtensions]) {
      if (lowerFileName.endsWith(ext) && ext.length > (best?.length ?? 0)) {
        best = { info, length: ext.length };
      }
    }
  }
  return best?.info;
}

/** The extension of a file name as registered (e.g. `.mtlx.zip`), else its last `.ext`, else ''. */
export function getFileNameExtension(fileName: string): string {
  const info = getFileFormatInfoFromFileName(fileName, FileFormat);
  if (info) {
    const lowerFileName = fileName.toLowerCase();
    return [info.extension, ...info.alternativeExtensions].find((ext) => lowerFileName.endsWith(ext)) ?? info.extension;
  }
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : '';
}

/**
 * Resolve a format from a MIME type, using the file name to break ties when several formats share the MIME
 * type (e.g. `application/zip` is fcstd, mtlx and zip).
 */
export function getFileFormatInfoFromMimeTypeAndFileName(
  mimeType: string,
  fileName: string | undefined,
  fileFormats: readonly FileFormat[],
): FileFormatInfo | undefined {
  const candidates = getFileFormatInfos(fileFormats).filter(
    (info) => info.mimeType === mimeType || info.alternativeMimeTypes.includes(mimeType),
  );
  if (candidates.length > 1 && fileName) {
    const byName = getFileFormatInfoFromFileName(
      fileName,
      candidates.map((info) => info.format),
    );
    if (byName) return byName;
  }
  return candidates.find((info) => info.mimeType === mimeType) ?? candidates[0];
}

/** Given a MIME type, return the matching format key from the allowed set, or undefined if not found. */
export function getMimeFileFormat<T extends readonly FileFormat[]>(
  mimeType: string,
  formats: T,
): T[number] | undefined {
  return getFileFormatInfoFromMimeType(mimeType, formats)?.format;
}

export function getAssetTypeFromFileFormat(fileFormat: FileFormat): Enums.AssetType | undefined {
  for (const [assetType, mapping] of Object.entries(ASSET_TYPE_FILE_MAPPINGS)) {
    if (mapping.fileFormats.includes(fileFormat)) {
      return assetType as Enums.AssetType;
    }
  }
  return;
}
