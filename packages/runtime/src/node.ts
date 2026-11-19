import { createHash } from 'node:crypto';
import { isAbsolute, posix, resolve, relative } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import type { DependencyMode, LockedAsset, Lockfile, NativeAsset, Resolution, ResolveMode } from './types.js';
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

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a lockfile object');
  return value as Record<string, unknown>;
}
function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new Error(`Invalid lockfile ${field}`);
  return value;
}
export function httpUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error(`Expected a public HTTP(S) URL: ${value}`);
  return url;
}
export function nativeHashHex(hash: string): string {
  if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(hash)) throw new Error('Expected SHA-256 integrity in SRI base64 form');
  const bytes = Buffer.from(hash.slice(7), 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== hash.slice(7)) throw new Error('Invalid SHA-256 integrity');
  return bytes.toString('hex');
}
export function assertNativeAsset(entry: NativeAsset): void {
  const segments = entry.ref.split('/');
  if (segments.length !== 3 || segments.some((part) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part)))
    throw new Error('Invalid canonical asset ref');
  if (entry.specifier.split('@')[0] !== entry.ref)
    throw new Error('Native source specifier must contain its full org/project/asset ref');
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(entry.version))
    throw new Error('Expected an exact asset version');
  if (entry.version.split('.').some((part) => Number(part) > 2147483647))
    throw new Error('Version component is too large');
  httpUrl(entry.host);
  const hex = nativeHashHex(entry.hash);
  const expected = new URL(`/files/${hex}`, entry.host).href;
  if (httpUrl(entry.remoteUrl).href !== expected)
    throw new Error('Native asset URL must match its host and content hash');
}
function extension(value: unknown): string {
  const result = string(value, 'extension');
  if (!/^\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$/.test(result)) throw new Error('Invalid asset extension');
  return result;
}
export function parseLockfile(value: unknown): Lockfile {
  const input = object(value);
  // Version 1 named the importer map `assets` and had no per-binding mode.
  if (input.lockfileVersion !== 1 && input.lockfileVersion !== 2)
    throw new Error('Unsupported assets-lock.json version');
  const importers: Lockfile['importers'] = Object.create(null);
  for (const [directory, rawImporter] of Object.entries(object(input.importers))) {
    string(directory, 'importer directory');
    if (
      directory !== '.' &&
      (!directory ||
        directory.includes('\\') ||
        directory.startsWith('/') ||
        directory.split('/').some((part) => !part || part === '.' || part === '..') ||
        /^[A-Za-z]:/.test(directory))
    )
      throw new Error(`Invalid importer path: ${directory}`);
    const importer = object(rawImporter);
    const assets: Record<string, LockedAsset> = Object.create(null);
    for (const [alias, rawEntry] of Object.entries(object(importer.dependencies ?? importer.assets))) {
      string(alias, 'alias');
      const entry = object(rawEntry);
      const specifier = string(entry.specifier, 'specifier');
      if (entry.mode !== undefined && entry.mode !== 'local' && entry.mode !== 'remote')
        throw new Error(`Invalid lockfile mode for ${alias}`);
      const mode: { mode?: DependencyMode } = entry.mode === undefined ? {} : { mode: entry.mode };
      if (entry.kind === 'loa') {
        const native: NativeAsset = {
          kind: 'loa',
          specifier,
          host: string(entry.host, 'host'),
          ref: string(entry.ref, 'ref'),
          version: string(entry.version, 'version'),
          hash: string(entry.hash, 'hash'),
          remoteUrl: string(entry.remoteUrl, 'remoteUrl'),
          extension: extension(entry.extension),
          ...mode,
        };
        assertNativeAsset(native);
        assets[alias] = native;
      } else if (entry.kind === 'url') {
        const url = string(entry.url, 'url');
        if (httpUrl(specifier).href !== httpUrl(url).href)
          throw new Error('Direct URL must match its manifest specifier');
        assets[alias] = { kind: 'url', specifier, url, extension: extension(entry.extension), ...mode };
      } else if (entry.kind === 'file') {
        const path = string(entry.path, 'path');
        if (isAbsolute(path) || /^[a-z]:/i.test(path) || path.includes('\\'))
          throw new Error('file: references must use portable relative paths');
        if (specifier !== `file:${path}`) throw new Error('File path must match its manifest specifier');
        if (entry.mode === 'remote') throw new Error(`file: reference cannot be a remote dependency: ${alias}`);
        assets[alias] = { kind: 'file', specifier, path, ...(entry.mode === 'local' ? { mode: 'local' } : {}) };
      } else throw new Error(`Unknown asset source: ${String(entry.kind)}`);
    }
    importers[directory] = { name: string(importer.name, 'name'), dependencies: assets };
  }
  return { lockfileVersion: 2, importers };
}
export function urlHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
/** Relative installed path. Native names are stable; URL keys identify URLs, not integrity. */
export function relativeAssetPath(entry: Exclude<LockedAsset, { kind: 'file' }>, alias?: string): string {
  if (alias !== undefined) return relativeAliasPath(alias, entry);
  if (entry.kind === 'url') return posix.join('assets', '_urls', `${urlHash(entry.url)}${extension(entry.extension)}`);
  assertNativeAsset(entry);
  return posix.join('assets', `${entry.ref}${extension(entry.extension)}`);
}

/** Alias paths are portable files under assets/, with the source extension appended once. */
export function relativeAliasPath(alias: string, entry: Exclude<LockedAsset, { kind: 'file' }>): string {
  if (
    alias
      .split('/')
      .some(
        (part) =>
          !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(part) ||
          /[.]$/.test(part) ||
          /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:[.]|$)/i.test(part),
      )
  )
    throw new Error(`Asset alias cannot be used as a portable local path: ${alias}`);
  const suffix = extension(entry.extension);
  return posix.join('assets', alias.endsWith(suffix) ? alias : `${alias}${suffix}`);
}

/** The same selected source may have several public bindings. */
export function assetSourceKey(entry: LockedAsset): string {
  return JSON.stringify(
    entry.kind === 'loa'
      ? [entry.kind, entry.host, entry.ref, entry.version, entry.hash, entry.extension]
      : entry.kind === 'url'
        ? [entry.kind, entry.url, entry.extension]
        : [entry.kind, entry.path],
  );
}

/** Check the complete layout before installing; readable paths must never silently overwrite another source. */
export function assetInstallPaths(lock: Lockfile): Map<string, Exclude<LockedAsset, { kind: 'file' }>> {
  const paths = new Map<string, Exclude<LockedAsset, { kind: 'file' }>>();
  const identities = new Map<string, string>();
  for (const importer of Object.values(lock.importers)) {
    for (const [alias, entry] of Object.entries(importer.dependencies)) {
      // Remote dependencies are never installed, so they claim no local path.
      if (entry.kind === 'file' || entry.mode === 'remote') continue;
      const identity = assetSourceKey(entry);
      for (const path of [relativeAliasPath(alias, entry)]) {
        // Reject case collisions as well, for portable checkouts on Windows and macOS.
        const key = path.toLowerCase();
        const previous = identities.get(key);
        if (previous && (previous !== identity || !paths.has(path)))
          throw new Error(`Conflicting installed asset path: ${path}`);
        identities.set(key, identity);
        paths.set(path, entry);
      }
    }
  }
  for (const path of paths.keys()) {
    let parent = posix.dirname(path);
    while (parent !== '.') {
      if (identities.has(parent.toLowerCase())) throw new Error(`Conflicting installed asset directory: ${parent}`);
      parent = posix.dirname(parent);
    }
  }
  return paths;
}
/** Optional untracked local substitutions, keyed by the same aliases as application code. */
export function applyLocalOverrides(lock: Lockfile, root: string): Lockfile {
  let input: unknown;
  try {
    input = JSON.parse(readFileSync(resolve(root, 'assets.local.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return lock;
    throw error;
  }
  const overrides = object(object(input).overrides);
  const result = structuredClone(lock);
  for (const [alias, raw] of Object.entries(overrides)) {
    if (
      typeof raw !== 'string' ||
      !raw.startsWith('file:') ||
      !raw.slice(5) ||
      raw.includes('\\') ||
      raw.includes('\0') ||
      isAbsolute(raw.slice(5)) ||
      /^[a-z]:/i.test(raw.slice(5))
    )
      throw new Error(`Local override ${alias} must be a portable relative file: reference`);
    const owner = Object.entries(result.importers).filter(([, importer]) =>
      Object.hasOwn(importer.dependencies, alias),
    );
    if (owner.length !== 1) throw new Error(`Unknown or duplicate local override alias: ${alias}`);
    const [directory, importer] = owner[0]!;
    const absolute = resolve(root, raw.slice(5));
    if (!statSync(absolute).isFile()) throw new Error(`Local override is not a file: ${alias}`);
    const path = relative(resolve(root, directory), absolute).split('\\').join('/');
    importer.dependencies[alias] = { kind: 'file', specifier: `file:${path}`, path };
  }
  return result;
}

export function isLocalAsset(root: string, entry: LockedAsset, mode: ResolveMode, alias?: string): boolean {
  // The manifest list wins over the requested mode: local dependencies never go remote, and vice versa.
  if (entry.kind === 'file' || entry.mode === 'local') return true;
  if (entry.mode === 'remote') return false;
  if (mode === 'local') return true;
  if (mode === 'remote') return false;
  try {
    return statSync(resolve(root, relativeAssetPath(entry, alias))).isFile();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
    throw error;
  }
}

/** URL served by the Vite plugin for precisely this locked local file. */
export function liveAssetUrl(importer: string, alias: string): string {
  return `__loa/live/${urlHash(`${importer}\0${alias}`)}`;
}
export function buildResolution(
  lock: Lockfile,
  { mode, baseUrl = '/', rootDir = '.' }: { mode: ResolveMode; baseUrl?: string; rootDir?: string },
): Resolution {
  if (!['auto', 'remote', 'local'].includes(mode)) throw new Error('Expected auto, remote or local resolution mode');
  const result: Resolution = Object.create(null);
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  for (const [directory, importer] of Object.entries(lock.importers)) {
    for (const [alias, entry] of Object.entries(importer.dependencies)) {
      if (Object.hasOwn(result, alias)) throw new Error(`Duplicate workspace asset alias: ${alias}`);
      result[alias] =
        entry.kind === 'file'
          ? `${prefix}${liveAssetUrl(directory, alias)}`
          : !isLocalAsset(rootDir, entry, mode, alias)
            ? entry.kind === 'loa'
              ? entry.remoteUrl
              : entry.url
            : `${prefix}${relativeAssetPath(entry, alias)}`;
    }
  }
  return result;
}
