import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const oid = 'a'.repeat(64);
const bytes = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
const cli = fileURLToPath(new URL('../../../dist/bin/threeify.js', import.meta.url));
let server: Server;
let host: string;
let home: string;
let status: number;
let abort: boolean;
let requests: { url?: string; auth?: string }[];

async function run(args: string[]) {
  return promisify(execFile)(process.execPath, [cli, 'files', 'download', ...args], {
    cwd: home,
    env: { ...process.env, HOME: home, LOA_HOST: host, LOA_TOKEN: 'unused-secret-token' },
  });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push({ url: req.url, auth: req.headers.authorization });
    res.writeHead(status, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length });
    if (abort) {
      res.write(bytes.subarray(0, 2));
      setTimeout(() => res.destroy(), 10);
    } else {
      res.end(bytes);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'loa-files-test-'));
  await mkdir(join(home, '.config', 'loa'), { recursive: true });
  await writeFile(
    join(home, '.config', 'loa', 'config.json'),
    JSON.stringify({
      host: 'http://unused.invalid',
      auth: { type: 'session', token: 'unused-session-token' },
    }),
  );
  requests = [];
  status = 200;
  abort = false;
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe('files download executable', () => {
  it('streams exact binary bytes using the environment host without sending credentials', async () => {
    const { stdout } = await run([oid, '--output', 'generated.glb']);
    expect(await readFile(join(home, 'generated.glb'))).toEqual(bytes);
    expect(requests).toEqual([{ url: `/files/${oid}`, auth: undefined }]);
    expect(stdout).toContain('Downloaded to generated.glb');
  });
  it('defaults the output filename to the OID', async () => {
    await run([oid]);
    expect(await readFile(join(home, oid))).toEqual(bytes);
  });
  it('works without login and uses the persisted host when no override is set', async () => {
    await writeFile(join(home, '.config', 'loa', 'config.json'), JSON.stringify({ host }));
    await promisify(execFile)(process.execPath, [cli, 'files', 'download', oid, '-o', 'file.bin'], {
      cwd: home,
      env: { ...process.env, HOME: home, LOA_HOST: '', LOA_TOKEN: '' },
    });
    expect(await readFile(join(home, 'file.bin'))).toEqual(bytes);
    expect(requests).toEqual([{ url: `/files/${oid}`, auth: undefined }]);
  });
  it('preserves an existing output file without making a request', async () => {
    await writeFile(join(home, 'existing.bin'), 'original');
    await expect(run([oid, '-o', 'existing.bin'])).rejects.toThrow();
    expect(await readFile(join(home, 'existing.bin'), 'utf8')).toBe('original');
    expect(requests).toHaveLength(0);
  });
  it.each(['abc', 'A'.repeat(64), '../file', 'g'.repeat(64)])('rejects invalid OID %s', async (id) => {
    await expect(run([id])).rejects.toThrow();
    expect(requests).toHaveLength(0);
    expect(await readdir(home)).toEqual(['.config']);
  });
  it.each([404, 500])('removes the output on HTTP %s', async (code) => {
    status = code;
    await expect(run([oid, '-o', 'failed.bin'])).rejects.toThrow();
    expect(await readdir(home)).toEqual(['.config']);
  });
  it('removes partial output after a connection failure', async () => {
    abort = true;
    await expect(run([oid, '-o', 'partial.bin'])).rejects.toThrow();
    expect(await readdir(home)).toEqual(['.config']);
  });
});
