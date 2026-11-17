import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import glob from 'fast-glob';
import {
  createAnonymousClient,
  getAsset,
  getFileUrl,
  assetParamsSchema,
  assetVersionSelectorSchema,
  assetVersionSchema,
} from '@landofassets/sdk';
import { parseLockfile, type Lockfile, type LockedAsset } from '@landofassets/runtime/node';

export type Manifest = { name: string; assets: Record<string, string>; workspaces?: string[] };
export type Project = { root: string; current: string; manifests: Record<string, Manifest>; lock?: Lockfile };
export type Registry = {
  resolve: (
    host: string,
    ref: string,
    selector?: string,
  ) => Promise<{
    version: string;
    hash: string;
    extension: string;
    remoteUrl: string;
  }>;
};

export const registry: Registry = {
  async resolve(host, ref, selector) {
    const [orgName, projectName, assetName] = ref.split('/') as [string, string, string];
    const client = createAnonymousClient({ host });
    const asset = await getAsset(client, {
      params: {
        orgName,
        projectName,
        assetName: selector ? `${assetName}@${selector}` : assetName,
      },
    });
    if (asset.visibility !== 'PUBLIC') throw new Error(`Asset is not public: ${ref}`);
    if (!/^[a-f0-9]{64}$/.test(asset.fileOid)) throw new Error(`Invalid file hash returned for ${ref}`);
    assetVersionSchema.parse(asset.version);
    return {
      version: asset.version,
      hash: `sha256-${Buffer.from(asset.fileOid, 'hex').toString('base64')}`,
      extension: asset.originalExtension,
      remoteUrl: getFileUrl(client, { params: { oid: asset.fileOid } }).toString(),
    };
  },
};

export function parseRef(value: string): { ref: string; selector?: string } {
  const [ref, selector, extra] = value.split('@');
  const parts = ref?.split('/') ?? [];
  if (parts.length !== 3 || extra !== undefined) throw new Error(`Expected org/project/asset[@version]: ${value}`);
  assetParamsSchema.parse({ orgName: parts[0], projectName: parts[1], assetName: parts[2] });
  if (selector !== undefined) assetVersionSelectorSchema.parse(selector);
  return { ref: ref!, ...(selector === undefined ? {} : { selector }) };
}

export function validateAlias(alias: string): void {
  if (
    !alias ||
    ['__proto__', 'constructor', 'prototype'].includes(alias) ||
    alias.trim() !== alias ||
    /[\s\\:#?]/.test(alias) ||
    alias.split('/').some((p) => !p || p === '.' || p === '..')
  ) {
    throw new Error(`Invalid asset alias: ${alias}`);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseManifest(value: unknown): Manifest {
  if (!object(value) || typeof value.name !== 'string' || !value.name.trim() || !object(value.assets)) {
    throw new Error('assets.json requires a name and an assets object');
  }
  for (const [alias, specifier] of Object.entries(value.assets)) {
    validateAlias(alias);
    if (typeof specifier !== 'string' || !specifier) throw new Error(`Invalid source for ${alias}`);
  }
  if (
    value.workspaces !== undefined &&
    (!Array.isArray(value.workspaces) ||
      value.workspaces.some(
        (p) => typeof p !== 'string' || isAbsolute(p) || p.startsWith('!') || p.split(/[\\/]/).includes('..'),
      ))
  ) {
    throw new Error('workspaces must contain relative directory globs within the project');
  }
  return value as Manifest;
}

async function readManifest(directory: string): Promise<Manifest | undefined> {
  try {
    return parseManifest(JSON.parse(await readFile(join(directory, 'assets.json'), 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function posix(path: string): string {
  return path.split(sep).join('/');
}

async function manifestsAt(root: string, manifest: Manifest): Promise<Record<string, Manifest>> {
  const manifests: Record<string, Manifest> = Object.assign(Object.create(null), { '.': manifest });
  const files = manifest.workspaces?.length
    ? await glob(
        manifest.workspaces.map((pattern) => `${pattern.replace(/\/$/, '')}/assets.json`),
        {
          cwd: root,
          onlyFiles: true,
          unique: true,
          ignore: ['**/node_modules/**', '**/asset_cache/**'],
          followSymbolicLinks: false,
        },
      )
    : [];
  for (const file of files.toSorted()) {
    const key = posix(dirname(file));
    if (key !== '.') manifests[key] = (await readManifest(join(root, key)))!;
  }
  const aliases = new Set<string>();
  const names = new Set<string>();
  for (const [key, child] of Object.entries(manifests)) {
    if (names.has(child.name)) throw new Error(`Duplicate workspace name: ${child.name}`);
    names.add(child.name);
    if (key !== '.' && child.workspaces?.length)
      throw new Error(`Nested workspace declarations are unsupported: ${key}`);
    for (const alias of Object.keys(child.assets)) {
      if (aliases.has(alias)) throw new Error(`Duplicate asset alias across workspaces: ${alias}`);
      aliases.add(alias);
    }
  }
  return manifests;
}

export async function loadProject(cwd = process.cwd(), create = false): Promise<Project> {
  const ancestors: { directory: string; manifest: Manifest }[] = [];
  let directory = resolve(cwd);
  for (;;) {
    const manifest = await readManifest(directory);
    if (manifest) ancestors.push({ directory, manifest });
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  const nearest = ancestors[0];
  if (!nearest) {
    if (!create) throw new Error('No assets.json found. Run loa add to initialize this project.');
    const root = resolve(cwd);
    return { root, current: '.', manifests: { '.': { name: basename(root), assets: {} } } };
  }
  let root = nearest.directory;
  let manifests = await manifestsAt(root, nearest.manifest);
  for (const ancestor of ancestors.slice(1)) {
    if (!ancestor.manifest.workspaces?.length) continue;
    const candidates = await manifestsAt(ancestor.directory, ancestor.manifest);
    if (candidates[posix(relative(ancestor.directory, nearest.directory))]) {
      root = ancestor.directory;
      manifests = candidates;
    }
  }
  let lock: Lockfile | undefined;
  try {
    lock = parseLockfile(JSON.parse(await readFile(join(root, 'assets-lock.json'), 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return { root, current: posix(relative(root, nearest.directory)) || '.', manifests, lock };
}

export function extensionFor(path: string): string {
  if (path.toLowerCase().endsWith('.mtlx.zip')) return '.mtlx.zip';
  if (path.toLowerCase().endsWith('.ultrahdr.jpg')) return '.ultrahdr.jpg';
  const extension = extname(path).toLowerCase();
  return /^\.[a-z0-9]+$/.test(extension) ? extension : '.bin';
}

export async function resolveSource(specifier: string, host: string, api: Registry = registry): Promise<LockedAsset> {
  if (specifier.startsWith('file:')) {
    const path = specifier.slice(5);
    if (!path || isAbsolute(path) || /^[a-z]:/i.test(path) || path.includes('\\')) {
      throw new Error('file: references must use portable relative paths');
    }
    return { kind: 'file', specifier, path };
  }
  if (/^https?:\/\//i.test(specifier)) {
    const url = new URL(specifier);
    if (url.username || url.password) throw new Error('Asset URLs must not contain credentials');
    return { kind: 'url', specifier, url: url.toString(), extension: extensionFor(url.pathname) };
  }
  const { ref, selector } = parseRef(specifier);
  const normalized = new URL(host);
  if (!['http:', 'https:'].includes(normalized.protocol) || normalized.username || normalized.password)
    throw new Error('Invalid LoA host');
  const resolved = await api.resolve(normalized.toString().replace(/\/$/, ''), ref, selector);
  if (!/^\.[a-z0-9]+(?:\.[a-z0-9]+)*$/i.test(resolved.extension))
    throw new Error(`Invalid asset extension: ${resolved.extension}`);
  return { kind: 'loa', specifier, host: normalized.toString().replace(/\/$/, ''), ref, ...resolved };
}

export async function resolveProject(
  project: Project,
  host: string,
  options: {
    frozen?: boolean;
    update?: Set<string>;
    api?: Registry;
  } = {},
): Promise<Lockfile> {
  if (options.frozen && !project.lock) throw new Error('Frozen lockfile requested but assets-lock.json is missing');
  const lock: Lockfile = { lockfileVersion: 1, importers: Object.create(null) };
  for (const key of Object.keys(project.manifests).toSorted()) {
    const manifest = project.manifests[key]!;
    const previous = project.lock?.importers[key];
    const assets: Record<string, LockedAsset> = Object.create(null);
    for (const alias of Object.keys(manifest.assets).toSorted()) {
      const specifier = manifest.assets[alias]!;
      const old = previous?.assets[alias];
      let matches = old?.specifier === specifier;
      if (matches && old?.kind === 'loa') {
        const selected = parseRef(specifier);
        matches =
          selected.ref === old.ref &&
          (selected.selector === undefined ||
            selected.selector === 'latest' ||
            old.version === selected.selector ||
            old.version.startsWith(`${selected.selector}.`));
      }
      if (matches && old && !options.update?.has(alias)) assets[alias] = old;
      else {
        if (options.frozen) throw new Error(`Frozen lockfile differs from assets.json: ${key}/${alias}`);
        assets[alias] = await resolveSource(specifier, old?.kind === 'loa' ? old.host : host, options.api);
      }
    }
    lock.importers[key] = { name: manifest.name, assets };
  }
  if (options.frozen && JSON.stringify(lock) !== JSON.stringify(project.lock)) {
    // Compare canonical output because user-edited key order is not a semantic change.
    if (serializeLock(lock) !== serializeLock(project.lock!))
      throw new Error('Frozen lockfile differs from workspace manifests');
  }
  return parseLockfile(lock);
}

/** Keep each asset binding on its own line so independent asset bumps merge independently. */
function assetLines(assets: Record<string, unknown>, indent: string): string {
  return Object.keys(assets)
    .toSorted()
    .map((key) => `${indent}${JSON.stringify(key)}: ${JSON.stringify(assets[key])}`)
    .join(',\n');
}

export function serializeManifest(manifest: Manifest): string {
  const assets = assetLines(manifest.assets, '    ');
  return `{\n  "name": ${JSON.stringify(manifest.name)},\n  "assets": {${assets ? `\n${assets}\n  ` : ''}}${
    manifest.workspaces ? `,\n  "workspaces": ${JSON.stringify(manifest.workspaces)}` : ''
  }\n}\n`;
}

export function serializeLock(lock: Lockfile): string {
  const importers = Object.keys(lock.importers)
    .toSorted()
    .map((key) => {
      const importer = lock.importers[key]!;
      const assets = assetLines(importer.assets, '        ');
      return `    ${JSON.stringify(key)}: {\n      "name": ${JSON.stringify(importer.name)},\n      "assets": {${assets ? `\n${assets}\n      ` : ''}}\n    }`;
    })
    .join(',\n');
  return `{\n  "lockfileVersion": 1,\n  "importers": {${importers ? `\n${importers}\n  ` : ''}}\n}\n`;
}

export async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function saveProject(project: Project, lock: Lockfile, changedManifests: string[] = []): Promise<void> {
  for (const key of changedManifests)
    await atomicWrite(join(project.root, key, 'assets.json'), serializeManifest(project.manifests[key]!));
  await atomicWrite(join(project.root, 'assets-lock.json'), serializeLock(lock));
}

export async function ignoreLocalAssets(root: string): Promise<void> {
  const path = join(root, '.gitignore');
  let text = '';
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const missing = ['/asset_cache/', '/asset-resolution.json', '/assets.local.json'].filter(
    (entry) => !text.split(/\r?\n/).includes(entry),
  );
  if (missing.length)
    await atomicWrite(path, text + (text && !text.endsWith('\n') ? '\n' : '') + missing.join('\n') + '\n');
}

export async function addAsset(
  input: string,
  alias: string | undefined,
  cwd: string,
  host: string,
  api: Registry = registry,
): Promise<void> {
  const project = await loadProject(cwd, true);
  let specifier = input;
  const manifestDir = join(project.root, project.current);
  let existingFile = false;
  if (!/^https?:\/\//i.test(input) && !input.startsWith('file:')) {
    try {
      existingFile = (await stat(resolve(cwd, input))).isFile();
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  const local =
    existingFile ||
    input.startsWith('file:') ||
    isAbsolute(input) ||
    input.startsWith('.') ||
    (!input.includes('/') && !input.includes('@'));
  if (local) {
    const absolute = resolve(cwd, input.startsWith('file:') ? input.slice(5) : input);
    if (!(await stat(absolute)).isFile()) throw new Error('Local asset must be a file');
    const path = posix(relative(manifestDir, absolute));
    specifier = `file:${path.startsWith('.') ? path : `./${path}`}`;
    alias ??= basename(absolute).replace(/\.(?:mtlx\.zip|ultrahdr\.jpg|[^.]+)$/i, '');
  } else if (/^https?:\/\//i.test(input)) {
    alias ??= basename(new URL(input).pathname).replace(/\.(?:mtlx\.zip|ultrahdr\.jpg|[^.]+)$/i, '') || 'asset';
  } else {
    const parsed = parseRef(input);
    alias ??= parsed.ref;
    if (!parsed.selector) {
      const resolved = await resolveSource(input, host, api);
      if (resolved.kind !== 'loa') throw new Error('Expected native asset');
      specifier = `${parsed.ref}@${resolved.version}`;
      // Reuse the exact resolution so adding an unversioned ref requires one metadata request.
      project.lock ??= { lockfileVersion: 1, importers: Object.create(null) };
      project.lock.importers[project.current] ??= { name: project.manifests[project.current]!.name, assets: {} };
      project.lock.importers[project.current]!.assets[alias] = { ...resolved, specifier };
    }
  }
  validateAlias(alias);
  for (const [key, manifest] of Object.entries(project.manifests)) {
    if (key !== project.current && Object.hasOwn(manifest.assets, alias))
      throw new Error(`Duplicate workspace alias: ${alias}`);
  }
  project.manifests[project.current]!.assets[alias] = specifier;
  const lock = await resolveProject(project, host, { api });
  await saveProject(project, lock, [project.current]);
  await ignoreLocalAssets(project.root);
}
