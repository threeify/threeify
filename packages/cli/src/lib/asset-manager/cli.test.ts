import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  realpath,
  readlink,
  symlink,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nativeHashHex, relativeAssetPath, type NativeAsset, type UrlAsset } from '@threeify/runtime/node';
import { loadProject } from './project.ts';
import { contentPath, pruneStore, pullAsset, registerProject, verifyStore } from './store.ts';

const executable = fileURLToPath(new URL('../../../dist/bin/threeify.js', import.meta.url));
const nativeBytes = Buffer.from('native immutable bytes');
const oid = createHash('sha256').update(nativeBytes).digest('hex');
let server: Server;
let host: string;
let root: string;
let store: string;
let requests: { path: string; auth?: string }[];
let urlBytes: string;
let serveCorrupt: boolean;
let latest: string;
let metadataDelay = 0;
let metadataActive = 0;
let metadataPeak = 0;
let holdMetadata = false;
let releaseMetadata: (() => void) | undefined;
let downloadBeforeMetadata = false;
let failDownloads: boolean;
let assetMissing: boolean;
let rejectPublication: boolean;
let uploadBytes: Buffer | undefined;
let publication: Record<string, unknown> | undefined;

async function expectCacheLink(path: string, hex = oid) {
  expect((await lstat(path)).isSymbolicLink()).toBe(true);
  expect((await readlink(path)).replaceAll('\\', '/')).toMatch(new RegExp(`/sha256/${hex.slice(0, 2)}/${hex}$`));
  expect(await realpath(path)).toBe(await realpath(contentPath(store, hex)));
}

function assetResponse(version: string) {
  return {
    id: 1,
    name: 'chair',
    type: 'MODEL',
    visibility: 'PUBLIC',
    projectId: 1,
    projectName: 'models',
    orgId: 1,
    orgName: 'acme',
    description: '',
    keywords: '',
    shareLicense: 'CC_BY',
    commentMode: 'ENABLED',
    reported: false,
    likeCount: 0,
    shareCount: 0,
    createdAt: '2026-11-08T00:00:00.000Z',
    updatedAt: '2026-11-08T00:00:00.000Z',
    archived: false,
    metadata: '',
    version,
    latestVersion: latest,
    versionId: 1,
    fileOid: oid,
    originalExtension: '.glb',
  };
}

async function run(args: string[], environment: Record<string, string> = {}) {
  return promisify(execFile)(process.execPath, [executable, ...args], {
    cwd: root,
    env: {
      ...process.env,
      HOME: root,
      LOA_HOST: host,
      LOA_STORE_DIR: store,
      LOA_TOKEN: 'must-not-be-forwarded',
      ...environment,
    },
  });
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = decodeURIComponent(request.url!);
    requests.push({ path, auth: request.headers.authorization });
    if (request.method === 'POST' || request.method === 'PUT') {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        response.setHeader('Content-Type', 'application/json');
        if (path === '/auth/refresh-access-token') response.end(JSON.stringify({ accessToken: 'test-access-token' }));
        else if (path === '/assets/acme/models/prepare-upload')
          response.end(JSON.stringify({ uploadToken: 'test-upload', uploadUrl: `${host}/upload` }));
        else if (path === '/upload') {
          uploadBytes = Buffer.concat(chunks);
          response.end('{}');
        } else if (path === '/assets/acme/models' || path === '/assets/acme/models/chair/versions') {
          publication = JSON.parse(Buffer.concat(chunks).toString());
          if (rejectPublication) {
            response.writeHead(400);
            response.end(JSON.stringify({ message: 'External resources are not allowed' }));
          } else response.end(JSON.stringify(assetResponse(publication!.version as string)));
        } else {
          response.writeHead(404);
          response.end('{}');
        }
      });
      return;
    }
    if (path.startsWith('/assets/acme/models/chair')) {
      if (assetMissing) {
        response.writeHead(404);
        response.end('{}');
        return;
      }
      const selector = path.split('@')[1];
      const version = selector === undefined || selector === 'latest' ? latest : selector === '1' ? '1.9.0' : selector;
      response.setHeader('Content-Type', 'application/json');
      if (holdMetadata && version === '2.0.0') {
        const timer = setTimeout(() => releaseMetadata?.(), 1500);
        releaseMetadata = () => {
          clearTimeout(timer);
          releaseMetadata = undefined;
          response.end(JSON.stringify(assetResponse(version)));
        };
      } else if (metadataDelay) {
        metadataActive++;
        metadataPeak = Math.max(metadataPeak, metadataActive);
        setTimeout(() => {
          metadataActive--;
          response.end(JSON.stringify(assetResponse(version)));
        }, metadataDelay);
      } else response.end(JSON.stringify(assetResponse(version)));
    } else if (path === `/files/${oid}`) {
      if (releaseMetadata) {
        downloadBeforeMetadata = true;
        releaseMetadata();
      }
      response.writeHead(failDownloads ? 503 : 200);
      response.end(serveCorrupt ? 'wrong bytes' : nativeBytes);
    } else if (path === '/external-v2.glb') {
      response.end('bytes from the second URL');
    } else if (path === '/external.glb') {
      response.writeHead(failDownloads ? 503 : 200);
      response.end(urlBytes);
    } else if (path === '/interrupted.glb') {
      response.writeHead(200, { 'Content-Length': 100 });
      response.write('partial');
      setTimeout(() => response.destroy(), 5);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'loa-manager-cli-'));
  store = join(root, 'store');
  requests = [];
  metadataDelay = 0;
  metadataActive = 0;
  metadataPeak = 0;
  holdMetadata = false;
  releaseMetadata = undefined;
  downloadBeforeMetadata = false;
  urlBytes = 'external version one';
  serveCorrupt = false;
  latest = '1.0.0';
  failDownloads = false;
  assetMissing = false;
  rejectPublication = false;
  uploadBytes = undefined;
  publication = undefined;
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// Each workflow launches several real CLI processes; shared CI runners need time for their startup.
describe('asset manager executable', { timeout: 20_000 }, () => {
  it.each([true, false])(
    'publishes %s-new assets using authenticated APIs without changing the consuming manifest',
    async (newAsset) => {
      assetMissing = newAsset;
      await writeFile(join(root, 'chair.glb'), 'bytes validated by web service');
      await run(['publish', './chair.glb', '--to', 'acme/models/chair', '--version', '2.0.0']);
      expect(uploadBytes?.toString()).toBe('bytes validated by web service');
      expect(publication).toMatchObject({ version: '2.0.0', uploadToken: 'test-upload' });
      expect(
        requests.find((r) => r.path === (newAsset ? '/assets/acme/models' : '/assets/acme/models/chair/versions'))
          ?.auth,
      ).toBe('Bearer test-access-token');
      expect(await readdir(root)).not.toContain('assets.json');
      expect(requests.find((r) => r.path === '/upload')?.auth).toBeUndefined();
    },
  );
  it('leaves self-contained publication validation to the web service and propagates rejection', async () => {
    rejectPublication = true;
    await writeFile(join(root, 'chair.glb'), 'not a self-contained glb');
    await expect(run(['publish', './chair.glb', '--to', 'acme/models/chair', '--version', '2.0.0'])).rejects.toThrow();
    expect(uploadBytes?.toString()).toBe('not a self-contained glb');
    expect(publication?.version).toBe('2.0.0');
  });
  it.each(['pull', 'install'])(
    'adds and resolves a native asset via %s, then reuses verified bytes offline',
    async (command) => {
      await run(['add', 'acme/models/chair', '--as', 'chair']);
      expect(requests.map((r) => r.path)).toEqual(['/assets/acme/models/chair']);
      expect(await readdir(root)).not.toContain('store');
      await run([command, '--frozen-lockfile']);
      const project = await loadProject(root);
      const entry = project.lock!.importers['.']!.assets.chair as NativeAsset;
      expect(await readFile(join(root, relativeAssetPath(entry, 'chair')))).toEqual(nativeBytes);
      expect(await readFile(contentPath(store, nativeHashHex(entry.hash)))).toEqual(nativeBytes);
      expect(requests.every((r) => r.auth === undefined)).toBe(true);
      requests = [];
      failDownloads = true;
      await run([command, '--frozen-lockfile'], { LOA_HOST: 'http://127.0.0.1:1' });
      await run(['resolve', '--mode', 'local']);
      expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8')).chair).toBe(
        `/${relativeAssetPath(entry, 'chair')}`,
      );
      expect(requests).toEqual([]);
      await run(['resolve', '--mode', 'remote']);
      expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8')).chair).toBe(
        `${host}/files/${oid}`,
      );
    },
  );
  it.each(['pull', 'install'])(
    'does not fetch URL additions; %s reuses project cache until explicit refresh',
    async (command) => {
      await run(['add', `${host}/external.glb`, '--as', 'external']);
      expect(requests).toEqual([]);
      await run([command]);
      const entry = (await loadProject(root)).lock!.importers['.']!.assets.external as UrlAsset;
      const destination = join(root, relativeAssetPath(entry, entry.kind === 'url' ? 'external' : 'chair'));
      expect(await readFile(destination, 'utf8')).toBe('external version one');
      expect(await readdir(root)).not.toContain('store');
      urlBytes = 'external version two';
      await run([command, '--frozen-lockfile']);
      expect(requests).toHaveLength(1);
      expect(await readFile(destination, 'utf8')).toBe('external version one');
      await run([command, '--refresh']);
      expect(await readFile(destination, 'utf8')).toBe('external version two');
      expect(requests.every((r) => r.auth === undefined)).toBe(true);
    },
  );
  it('pulls native and direct URL assets into one project cache while globally storing only native bytes', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['add', `${host}/external.glb`, '--as', 'external']);
    await run(['pull', '--frozen-lockfile']);
    const assets = (await loadProject(root)).lock!.importers['.']!.assets;
    for (const alias of ['chair', 'external']) {
      const entry = assets[alias]!;
      if (entry.kind === 'file') throw new Error('Expected pulled test asset');
      expect(relativeAssetPath(entry, entry.kind === 'url' ? 'external' : 'chair').split('/')[0]).toBe('assets');
      expect(
        await readFile(join(root, relativeAssetPath(entry, entry.kind === 'url' ? 'external' : 'chair')), 'utf8'),
      ).toBe(entry.kind === 'loa' ? nativeBytes.toString() : urlBytes);
    }
    expect((await verifyStore(store)).checked).toBe(1);
    expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(
      '/assets/\n/asset-resolution.json\n/assets.local.json\n',
    );
  });
  it('automatically resolves each asset locally when present and remotely when absent without fetching', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['add', `${host}/external.glb`, '--as', 'external']);
    const assets = (await loadProject(root)).lock!.importers['.']!.assets;
    requests = [];
    await run(['resolve']);
    expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8'))).toEqual({
      chair: `${host}/files/${oid}`,
      external: `${host}/external.glb`,
    });
    await pullAsset(assets.chair!, root, store, false, undefined, 'assets/chair.glb');
    requests = [];
    await run(['resolve', '--base-url', '/demo/']);
    const native = assets.chair as NativeAsset;
    expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8'))).toEqual({
      chair: `/demo/${relativeAssetPath(native, 'chair')}`,
      external: `${host}/external.glb`,
    });
    expect(requests).toEqual([]);
    await pullAsset(assets.external!, root, store, false, undefined, 'assets/external.glb');
    requests = [];
    await run(['resolve']);
    expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8'))).toEqual({
      chair: `/${relativeAssetPath(native, 'chair')}`,
      external: `/${relativeAssetPath(assets.external as UrlAsset, 'external')}`,
    });
    expect(requests).toEqual([]);
  });
  it('refuses corrupted local native bytes during auto resolution and preserves the previous map', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['pull']);
    await run(['resolve']);
    const previous = await readFile(join(root, 'asset-resolution.json'), 'utf8');
    const entry = (await loadProject(root)).lock!.importers['.']!.assets.chair as NativeAsset;
    const path = join(root, relativeAssetPath(entry, 'chair'));
    await chmod(path, 0o644);
    await writeFile(path, 'damaged native');
    requests = [];
    await expect(run(['resolve'])).rejects.toThrow('integrity mismatch');
    expect(await readFile(join(root, 'asset-resolution.json'), 'utf8')).toBe(previous);
    expect(requests).toEqual([]);
  });
  it('keeps file: sources live and pull never reads, hashes, copies or requires them', async () => {
    await writeFile(join(root, 'chair.glb'), 'original');
    await run(['add', './chair.glb', '--as', 'chair']);
    await writeFile(join(root, 'chair.glb'), 'edited live');
    await run(['pull', '--frozen-lockfile']);
    expect(await readFile(join(root, 'chair.glb'), 'utf8')).toBe('edited live');
    await rm(join(root, 'chair.glb'));
    await run(['pull', '--frozen-lockfile']);
    expect(requests).toEqual([]);
    expect(await readdir(root)).not.toContain('store');
    expect(await readdir(root)).not.toContain('assets');
  });
  it.each(['chair', 'acme/models/chair'])(
    'updates exact pins only with --latest and keeps full refs for alias %s',
    async (alias) => {
      await run(['add', 'acme/models/chair', '--as', alias]);
      latest = '2.0.0';
      const outdated = await run(['outdated']);
      expect(JSON.parse(outdated.stdout)).toEqual([{ alias, current: '1.0.0', latest: '2.0.0' }]);
      await run(['update', alias]);
      expect((await loadProject(root)).lock!.importers['.']!.assets[alias]).toMatchObject({ version: '1.0.0' });
      await run(['update', alias, '--latest']);
      expect((await loadProject(root)).manifests['.']!.assets[alias]).toBe(
        alias === 'acme/models/chair' ? '2.0.0' : 'acme/models/chair@2.0.0',
      );
    },
  );
  it('removes manifest and lock bindings without deleting cached native bytes; prune then removes unused content', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['pull']);
    await run(['remove', 'chair']);
    expect((await loadProject(root)).manifests['.']!.assets).toEqual({});
    expect((await loadProject(root)).lock!.importers['.']!.assets).toEqual({});
    expect((await verifyStore(store)).checked).toBe(1);
    await run(['store', 'prune']);
    expect((await verifyStore(store)).checked).toBe(0);
  });
  it('rejects altered manifests in frozen mode before fetching or changing files', async () => {
    await run(['add', `${host}/external.glb`, '--as', 'external']);
    const project = await loadProject(root);
    project.manifests['.']!.assets.external = `${host}/other.glb`;
    await writeFile(join(root, 'assets.json'), JSON.stringify(project.manifests['.']));
    await expect(run(['pull', '--frozen-lockfile'])).rejects.toThrow();
    expect(requests).toEqual([]);
    expect(await readdir(root)).not.toContain('assets');
  });
  it('never installs corrupt native downloads and cleans temporary files', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    serveCorrupt = true;
    await expect(run(['pull'])).rejects.toThrow();
    expect((await verifyStore(store)).checked).toBe(0);
    expect(await readdir(join(store, 'v1/sha256', oid.slice(0, 2)))).toEqual([]);
    expect(await readdir(join(root, 'assets'))).toEqual([]);
  });
  it('detects damaged cached content and repairs it from the registry bytes', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['pull']);
    const cached = contentPath(store, oid);
    await chmod(cached, 0o644);
    await writeFile(cached, 'damaged');
    expect((await verifyStore(store)).corrupt).toEqual([cached]);
    requests = [];
    await run(['pull', '--frozen-lockfile']);
    expect(requests.map((r) => r.path)).toEqual([`/files/${oid}`]);
    expect((await verifyStore(store)).corrupt).toEqual([]);
  });
  it('reports store integrity through store status and fails when cached native bytes are modified', async () => {
    expect((await run(['store', 'status'])).stdout).toContain('Verified 0 store files');
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['pull']);
    expect((await run(['store', 'status'])).stdout).toContain('Verified 1 store files');
    const cached = contentPath(store, oid);
    await chmod(cached, 0o644);
    await writeFile(cached, 'damaged');
    await expect(run(['store', 'status'])).rejects.toThrow('Corrupt store files');
  });
  it('cleans interrupted direct downloads without poisoning the cache', async () => {
    await run(['add', `${host}/interrupted.glb`, '--as', 'broken']);
    await expect(run(['pull'])).rejects.toThrow();
    expect(await readdir(join(root, 'assets'))).toEqual([]);
  });
  it('preserves existing URL downloads when a refresh fails', async () => {
    await run(['add', `${host}/external.glb`, '--as', 'external']);
    await run(['pull']);
    const entry = (await loadProject(root)).lock!.importers['.']!.assets.external as UrlAsset;
    failDownloads = true;
    await expect(run(['pull', '--refresh'])).rejects.toThrow();
    expect(
      await readFile(join(root, relativeAssetPath(entry, entry.kind === 'url' ? 'external' : 'chair')), 'utf8'),
    ).toBe('external version one');
  });
  it('fails closed on prune when a registered existing project has lost its lock', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['pull']);
    await rm(join(root, 'assets-lock.json'));
    await expect(pruneStore(store)).rejects.toThrow();
    expect((await verifyStore(store)).checked).toBe(1);
  });
  it('protects cache content referenced by another registered checkout', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    await run(['pull']);
    const other = await mkdtemp(join(tmpdir(), 'loa-other-project-'));
    try {
      await writeFile(join(other, 'assets-lock.json'), await readFile(join(root, 'assets-lock.json')));
      await registerProject(store, other);
      await run(['remove', 'chair']);
      expect(await pruneStore(store)).toBe(0);
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });
  it('supports concurrent native pulls into the same store without partial objects', async () => {
    await run(['add', 'acme/models/chair', '--as', 'chair']);
    const entry = (await loadProject(root)).lock!.importers['.']!.assets.chair!;
    await Promise.all([pullAsset(entry, root, store), pullAsset(entry, root, store)]);
    expect((await verifyStore(store)).corrupt).toEqual([]);
    expect(await readFile(contentPath(store, oid))).toEqual(nativeBytes);
  });
});

it('installs through the alias with clean non-interactive output', async () => {
  await run(['add', 'acme/models/chair@1.0.0', '--as', 'chair']);
  const result = await run(['install', '--frozen-lockfile']);
  expect(result.stdout).toContain('Assets are available locally (1 source,');
  expect(result.stdout).not.toContain('\x1b');
  expect(result.stderr).toBe('');
});

it('resolves local overrides without rewriting the lock or manifest', async () => {
  await run(['add', 'acme/models/chair@1.0.0', '--as', 'chair']);
  const before = await readFile(join(root, 'assets-lock.json'), 'utf8');
  await writeFile(join(root, 'draft.glb'), 'draft');
  await writeFile(join(root, 'assets.local.json'), JSON.stringify({ overrides: { chair: 'file:./draft.glb' } }));
  await run(['resolve', '--mode', 'remote']);
  expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8')).chair).toContain('/__loa/live/');
  expect(await readFile(join(root, 'assets-lock.json'), 'utf8')).toBe(before);
});

it('downloads one shared native hash for concurrent versions', async () => {
  await run(['add', 'acme/models/chair@1.0.0', '--as', 'chair']);
  const entry = (await loadProject(root)).lock!.importers['.']!.assets.chair as NativeAsset;
  await Promise.all([
    pullAsset(entry, root, store),
    pullAsset({ ...entry, version: '2.0.0', specifier: 'acme/models/chair@2.0.0' }, root, store),
  ]);
  expect(requests.filter((request) => request.path === `/files/${oid}`)).toHaveLength(1);
});

it('links canonical and short bindings directly to the global cache and repairs local copies', async () => {
  await run(['add', 'acme/models/chair@1.0.0']);
  await run(['add', 'acme/models/chair@1.0.0', '--as', 'furniture/chair']);
  await run(['install']);
  const alias = join(root, 'assets/furniture/chair.glb');
  expect((await lstat(alias)).isSymbolicLink()).toBe(true);
  await expectCacheLink(alias);
  await expectCacheLink(join(root, 'assets/acme/models/chair.glb'));
  expect(await readFile(alias)).toEqual(nativeBytes);
  await rm(alias);
  await writeFile(alias, 'old fallback copy');
  await run(['install', '--frozen-lockfile']);
  expect((await lstat(alias)).isSymbolicLink()).toBe(true);
  expect(await readFile(alias)).toEqual(nativeBytes);
});

it('rejects directory symlinks before writing outside the installed assets', async () => {
  await run(['add', 'acme/models/chair@1.0.0', '--as', 'chair']);
  await mkdir(join(root, 'outside'));
  await symlink(join(root, 'outside'), join(root, 'assets'), 'dir');
  await expect(run(['install'])).rejects.toThrow('must be a real directory');
  expect(await readdir(join(root, 'outside'))).toEqual([]);
});

it('keeps canonical and aliased versions independent at stable manifest-key paths', async () => {
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({
      name: 'two-versions',
      assets: {
        'acme/models/chair': '1.0.0',
        chair: 'acme/models/chair@2.0.0',
        same: 'acme/models/chair@1.0.0',
      },
    }),
  );
  await run(['install']);
  const canonical = join(root, 'assets/acme/models/chair.glb');
  const alias = join(root, 'assets/chair.glb');
  expect((await lstat(canonical)).isSymbolicLink()).toBe(true);
  expect((await lstat(alias)).isSymbolicLink()).toBe(true);
  await expectCacheLink(join(root, 'assets/same.glb'));
  const lock = (await loadProject(root)).lock!;
  expect(lock.importers['.']!.assets.chair).toMatchObject({ version: '2.0.0' });
  expect(lock.importers['.']!.assets['acme/models/chair']).toMatchObject({ version: '1.0.0' });
  // Give the second locked version distinct bytes, served from the global cache.
  const alternateBytes = Buffer.from('second published chair');
  const alternateHex = createHash('sha256').update(alternateBytes).digest('hex');
  const alternate = {
    ...(lock.importers['.']!.assets.chair as NativeAsset),
    hash: `sha256-${Buffer.from(alternateHex, 'hex').toString('base64')}`,
    remoteUrl: `${host}/files/${alternateHex}`,
  };
  const cached = contentPath(store, alternateHex);
  await mkdir(join(store, 'v1/sha256', alternateHex.slice(0, 2)), { recursive: true });
  await writeFile(cached, alternateBytes);
  lock.importers['.']!.assets.chair = alternate;
  await writeFile(join(root, 'assets-lock.json'), JSON.stringify(lock));
  await run(['install', '--frozen-lockfile']);
  expect(await readFile(canonical)).toEqual(nativeBytes);
  expect(await readFile(alias)).toEqual(alternateBytes);
  // Changing the canonical selection must leave the other alias on its original cache object.
  const manifest = JSON.parse(await readFile(join(root, 'assets.json'), 'utf8'));
  manifest.assets['acme/models/chair'] = '2.0.0';
  lock.importers['.']!.assets['acme/models/chair'] = alternate;
  await writeFile(join(root, 'assets.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'assets-lock.json'), JSON.stringify(lock));
  await run(['install', '--frozen-lockfile']);
  expect(await readFile(canonical)).toEqual(alternateBytes);
  expect(await readFile(alias)).toEqual(alternateBytes);
  expect(await readFile(join(root, 'assets/same.glb'))).toEqual(nativeBytes);
  await expectCacheLink(alias, alternateHex);
  expect(await readdir(join(root, 'assets'))).toEqual(['acme', 'chair.glb', 'same.glb']);
  await run(['resolve', '--mode', 'local']);
  expect(JSON.parse(await readFile(join(root, 'asset-resolution.json'), 'utf8'))).toEqual({
    'acme/models/chair': '/assets/acme/models/chair.glb',
    chair: '/assets/chair.glb',
    same: '/assets/same.glb',
  });
}, 15000);

it('refreshes a stable URL binding when its source URL changes', async () => {
  await run(['add', `${host}/external.glb`, '--as', 'external']);
  await run(['install']);
  expect(await readFile(join(root, 'assets/external.glb'), 'utf8')).toBe('external version one');
  await run(['add', `${host}/external-v2.glb`, '--as', 'external']);
  await run(['install']);
  expect(await readFile(join(root, 'assets/external.glb'), 'utf8')).toBe('bytes from the second URL');
});

it('uses install --parallel for metadata lookups as well as downloads', async () => {
  metadataDelay = 20;
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({
      name: 'parallel',
      assets: Object.fromEntries(
        Array.from({ length: 5 }, (_, index) => [`chair-${index}`, 'acme/models/chair@1.0.0']),
      ),
    }),
  );
  await run(['install', '--parallel', '2']);
  expect(metadataPeak).toBe(2);
  expect(metadataActive).toBe(0);
  expect(requests.filter((request) => request.path.startsWith('/assets/'))).toHaveLength(5);
  requests = [];
  await run(['install', '--parallel', '2', '--frozen-lockfile']);
  expect(requests).toEqual([]);
});

it('starts a queued download while another metadata lookup is still pending', async () => {
  holdMetadata = true;
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({
      name: 'pipeline',
      assets: {
        a: 'acme/models/chair@1.0.0',
        b: 'acme/models/chair@2.0.0',
        c: 'acme/models/chair@1.0.0',
      },
    }),
  );
  await run(['install', '--parallel', '2']);
  expect(downloadBeforeMetadata).toBe(true);
  expect(releaseMetadata).toBeUndefined();
  expect(await readFile(join(root, 'assets/a.glb'))).toEqual(nativeBytes);
  expect(await readFile(join(root, 'assets/b.glb'))).toEqual(nativeBytes);
  await expectCacheLink(join(root, 'assets/c.glb'));
  expect(requests.filter((request) => request.path.startsWith('/files/'))).toHaveLength(1);
});

it.each(['install', 'pull'])(
  '%s prunes obsolete trees, hidden files and symlinks without following them',
  async (command) => {
    await writeFile(
      join(root, 'assets.json'),
      JSON.stringify({ name: 'prune', assets: { 'old/chair': 'acme/models/chair@1.0.0' } }),
    );
    await run([command]);
    await mkdir(join(root, 'outside'));
    await writeFile(join(root, 'outside/keep.txt'), 'outside');
    await writeFile(join(root, 'assets/.orphan'), 'obsolete');
    await symlink(join(root, 'outside'), join(root, 'assets/obsolete-link'), 'dir');
    await symlink('missing.glb', join(root, 'assets/broken.glb'));
    await writeFile(
      join(root, 'assets.json'),
      JSON.stringify({ name: 'prune', assets: { 'new/chair': 'acme/models/chair@1.0.0' } }),
    );
    await run([command]);
    expect(await readdir(join(root, 'assets'))).toEqual(['new']);
    expect(await readFile(join(root, 'assets/new/chair.glb'))).toEqual(nativeBytes);
    expect(await readFile(join(root, 'outside/keep.txt'), 'utf8')).toBe('outside');
    expect((await verifyStore(store)).checked).toBe(1);
  },
  15000,
);

it('remove prunes one native binding and keeps other direct cache links usable', async () => {
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({
      name: 'aliases',
      assets: {
        'acme/models/chair': '1.0.0',
        'furniture/chair': 'acme/models/chair@1.0.0',
        seat: 'acme/models/chair@1.0.0',
      },
    }),
  );
  await run(['install']);
  await run(['remove', 'acme/models/chair']);
  expect(await readdir(join(root, 'assets'))).toEqual(['furniture', 'seat.glb']);
  expect(await readFile(join(root, 'assets/furniture/chair.glb'))).toEqual(nativeBytes);
  expect(await readFile(join(root, 'assets/seat.glb'))).toEqual(nativeBytes);
  await expectCacheLink(join(root, 'assets/seat.glb'));
  expect((await verifyStore(store)).checked).toBe(1);
});

it('remove preserves independent URL alias copies without redownloading and removes the last receipt', async () => {
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({ name: 'urls', assets: { a: `${host}/external.glb`, b: `${host}/external.glb` } }),
  );
  await run(['install']);
  urlBytes = 'changed remote bytes';
  requests = [];
  await run(['remove', 'a']);
  expect(await readdir(join(root, 'assets'))).toEqual(['.loa-urls.json', 'b.glb']);
  expect(await readFile(join(root, 'assets/b.glb'), 'utf8')).toBe('external version one');
  expect(requests).toEqual([]);
  await run(['remove', 'b']);
  expect(await readdir(join(root, 'assets'))).toEqual([]);
}, 15000);

it('remove retains bindings owned by the other workspace manifests', async () => {
  await mkdir(join(root, 'levels/lobby'), { recursive: true });
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({ name: 'world', workspaces: ['levels/*'], assets: { a: 'acme/models/chair@1.0.0' } }),
  );
  await writeFile(
    join(root, 'levels/lobby/assets.json'),
    JSON.stringify({ name: 'lobby', assets: { b: 'acme/models/chair@1.0.0' } }),
  );
  await run(['install']);
  await run(['remove', 'a']);
  expect(await readdir(join(root, 'assets'))).toEqual(['b.glb']);
  expect(await readFile(join(root, 'assets/b.glb'))).toEqual(nativeBytes);
  expect((await loadProject(root)).lock!.importers['levels/lobby']!.assets.b).toBeDefined();
});

it('reconciles file-to-directory and directory-to-file changes', async () => {
  const write = (assets: Record<string, string>) =>
    writeFile(join(root, 'assets.json'), JSON.stringify({ name: 'shape', assets }));
  await write({ shape: 'acme/models/chair@1.0.0' });
  await run(['install']);
  await write({ 'shape.glb/child': 'acme/models/chair@1.0.0' });
  await run(['install']);
  expect(await readFile(join(root, 'assets/shape.glb/child.glb'))).toEqual(nativeBytes);
  await write({ shape: 'acme/models/chair@1.0.0' });
  await run(['install']);
  expect(await readdir(join(root, 'assets'))).toEqual(['shape.glb']);
  expect(await readFile(join(root, 'assets/shape.glb'))).toEqual(nativeBytes);
}, 15000);

it('preserves tracked live files, local override files and a protected global store', async () => {
  await mkdir(join(root, 'assets/drafts'), { recursive: true });
  await writeFile(join(root, 'assets/live.glb'), 'live bytes');
  await writeFile(join(root, 'assets/drafts/override.glb'), 'draft bytes');
  await writeFile(join(root, 'assets/drafts/stale.glb'), 'stale');
  await writeFile(
    join(root, 'assets.local.json'),
    JSON.stringify({ overrides: { chair: 'file:./assets/drafts/override.glb' } }),
  );
  await writeFile(
    join(root, 'assets.json'),
    JSON.stringify({ name: 'live', assets: { chair: 'acme/models/chair@1.0.0', live: 'file:./assets/live.glb' } }),
  );
  const internalStore = join(root, 'assets/global-store');
  await run(['install'], { LOA_STORE_DIR: internalStore });
  expect(await readdir(join(root, 'assets/drafts'))).toEqual(['override.glb']);
  expect(await readFile(join(root, 'assets/live.glb'), 'utf8')).toBe('live bytes');
  expect(await readFile(join(root, 'assets/drafts/override.glb'), 'utf8')).toBe('draft bytes');
  expect((await verifyStore(internalStore)).checked).toBe(1);
});
