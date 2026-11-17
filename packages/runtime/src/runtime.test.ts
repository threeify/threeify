import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build, createServer } from 'vite';
import { createLoaResolver, loadLoaResolver, loaResolver } from './index.js';
import { buildResolution, liveAssetUrl, nativeHashHex, parseLockfile, relativeAssetPath } from './node.js';
import type { Lockfile, NativeAsset } from './types.js';
import { loa } from './vite.js';

const bytes = Buffer.from('immutable glb test payload');
const hex = createHash('sha256').update(bytes).digest('hex');
const native: NativeAsset = {
  kind: 'loa',
  specifier: 'acme/models/chair@1.0.0',
  host: 'https://api.landofassets.com',
  ref: 'acme/models/chair',
  version: '1.0.0',
  hash: `sha256-${Buffer.from(hex, 'hex').toString('base64')}`,
  remoteUrl: `https://api.landofassets.com/files/${hex}`,
  extension: '.glb',
};
function lock(): Lockfile {
  return {
    lockfileVersion: 1,
    importers: {
      '.': {
        name: 'showroom',
        assets: {
          chair: native,
          remote: {
            kind: 'url',
            specifier: 'https://example.com/chair@1.0.0',
            url: 'https://example.com/chair@1.0.0',
            extension: '.glb',
          },
          logo: { kind: 'file', specifier: 'file:./brand/logo.png', path: './brand/logo.png' },
        },
      },
    },
  };
}
const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'loa-runtime-'));
  roots.push(root);
  const value = lock();
  await writeFile(join(root, 'assets-lock.json'), JSON.stringify(value));
  await mkdir(join(root, 'brand'));
  await writeFile(join(root, 'brand/logo.png'), 'logo bytes');
  await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(join(root, 'main.js'), 'import resolution from "virtual:loa"; console.log(resolution);');
  return { root, value };
}
async function materialize(root: string, value: Lockfile) {
  for (const importer of Object.values(value.importers)) {
    for (const entry of Object.values(importer.assets)) {
      if (entry.kind === 'file') continue;
      const path = join(root, relativeAssetPath(entry));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, entry.kind === 'loa' ? bytes : 'mutable URL bytes');
    }
  }
}

describe('browser resolver', () => {
  it('always returns promises and rejects invalid in-memory maps asynchronously', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const pending = loaResolver({ resolution: { chair: '/chair.glb' } });
    expect(pending).toBeInstanceOf(Promise);
    expect((await pending).url('chair')).toBe('/chair.glb');
    expect(fetch).not.toHaveBeenCalled();
    const invalid = loaResolver({ resolution: { chair: '' } });
    expect(invalid).toBeInstanceOf(Promise);
    await expect(invalid).rejects.toThrow('Invalid URL for asset chair');
  });
  it('retains the existing resolver entry points for compatibility', async () => {
    const resolution = { chair: '/chair.glb' };
    expect(createLoaResolver({ resolution }).url('chair')).toBe('/chair.glb');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(resolution))));
    expect((await loadLoaResolver('/map.json')).url('chair')).toBe('/chair.glb');
  });

  it('resolves aliases and leaves decoder, blob and ordinary URLs unchanged', async () => {
    const resolver = await loaResolver({ resolution: { chair: '/chair.glb', toString: '/safe.glb' } });
    expect(resolver.url('chair')).toBe('/chair.glb');
    expect(resolver.urlModifier('loa:chair')).toBe('/chair.glb');
    expect(resolver.url('toString')).toBe('/safe.glb');
    for (const value of ['draco/decoder.wasm', 'https://example.com/image.png', 'blob:embedded'])
      expect(resolver.urlModifier(value)).toBe(value);
    expect(() => resolver.urlModifier('loa:missing')).toThrow('Unknown LoA asset alias');
    expect(() => resolver.url('constructor')).toThrow('Unknown LoA asset alias');
  });
  it('loads plain JSON maps and reports failed or invalid responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ chair: '/chair.glb' }))));
    expect((await loadLoaResolver('/map.json')).url('chair')).toBe('/chair.glb');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(loadLoaResolver('/map.json')).rejects.toThrow('HTTP 404');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]')));
    await expect(loadLoaResolver('/map.json')).rejects.toThrow('Invalid LoA resolution map');
  });
});

describe('lock resolution', () => {
  it('keeps direct URLs remote even when they look like registry references', () => {
    const resolution = buildResolution(parseLockfile(lock()), { mode: 'remote', baseUrl: '/demo/' });
    expect(resolution.chair).toBe(native.remoteUrl);
    expect(resolution.remote).toBe('https://example.com/chair@1.0.0');
    expect(resolution.logo).toBe(`/demo/${liveAssetUrl('.', 'logo')}`);
    const local = buildResolution(lock(), { mode: 'local', baseUrl: '/demo/' });
    expect(local.chair).toContain('/demo/asset_cache/');
    expect(local.remote).toContain('/demo/asset_cache/');
    expect(local.logo).toBe(resolution.logo);
  });
  it('separates native host identity and keys URL cache entries by URL', () => {
    const other = { ...native, host: 'https://other.example', remoteUrl: `https://other.example/files/${hex}` };
    expect(relativeAssetPath(native)).not.toBe(relativeAssetPath(other));
    expect(relativeAssetPath(native)).toContain(`${native.ref}/${native.version}/${hex}.glb`);
  });
  it('rejects invalid hashes, mismatched native URLs, and unsafe importer paths', () => {
    expect(nativeHashHex(native.hash)).toBe(hex);
    for (const hash of ['sha256-bad', `sha256-${hex}`, `sha256-${'A'.repeat(42)}B=`])
      expect(() => nativeHashHex(hash)).toThrow();
    const broken = lock();
    broken.importers['.']!.assets.chair = { ...native, remoteUrl: 'https://evil.example/chair.glb' };
    expect(() => parseLockfile(broken)).toThrow('must match');
    const invalid = lock();
    invalid.importers['../outside'] = invalid.importers['.']!;
    expect(() => parseLockfile(invalid)).toThrow('Invalid importer');
  });
  it('rejects bare-version native source shorthand in locks', () => {
    const value = lock();
    value.importers['.']!.assets.chair = { ...native, specifier: '1.0.0' };
    expect(() => parseLockfile(value)).toThrow('full org/project/asset ref');
  });
  it('rejects absolute or inconsistent live paths and URL substitutions', () => {
    for (const path of ['/etc/passwd', 'C:/secret.png', '..\\secret.png']) {
      const value = lock();
      value.importers['.']!.assets.logo = { kind: 'file', specifier: `file:${path}`, path };
      expect(() => parseLockfile(value)).toThrow('portable relative paths');
    }
    const live = lock();
    live.importers['.']!.assets.logo = { kind: 'file', specifier: 'file:./logo.png', path: '../secret.png' };
    expect(() => parseLockfile(live)).toThrow('must match');
    const direct = lock();
    direct.importers['.']!.assets.remote = {
      kind: 'url',
      specifier: 'https://example.com/original.png',
      url: 'https://other.example/substitution.png',
      extension: '.png',
    };
    expect(() => parseLockfile(direct)).toThrow('must match');
    const parent = lock();
    parent.importers['.']!.assets.logo = {
      kind: 'file',
      specifier: 'file:../brand/logo.png',
      path: '../brand/logo.png',
    };
    expect(parseLockfile(parent).importers['.']!.assets.logo!.kind).toBe('file');
  });
  it('rejects duplicate aliases across workspaces', () => {
    const value = lock();
    value.importers['levels/lobby'] = { name: 'lobby', assets: { chair: native } };
    expect(() => buildResolution(value, { mode: 'remote' })).toThrow('Duplicate workspace asset alias: chair');
  });
});

describe('Vite integration', () => {
  it('bundles live files in remote mode without requiring native or URL downloads', async () => {
    const { root } = await fixture();
    const result = await build({
      root,
      configFile: false,
      base: '/showroom/',
      logLevel: 'silent',
      plugins: [loa()],
      build: { write: false, minify: false, assetsInlineLimit: 0 },
    });
    const output = (Array.isArray(result) ? result[0] : result) as {
      output: { type: string; code?: string; source?: string | Uint8Array }[];
    };
    const code = output.output.find((item) => item.type === 'chunk')!.code!;
    expect(code).toContain(native.remoteUrl);
    expect(code).toContain('https://example.com/chair@1.0.0');
    expect(code).toContain('/showroom/assets/loa-');
    expect(output.output.filter((item) => item.type === 'asset')).toHaveLength(2); // HTML + live logo.
  });
  it('emits all cached and live bytes in local mode with relative deploy bases', async () => {
    const { root, value } = await fixture();
    await materialize(root, value);
    const result = await build({
      root,
      configFile: false,
      base: './',
      logLevel: 'silent',
      plugins: [loa({ mode: 'local' })],
      build: { write: false, minify: false, assetsInlineLimit: 0 },
    });
    const output = (Array.isArray(result) ? result[0] : result) as {
      output: { type: string; code?: string; source?: string | Uint8Array }[];
    };
    const code = output.output.find((item) => item.type === 'chunk')!.code!;
    expect(code).not.toContain(native.remoteUrl);
    expect(code).not.toContain('https://example.com');
    expect(output.output.filter((item) => item.type === 'asset')).toHaveLength(4);
    expect(code).toContain('import.meta.url');
  });
  it('rejects corrupted native bytes during a local build', async () => {
    const { root, value } = await fixture();
    await materialize(root, value);
    await writeFile(join(root, relativeAssetPath(native)), 'corrupted');
    await expect(
      build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [loa({ mode: 'local' })],
        build: { write: false },
      }),
    ).rejects.toThrow('integrity mismatch');
  });
  it('serves only locked files, reads live files on every request, and verifies native bytes', async () => {
    const { root, value } = await fixture();
    await materialize(root, value);
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      base: '/demo/',
      plugins: [loa({ mode: 'local' })],
      server: { host: '127.0.0.1', port: 0 },
    });
    try {
      await server.listen();
      const address = server.httpServer!.address();
      if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
      const origin = `http://127.0.0.1:${address.port}`;
      const live = `${origin}/demo/${liveAssetUrl('.', 'logo')}`;
      expect(await (await fetch(live)).text()).toBe('logo bytes');
      await writeFile(join(root, 'brand/logo.png'), 'edited live bytes');
      expect(await (await fetch(live)).text()).toBe('edited live bytes');
      expect(await (await fetch(`${origin}/demo/${relativeAssetPath(native)}`)).text()).toBe(bytes.toString());
      await writeFile(join(root, relativeAssetPath(native)), 'corrupted');
      expect((await fetch(`${origin}/demo/${relativeAssetPath(native)}`)).status).toBe(500);
      expect((await fetch(`${origin}/demo/__loa/live/not-locked`)).status).toBe(404);
      expect(await readFile(join(root, 'brand/logo.png'), 'utf8')).toBe('edited live bytes');
    } finally {
      await server.close();
    }
  });
});
