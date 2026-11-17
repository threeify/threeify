import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, readdir, rename, rm, stat, lstat, symlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  nativeHashHex,
  relativeAssetPath,
  relativeAliasPath,
  type LockedAsset,
  type NativeAsset,
} from '@landofassets/runtime/node';
import { hashFileSha256 } from '../hash.ts';

export function storePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.LOA_STORE_DIR) return resolve(env.LOA_STORE_DIR);
  const base =
    platform() === 'darwin'
      ? join(homedir(), 'Library', 'Caches')
      : platform() === 'win32'
        ? (env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'))
        : (env.XDG_CACHE_HOME ?? join(homedir(), '.cache'));
  return join(base, 'loa', ...(platform() === 'win32' ? ['Cache'] : []));
}

export function contentPath(store: string, hex: string): string {
  if (!/^[a-f0-9]{64}$/.test(hex)) throw new Error('Invalid SHA-256 hash');
  return join(store, 'v1', 'sha256', hex.slice(0, 2), hex);
}

async function replaceFile(temporary: string, destination: string): Promise<void> {
  try {
    await rename(temporary, destination);
  } catch (error) {
    // Windows may refuse replacing a read-only materialization. The replacement is already complete.
    if (platform() !== 'win32' || !['EPERM', 'EEXIST', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? ''))
      throw error;
    await rm(destination, { force: true });
    await rename(temporary, destination);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** All fetches are anonymous, including redirects to other origins. */
async function download(
  url: string,
  destination: string,
  expected?: string,
  onBytes?: (count: number) => void,
): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
    const source = Readable.fromWeb(response.body);
    const output = createWriteStream(temporary, { flags: 'wx' });
    const hash = expected ? createHash('sha256') : undefined;
    const digest = new Transform({
      transform(chunk, _encoding, callback) {
        hash?.update(chunk);
        onBytes?.(chunk.length);
        callback(null, chunk);
      },
    });
    await pipeline(source, digest, output);
    if (expected) {
      if (hash!.digest('hex') !== expected) throw new Error(`Integrity check failed: ${url}`);
    }
    if (expected) await chmod(temporary, 0o444);
    await replaceFile(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Clone first, then copy; never share a writable inode with the store. Install atomically, without modifying a shared inode. */
export async function materialize(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    try {
      await copyFile(source, temporary, constants.COPYFILE_FICLONE_FORCE);
    } catch {
      await rm(temporary, { force: true });
      await copyFile(source, temporary);
    }
    await chmod(temporary, 0o444);
    await replaceFile(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Never traverse a directory symlink when writing generated project files. */
export async function prepareAssetDirectories(root: string, paths: Iterable<string>): Promise<void> {
  for (const path of paths) {
    let current = root;
    for (const part of relative(root, dirname(join(root, path)))
      .split(/[\\/]/)
      .filter(Boolean)) {
      current = join(current, part);
      try {
        await mkdir(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error(`Asset directory must be a real directory: ${current}`);
    }
  }
}

/** Aliases point within the project, never into the global store. */
export async function installAlias(
  root: string,
  alias: string,
  entry: LockedAsset,
  sourcePath?: string,
): Promise<void> {
  if (entry.kind === 'file') return;
  const source = join(root, sourcePath ?? relativeAssetPath(entry));
  const destination = join(root, relativeAliasPath(alias, entry));
  if (source === destination) return;
  await prepareAssetDirectories(root, [relativeAliasPath(alias, entry)]);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    try {
      await symlink(relative(dirname(destination), source), temporary, 'file');
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS'].includes((error as NodeJS.ErrnoException).code ?? ''))
        throw error;
      await materialize(source, destination);
      return;
    }
    await replaceFile(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

const pendingContent = new Map<string, Promise<void>>();

export async function pullAsset(
  entry: LockedAsset,
  root: string,
  store: string,
  refresh = false,
  onBytes?: (count: number) => void,
  installedPath?: string,
): Promise<void> {
  if (entry.kind === 'file') return;
  const path = installedPath ?? relativeAssetPath(entry);
  await prepareAssetDirectories(root, [path]);
  const destination = join(root, path);
  if (entry.kind === 'url') {
    if (refresh || !(await exists(destination))) await download(entry.url, destination, undefined, onBytes);
    return;
  }
  await materialize(await cacheNativeAsset(entry, store, onBytes), destination);
}

/** Download into the existing global cache as soon as metadata is available. */
export async function cacheNativeAsset(
  entry: NativeAsset,
  store: string,
  onBytes?: (count: number) => void,
): Promise<string> {
  const hex = nativeHashHex(entry.hash);
  const cached = contentPath(store, hex);
  let pending = pendingContent.get(cached);
  if (!pending) {
    pending = (async () => {
      if (!(await exists(cached)) || (await hashFileSha256(cached)) !== hex)
        await download(entry.remoteUrl, cached, hex, onBytes);
    })();
    pendingContent.set(cached, pending);
  }
  try {
    await pending;
  } finally {
    if (pendingContent.get(cached) === pending) pendingContent.delete(cached);
  }
  return cached;
}

/** Project lock roots, rather than inode counts, track clones, hardlinks and copies alike. */
export async function registerProject(store: string, root: string): Promise<void> {
  const directory = join(store, 'v1', 'projects');
  await mkdir(directory, { recursive: true });
  const id = createHash('sha256').update(resolve(root)).digest('hex');
  const destination = join(directory, `${id}.json`);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const { writeFile } = await import('node:fs/promises');
  try {
    await writeFile(temporary, JSON.stringify({ root: resolve(root) }) + '\n');
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function cachedFiles(store: string): Promise<string[]> {
  const directory = join(store, 'v1', 'sha256');
  if (!(await exists(directory))) return [];
  const paths: string[] = [];
  for (const shard of await readdir(directory, { withFileTypes: true })) {
    if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue;
    for (const file of await readdir(join(directory, shard.name), { withFileTypes: true })) {
      if (file.isFile() && /^[a-f0-9]{64}$/.test(file.name)) paths.push(join(directory, shard.name, file.name));
    }
  }
  return paths;
}

export async function verifyStore(store: string): Promise<{ checked: number; corrupt: string[] }> {
  const files = await cachedFiles(store);
  const corrupt: string[] = [];
  for (const file of files) if ((await hashFileSha256(file)) !== file.split(/[\\/]/).at(-1)) corrupt.push(file);
  return { checked: files.length, corrupt };
}

export async function pruneStore(store: string): Promise<number> {
  const { parseLockfile } = await import('@landofassets/runtime/node');
  const keep = new Set<string>();
  const directory = join(store, 'v1', 'projects');
  if (await exists(directory)) {
    for (const file of await readdir(directory)) {
      const { root } = JSON.parse(await readFile(join(directory, file), 'utf8')) as { root: string };
      if (!(await exists(root))) {
        await rm(join(directory, file));
        continue;
      }
      // Fail closed on missing or malformed locks in existing projects; never guess that they are unused.
      const lock = parseLockfile(JSON.parse(await readFile(join(root, 'assets-lock.json'), 'utf8')));
      for (const importer of Object.values(lock.importers))
        for (const entry of Object.values(importer.assets)) {
          if (entry.kind === 'loa') keep.add(nativeHashHex(entry.hash));
        }
    }
  }
  let removed = 0;
  for (const file of await cachedFiles(store)) {
    if (!keep.has(file.split(/[\\/]/).at(-1)!)) {
      await rm(file);
      removed++;
    }
  }
  return removed;
}
