import type { Resolution } from './types.js';
export type {
  Manifest,
  NativeAsset,
  UrlAsset,
  FileAsset,
  LockedAsset,
  Lockfile,
  Resolution,
  ResolveMode,
} from './types.js';

/** Construct before the first loader request. No registry calls or async URL decisions. */
export function createLoaResolver({ resolution }: { resolution: Resolution }) {
  const urls = new Map(Object.entries(resolution));
  for (const [alias, value] of urls) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid URL for asset ${alias}`);
  }
  const url = (alias: string): string => {
    const value = urls.get(alias);
    if (value === undefined) throw new Error(`Unknown LoA asset alias: ${alias}`);
    return value;
  };
  return {
    url,
    urlModifier: (value: string): string => (value.startsWith('loa:') ? url(value.slice(4)) : value),
  };
}

/** Load an exported resolution map before creating loaders, without a bundler. */
export async function loadLoaResolver(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load LoA resolution map: HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid LoA resolution map');
  return createLoaResolver({ resolution: value as Resolution });
}

/** Initialize a resolver from a map supplied by the application before the first loader request. */
export async function loaResolver({
  resolution,
}: {
  resolution: Resolution;
}): Promise<ReturnType<typeof createLoaResolver>> {
  return createLoaResolver({ resolution });
}
