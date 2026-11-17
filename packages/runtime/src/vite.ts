import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  applyLocalOverrides,
  isLocalAsset,
  buildResolution,
  liveAssetUrl,
  nativeHashHex,
  parseLockfile,
  relativeAssetPath,
} from './node.js';
import type { LockedAsset, Lockfile, ResolveMode } from './types.js';
import type { Plugin } from 'vite';

export type LoaPluginOptions = {
  /** Default: auto (installed files first, remote otherwise). Local mode requires loa pull for native and URL sources. */
  mode?: ResolveMode;
  /** Project root; defaults to Vite's root. */
  root?: string;
  /** Lockfile path relative to root. Default: assets-lock.json. */
  lockfile?: string;
};
const virtualId = '\0virtual:loa';

function localPath(root: string, directory: string, entry: LockedAsset, alias: string): string {
  return entry.kind === 'file' ? resolve(root, directory, entry.path) : resolve(root, relativeAssetPath(entry, alias));
}
async function readAsset(path: string, entry: LockedAsset): Promise<Buffer> {
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch (error) {
    throw new Error(`Cannot read LoA asset ${path}${entry.kind === 'file' ? '' : '; run loa pull first'}`, {
      cause: error,
    });
  }
  if (entry.kind === 'loa' && createHash('sha256').update(bytes).digest('hex') !== nativeHashHex(entry.hash)) {
    throw new Error(`LoA asset integrity mismatch: ${path}; run loa pull to repair it`);
  }
  return bytes;
}
function mimeType(path: string): string {
  const types: Record<string, string> = {
    '.glb': 'model/gltf-binary',
    '.zip': 'application/zip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ktx2': 'image/ktx2',
    '.hdr': 'image/vnd.radiance',
    '.exr': 'image/x-exr',
    '.ies': 'text/plain',
    '.mtlx': 'application/xml',
  };
  return types[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/** Vite plugin. virtual:loa exports the complete synchronous alias-to-URL map. */
export function loa(options: LoaPluginOptions = {}): Plugin {
  const mode = options.mode ?? 'auto';
  if (!['auto', 'remote', 'local'].includes(mode)) throw new Error('Expected auto, remote or local LoA mode');
  let root = resolve(options.root ?? '.');
  let lockPath = resolve(root, options.lockfile ?? 'assets-lock.json');
  let base = '/';
  let building = false;
  const readLock = async (): Promise<Lockfile> =>
    applyLocalOverrides(parseLockfile(JSON.parse(await readFile(lockPath, 'utf8'))), root);
  return {
    name: 'loa-assets',
    enforce: 'pre' as const,
    configResolved(config) {
      root = resolve(options.root ?? config.root);
      lockPath = resolve(root, options.lockfile ?? 'assets-lock.json');
      base = config.base;
      building = config.command === 'build';
    },
    resolveId(id: string) {
      return id === 'virtual:loa' ? virtualId : undefined;
    },
    async load(id) {
      if (id !== virtualId) return undefined;
      const lock = await readLock();
      // Checks duplicate aliases even when every asset will be emitted below.
      const resolution = buildResolution(lock, { mode, baseUrl: base, rootDir: root });
      this.addWatchFile(lockPath);
      const overridesPath = resolve(root, 'assets.local.json');
      if (building && existsSync(overridesPath)) this.addWatchFile(overridesPath);
      if (!building) return `export default JSON.parse(${JSON.stringify(JSON.stringify(resolution))});`;
      const entries: string[] = [];
      for (const [directory, importer] of Object.entries(lock.importers)) {
        for (const [alias, entry] of Object.entries(importer.assets)) {
          if (!isLocalAsset(root, entry, mode, alias)) {
            entries.push(`[${JSON.stringify(alias)}]:${JSON.stringify(resolution[alias])}`);
            continue;
          }
          const path = localPath(root, directory, entry, alias);
          this.addWatchFile(path);
          const bytes = await readAsset(path, entry);
          const extension = entry.kind === 'file' ? extname(path) : entry.extension;
          const hash = createHash('sha256').update(bytes).digest('hex');
          const emitted = this.emitFile({ type: 'asset', name: `loa-${hash}${extension}`, source: bytes });
          entries.push(`[${JSON.stringify(alias)}]:import.meta.ROLLUP_FILE_URL_${emitted}`);
        }
      }
      return `export default {${entries.join(',')}};`;
    },
    async configureServer(server) {
      let lock = await readLock();
      let routes = new Map<string, { path: string; entry: LockedAsset }>();
      const updateRoutes = () => {
        buildResolution(lock, { mode, rootDir: root });
        routes = new Map();
        const prefix = new URL(base, 'http://loa.local/').pathname.replace(/\/$/, '');
        for (const [directory, importer] of Object.entries(lock.importers)) {
          for (const [alias, entry] of Object.entries(importer.assets)) {
            if (entry.kind !== 'file' && mode === 'remote') continue;
            const route = entry.kind === 'file' ? liveAssetUrl(directory, alias) : relativeAssetPath(entry, alias);
            routes.set(`${prefix}/${route}`, { path: localPath(root, directory, entry, alias), entry });
          }
        }
        server.watcher.add([
          resolve(root, 'assets.local.json'),
          resolve(root, 'assets'),
          lockPath,
          ...[...routes.values()].map((item) => item.path),
        ]);
      };
      updateRoutes();
      server.watcher.on('all', (event, path) => {
        if (!['add', 'change', 'unlink'].includes(event)) return;
        if (
          resolve(path) !== lockPath &&
          resolve(path) !== resolve(root, 'assets.local.json') &&
          ![...routes.values()].some((item) => item.path === resolve(path))
        )
          return;
        void (async () => {
          if (resolve(path) === lockPath || resolve(path) === resolve(root, 'assets.local.json')) {
            lock = await readLock();
            updateRoutes();
          }
          const module = server.moduleGraph.getModuleById(virtualId);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        })().catch(() => {
          // The next virtual-module load reports the invalid lockfile through Vite.
          const module = server.moduleGraph.getModuleById(virtualId);
          if (module) server.moduleGraph.invalidateModule(module);
          server.ws.send({ type: 'full-reload' });
        });
      });
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://loa.local').pathname;
        const route = routes.get(pathname);
        if (!route) {
          const prefix = new URL(base, 'http://loa.local/').pathname.replace(/\/$/, '');
          if (['/__loa/live/', '/assets/'].some((part) => pathname.startsWith(`${prefix}${part}`))) {
            response.writeHead(404);
            response.end();
            return;
          }
          return next();
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.writeHead(405, { Allow: 'GET, HEAD' });
          response.end();
          return;
        }
        void readAsset(route.path, route.entry)
          .then((bytes) => {
            response.writeHead(200, {
              'Content-Type': mimeType(route.path),
              'Content-Length': bytes.length,
              'Cache-Control': 'no-store',
            });
            response.end(request.method === 'HEAD' ? undefined : bytes);
          })
          .catch((error: unknown) => {
            response.writeHead(500, { 'Content-Type': 'text/plain' });
            response.end(error instanceof Error ? error.message : 'Could not read LoA asset');
          });
      });
    },
  };
}
