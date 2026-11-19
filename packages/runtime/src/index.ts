import type { Resolution } from './types.js';
export type {
  Manifest,
  DependencyMode,
  NativeAsset,
  UrlAsset,
  FileAsset,
  LockedAsset,
  Lockfile,
  Resolution,
  ResolveMode,
} from './types.js';

/** Construct before the first loader request. No registry calls or async URL decisions. */
export function createThreeifyResolver({ resolution }: { resolution: Resolution }) {
  const urls = new Map(Object.entries(resolution));
  for (const [alias, value] of urls) {
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid URL for asset ${alias}`);
  }
  const url = (alias: string): string => {
    const value = urls.get(alias);
    if (value === undefined) throw new Error(`Unknown Threeify asset alias: ${alias}`);
    return value;
  };
  return {
    url,
    urlModifier: (value: string): string => (value.startsWith('threeify:') ? url(value.slice(9)) : value),
  };
}

/** Load an exported resolution map before creating loaders, without a bundler. */
export async function loadThreeifyResolver(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load Threeify resolution map: HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Threeify resolution map');
  return createThreeifyResolver({ resolution: value as Resolution });
}

/** Initialize a resolver from a map supplied by the application before the first loader request. */
export async function threeifyResolver({
  resolution,
}: {
  resolution: Resolution;
}): Promise<ReturnType<typeof createThreeifyResolver>> {
  return createThreeifyResolver({ resolution });
}
