import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addAsset,
  loadProject,
  parseRef,
  resolveProject,
  resolveSource,
  serializeLock,
  type Registry,
} from './project.ts';

let root: string;
const host = 'https://api.example.com';
const hash = `sha256-${createHash('sha256').update('asset').digest('base64')}`;
const api: Registry = {
  resolve: vi.fn(async (_host, _ref, selector) => ({
    version: selector === '1' ? '1.9.0' : '2.0.0',
    hash,
    extension: '.glb',
    remoteUrl: `${_host}/files/${Buffer.from(hash.slice(7), 'base64').toString('hex')}`,
  })),
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'loa-project-'));
  vi.mocked(api.resolve).mockClear();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
async function manifest(directory: string, value: unknown) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'assets.json'), JSON.stringify(value));
}

describe('project asset selections', () => {
  it('pins a native ref with one metadata lookup and no asset download', async () => {
    await addAsset('acme/models/chair', 'chair', root, host, api);
    const project = await loadProject(root);
    expect(project.manifests['.']!.assets).toEqual({ chair: 'acme/models/chair@2.0.0' });
    expect(project.lock!.importers['.']!.assets.chair).toMatchObject({ kind: 'loa', hash, version: '2.0.0', host });
    expect(api.resolve).toHaveBeenCalledTimes(1);
  });
  it('writes a version selector when the canonical name is the binding', async () => {
    await addAsset('acme/models/chair', undefined, root, host, api);
    expect((await loadProject(root)).manifests['.']!.assets).toEqual({
      'acme/models/chair': '2.0.0',
    });
  });
  it.each(['2.0.0', '2', '2.3', 'latest'])(
    'accepts native version shorthand %s with a canonical key',
    async (value) => {
      await manifest(root, { name: 'showroom', assets: { 'acme/models/chair': value } });
      const project = await loadProject(root);
      const lock = await resolveProject(project, host, { api });
      expect(lock.importers['.']!.assets['acme/models/chair']).toMatchObject({
        specifier: `acme/models/chair@${value}`,
      });
      project.lock = lock;
      vi.mocked(api.resolve).mockClear();
      // The test registry returns an exact matching version for the frozen check.
      if (value !== '2.3') await expect(resolveProject(project, host, { frozen: true, api })).resolves.toEqual(lock);
    },
  );
  it('adds HTTP URLs without registry calls, hashes, or integrity fields', async () => {
    await addAsset('https://api.example.com/acme/models/chair@1.0.0', 'chair', root, host, api);
    const entry = (await loadProject(root)).lock!.importers['.']!.assets.chair;
    expect(entry).toEqual({
      kind: 'url',
      specifier: 'https://api.example.com/acme/models/chair@1.0.0',
      url: 'https://api.example.com/acme/models/chair@1.0.0',
      extension: '.0',
    });
    expect(api.resolve).not.toHaveBeenCalled();
  });
  it('keeps local files live without hashes or registry lookups, including paths without ./', async () => {
    await mkdir(join(root, 'models'));
    await writeFile(join(root, 'models/chair.glb'), 'first');
    await addAsset('models/chair.glb', 'chair', root, host, api);
    const entry = (await loadProject(root)).lock!.importers['.']!.assets.chair;
    expect(entry).toEqual({ kind: 'file', specifier: 'file:./models/chair.glb', path: './models/chair.glb' });
    await writeFile(join(root, 'models/chair.glb'), 'edited');
    const project = await loadProject(root);
    await expect(resolveProject(project, host, { frozen: true, api })).resolves.toEqual(project.lock);
    expect(api.resolve).not.toHaveBeenCalled();
  });
  it('discovers a root workspace and resolves file paths relative to its declaring manifest', async () => {
    await manifest(root, { name: 'root', assets: {}, workspaces: ['levels/*'] });
    const level = join(root, 'levels/lobby');
    await manifest(level, { name: 'lobby', assets: {} });
    await writeFile(join(root, 'logo.png'), 'live');
    await addAsset('../../logo.png', 'logo', level, host, api);
    const project = await loadProject(level);
    expect(project.root).toBe(root);
    expect(project.current).toBe('levels/lobby');
    expect(project.lock!.importers['levels/lobby']!.assets.logo).toMatchObject({
      kind: 'file',
      path: '../../logo.png',
    });
    expect(await readFile(join(root, 'assets.json'), 'utf8')).not.toContain('logo');
  });
  it('rejects duplicate workspace aliases before writing changes', async () => {
    await manifest(root, {
      name: 'root',
      assets: { chair: 'https://example.com/chair.glb' },
      workspaces: ['levels/*'],
    });
    const level = join(root, 'levels/lobby');
    await manifest(level, { name: 'lobby', assets: {} });
    await expect(addAsset('https://example.com/other.glb', 'chair', level, host, api)).rejects.toThrow(
      'Duplicate workspace alias',
    );
    expect(JSON.parse(await readFile(join(level, 'assets.json'), 'utf8')).assets).toEqual({});
  });
  it('reuses locked metadata offline, even when LOA_HOST changes', async () => {
    await addAsset('acme/models/chair', 'chair', root, host, api);
    const project = await loadProject(root);
    vi.mocked(api.resolve).mockClear();
    expect(await resolveProject(project, 'https://other.example.com', { frozen: true, api })).toEqual(project.lock);
    expect(api.resolve).not.toHaveBeenCalled();
  });
  it('frozen mode rejects changed, removed and missing lock entries without network calls', async () => {
    await addAsset('https://example.com/a.glb', 'chair', root, host, api);
    const project = await loadProject(root);
    project.manifests['.']!.assets.chair = 'https://example.com/b.glb';
    await expect(resolveProject(project, host, { frozen: true, api })).rejects.toThrow('Frozen lockfile');
    delete project.manifests['.']!.assets.chair;
    await expect(resolveProject(project, host, { frozen: true, api })).rejects.toThrow('Frozen lockfile');
    delete project.lock;
    await expect(resolveProject(project, host, { frozen: true, api })).rejects.toThrow('missing');
    expect(api.resolve).not.toHaveBeenCalled();
  });
  it('resolves floating versions only when explicitly updated', async () => {
    await addAsset('acme/models/chair@1', 'chair', root, host, api);
    const project = await loadProject(root);
    vi.mocked(api.resolve).mockClear();
    const lock = await resolveProject(project, host, { update: new Set(['chair']), api });
    expect(lock.importers['.']!.assets.chair).toMatchObject({ version: '1.9.0', specifier: 'acme/models/chair@1' });
    expect(api.resolve).toHaveBeenCalledWith(host, 'acme/models/chair', '1');
  });
  it('rejects locks whose native ref or version disagrees with the manifest even when specifier text matches', async () => {
    await addAsset('acme/models/chair', 'chair', root, host, api);
    const project = await loadProject(root);
    const entry = project.lock!.importers['.']!.assets.chair!;
    if (entry.kind !== 'loa') throw new Error('Expected native test asset');
    entry.version = '3.0.0';
    await expect(resolveProject(project, host, { frozen: true, api })).rejects.toThrow('Frozen lockfile');
    entry.version = '2.0.0';
    entry.ref = 'acme/models/sofa';
    await expect(resolveProject(project, host, { frozen: true, api })).rejects.toThrow('Frozen lockfile');
  });
  it('serializes one asset entry per line in sorted order, with a final newline', async () => {
    await addAsset('https://example.com/z.glb', 'z', root, host, api);
    await addAsset('https://example.com/a.glb', 'a', root, host, api);
    const lock = (await loadProject(root)).lock!;
    const text = serializeLock(lock);
    expect(text.indexOf('"a":')).toBeLessThan(text.indexOf('"z":'));
    expect(text.split('\n').find((line) => line.includes('"a":'))).toContain('"kind":"url"');
    expect(text.endsWith('\n')).toBe(true);
  });
  it.each(['acme/chair', 'acme/project/../chair', 'acme/project/chair@1@2', 'acme/project/chair@^1'])(
    'rejects invalid native ref %s',
    (value) => {
      expect(() => parseRef(value)).toThrow();
    },
  );
  it.each(['file:/tmp/a.glb', 'file:C:/a.glb', 'file:..\\a.glb', 'https://user:secret@example.com/a.glb'])(
    'rejects nonportable or credential-bearing source %s',
    async (value) => {
      await expect(resolveSource(value, host, api)).rejects.toThrow();
    },
  );
});
