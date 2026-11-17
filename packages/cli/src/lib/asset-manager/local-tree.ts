import { lstat, readFile, realpath, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import glob from 'fast-glob';
import type { Lockfile } from '@landofassets/runtime/node';

type Entry = { path: string; directory: boolean };
type Layout = { files: Set<string>; directories: Set<string>; protected: Set<string> };
const portable = (path: string) => path.split('\\').join('/');
const within = (path: string, directory: string) => path === directory || path.startsWith(`${directory}/`);

async function physicalPath(path: string): Promise<string> {
  const tail: string[] = [];
  let current = resolve(path);
  for (;;) {
    try {
      return resolve(await realpath(current), ...tail);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(current) === current) throw error;
      tail.unshift(basename(current));
      current = dirname(current);
    }
  }
}

/** Reuse the resolved paths, including live inputs and the URL receipt, as the desired local tree. */
export async function requiredAssetTree(
  root: string,
  lock: Lockfile,
  paths: Iterable<string>,
  store: string,
): Promise<Layout> {
  const files = new Set(paths);
  const directories = new Set(['assets']);
  const protectedRoots = new Set<string>();
  const keepLive = (absolute: string) => {
    const path = portable(relative(root, absolute));
    if (!within(path, 'assets')) return;
    if (files.has(path)) throw new Error(`Installed asset path overlaps a live source: ${path}`);
    files.add(path);
  };
  let hasUrls = false;
  for (const [directory, importer] of Object.entries(lock.importers)) {
    for (const entry of Object.values(importer.assets)) {
      if (entry.kind === 'url') hasUrls = true;
      if (entry.kind === 'file') keepLive(resolve(root, directory, entry.path));
    }
  }
  try {
    const overrides = JSON.parse(await readFile(join(root, 'assets.local.json'), 'utf8')) as {
      overrides?: Record<string, unknown>;
    };
    for (const value of Object.values(overrides.overrides ?? {})) {
      if (typeof value === 'string' && value.startsWith('file:') && !isAbsolute(value.slice(5)))
        keepLive(resolve(root, value.slice(5)));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (hasUrls) files.add('assets/.loa-urls.json');
  const physicalRoot = await realpath(root);
  const storeLocations = [
    store,
    resolve(await physicalPath(dirname(store)), basename(store)),
    await physicalPath(store),
  ];
  for (const location of storeLocations) {
    const localStore = portable(relative(physicalRoot, location));
    if (!within(localStore, 'assets')) continue;
    if (localStore === 'assets') throw new Error('The global store cannot be the managed assets directory');
    protectedRoots.add(localStore);
    for (const path of files)
      if (within(path, localStore)) throw new Error(`Asset output overlaps the global store: ${path}`);
  }
  for (const path of [...files, ...protectedRoots]) {
    let parent = portable(dirname(path));
    while (parent !== '.') {
      directories.add(parent);
      parent = portable(dirname(parent));
    }
  }
  for (const path of files) if (directories.has(path)) throw new Error(`Conflicting asset file and directory: ${path}`);
  return { files, directories, protected: protectedRoots };
}

/** One snapshot before local writes; do not follow symlinks or scan a protected global store. */
export async function scanAssetTree(root: string, layout: Layout): Promise<Entry[]> {
  const directory = join(root, 'assets');
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error(`Asset directory must be a real directory: ${directory}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const entries = await glob('**/*', {
    cwd: directory,
    dot: true,
    onlyFiles: false,
    objectMode: true,
    followSymbolicLinks: false,
    ignore: [...layout.protected].flatMap((path) => [path.slice(7), `${path.slice(7)}/**`]),
  });
  return entries.map((entry) => ({ path: `assets/${entry.path}`, directory: entry.dirent.isDirectory() }));
}

/** Plan from that snapshot once. Parent directory removals subsume their obsolete children. */
export function planAssetPrune(snapshot: Entry[], layout: Layout): { before: Entry[]; parallel: Entry[] } {
  const result: { before: Entry[]; parallel: Entry[] } = { before: [], parallel: [] };
  const removedDirectories: string[] = [];
  for (const entry of snapshot.toSorted((a, b) => a.path.length - b.path.length)) {
    if (
      [...layout.protected].some((path) => within(entry.path, path)) ||
      removedDirectories.some((path) => within(entry.path, path))
    )
      continue;
    if ((entry.directory ? layout.directories : layout.files).has(entry.path)) continue;
    const shapeChange = (entry.directory ? layout.files : layout.directories).has(entry.path);
    const group = shapeChange ? result.before : result.parallel;
    group.push(entry);
    if (entry.directory) removedDirectories.push(entry.path);
  }
  return result;
}

/** rm unlinks symlinks; it never traverses their targets. */
export async function removeLocalEntry(root: string, entry: Entry): Promise<void> {
  await rm(join(root, entry.path), { recursive: entry.directory, force: true });
}
