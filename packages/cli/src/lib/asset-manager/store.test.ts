import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  lstat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installAlias, materialize, storePath } from './store.ts';

vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), platform: () => 'win32' }));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  return { ...fs, copyFile: vi.fn(fs.copyFile), rename: vi.fn(fs.rename), symlink: vi.fn(fs.symlink) };
});
const roots: string[] = [];
afterEach(async () => {
  vi.mocked(rename).mockClear();
  vi.mocked(symlink).mockReset();
  vi.mocked(copyFile).mockClear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Windows native materialization', () => {
  it('replaces a read-only destination without changing source bytes or source permissions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'loa-win-replace-'));
    roots.push(root);
    const source = join(root, 'source');
    const destination = join(root, 'destination');
    await writeFile(source, 'new native bytes');
    await chmod(source, 0o444);
    await writeFile(destination, 'old native bytes');
    await chmod(destination, 0o444);
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('Read-only destination'), { code: 'EPERM' }));
    await materialize(source, destination);
    expect(await readFile(destination, 'utf8')).toBe('new native bytes');
    expect(await readFile(source, 'utf8')).toBe('new native bytes');
    expect((await stat(source)).mode & 0o222).toBe(0);
    expect(await readdir(root)).toEqual(['destination', 'source']);
  });
  it('preserves the existing destination if replacement fails for an unrelated reason', async () => {
    const root = await mkdtemp(join(tmpdir(), 'loa-win-failure-'));
    roots.push(root);
    const source = join(root, 'source');
    const destination = join(root, 'destination');
    await writeFile(source, 'new');
    await writeFile(destination, 'old');
    vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error('Disk failure'), { code: 'EIO' }));
    await expect(materialize(source, destination)).rejects.toThrow('Disk failure');
    expect(await readFile(destination, 'utf8')).toBe('old');
    expect(await readdir(root)).toEqual(['destination', 'source']);
  });
  it('respects the explicit store override and Windows local cache default', () => {
    expect(storePath({ LOA_STORE_DIR: '/explicit/store' })).toContain('explicit/store');
    expect(storePath({ LOCALAPPDATA: '/local-appdata' })).toBe('/local-appdata/loa/Cache');
  });
});

it('isolates edits and deletion from the store when cloning is unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loa-copy-fallback-'));
  roots.push(root);
  const source = join(root, 'source');
  const destination = join(root, 'destination');
  await writeFile(source, 'published bytes');
  await chmod(source, 0o444);
  vi.mocked(copyFile).mockRejectedValueOnce(Object.assign(new Error('No reflinks'), { code: 'ENOTSUP' }));
  await materialize(source, destination);
  expect((await stat(destination)).ino).not.toBe((await stat(source)).ino);
  await chmod(destination, 0o644);
  await writeFile(destination, 'local edits');
  expect(await readFile(source, 'utf8')).toBe('published bytes');
  expect((await stat(source)).mode & 0o222).toBe(0);
  await rm(destination);
  expect(await readFile(source, 'utf8')).toBe('published bytes');
});

it('falls back to an independent alias copy when symlinks are unavailable and refreshes that copy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loa-alias-copy-'));
  roots.push(root);
  const entry = {
    kind: 'url' as const,
    specifier: 'https://example.com/chair',
    url: 'https://example.com/chair',
    extension: '.glb',
  };
  const { relativeAssetPath } = await import('@landofassets/runtime/node');
  const source = join(root, relativeAssetPath(entry));
  await mkdir(dirname(source), { recursive: true });
  await writeFile(source, 'first');
  vi.mocked(symlink).mockRejectedValue(Object.assign(new Error('Privilege unavailable'), { code: 'EPERM' }));
  await installAlias(root, 'chair', entry);
  const alias = join(root, 'assets/chair.glb');
  expect((await lstat(alias)).isSymbolicLink()).toBe(false);
  expect(await readFile(alias, 'utf8')).toBe('first');
  await writeFile(source, 'second');
  await installAlias(root, 'chair', entry);
  expect(await readFile(alias, 'utf8')).toBe('second');
});
