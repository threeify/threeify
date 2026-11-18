import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Enums } from '@threeify/sdk';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../../dist/bin/threeify.js', import.meta.url));
const bytes = Buffer.from('original bytes from bucket');
let server: Server;
let host: string;
let home: string;
let assetName: string;
let extension: string;
let selectedVersion: string;
let requests: string[];

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url!, host).pathname);
    requests.push(`${req.method} ${path}`);
    if (path.startsWith('/assets/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 1,
          name: assetName,
          type: 'MODEL',
          visibility: 'PUBLIC',
          projectId: 1,
          projectName: 'Project',
          orgId: 1,
          orgName: 'Org',
          description: '',
          keywords: '',
          shareLicense: Enums.ShareLicense[0],
          commentMode: 'ENABLED',
          reported: false,
          likeCount: 0,
          shareCount: 0,
          createdAt: '2026-11-05T00:00:00.000Z',
          updatedAt: '2026-11-05T00:00:00.000Z',
          archived: false,
          metadata: '',
          version: selectedVersion,
          latestVersion: '1.0.0',
          versionId: 1,
          originalExtension: extension,
          fileOid: 'a'.repeat(64),
        }),
      );
    } else if (req.method === 'POST') {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'SUCCESS' }));
    } else if (path.startsWith('/media/')) {
      res.writeHead(302, { Location: '/files/opaque-hash' });
      res.end();
    } else if (path.startsWith('/files/')) {
      res.writeHead(302, { Location: '/bucket/object' });
      res.end();
    } else if (path === '/bucket/object') {
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': 'attachment; filename="opaque-hash.glb"',
      });
      res.end(bytes);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(
  async () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
);
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'loa-asset-filename-'));
  assetName = 'Chair';
  selectedVersion = '1.0.0';
  requests = [];
  extension = '.glb';
  await mkdir(join(home, '.config', 'loa'), { recursive: true });
  await writeFile(join(home, '.config', 'loa', 'config.json'), JSON.stringify({ org: 'Org', project: 'Project' }));
});
afterEach(async () => rm(home, { recursive: true, force: true }));
async function run(extra: string[] = [], commandName = 'download', explicitIdentity = true) {
  return promisify(execFile)(
    process.execPath,
    [
      cli,
      'assets',
      commandName,
      ...(explicitIdentity ? ['--org', 'Org', '--project', 'Project', '--asset', assetName] : []),
      ...extra,
    ],
    {
      cwd: home,
      env: { ...process.env, HOME: home, LOA_HOST: host, LOA_TOKEN: '' },
    },
  );
}

describe('asset download local filenames', () => {
  it('names original downloads using the asset and original extension', async () => {
    await run();
    expect(await readFile(join(home, 'Chair.glb'))).toEqual(bytes);
  });
  it('ignores the bucket default name for converted downloads', async () => {
    await run(['--format', 'glb']);
    expect(await readFile(join(home, 'Chair.glb'))).toEqual(bytes);
    expect(await readdir(home)).not.toContain('opaque-hash.glb');
  });
  it('preserves explicit output paths', async () => {
    await run(['--format', 'glb', '--output', 'custom-name.bin']);
    expect(await readFile(join(home, 'custom-name.bin'))).toEqual(bytes);
  });
  it('preserves explicit output paths for original downloads', async () => {
    await run(['--output', 'original.custom']);
    expect(await readFile(join(home, 'original.custom'))).toEqual(bytes);
  });
  it('preserves compound original extensions', async () => {
    extension = '.mtlx.zip';
    await run();
    expect(await readFile(join(home, 'Chair.mtlx.zip'))).toEqual(bytes);
  });
});

describe('separate CLI version selectors', () => {
  it.each(['download', 'thumbnail'])('pins %s to the resolved version', async (commandName) => {
    selectedVersion = '2.1.3';
    await run(['--version', '2.1'], commandName);
    expect(requests).toContain('GET /assets/Org/Project/Chair@2.1');
    expect(requests).toContain(`GET /media/Org/Project/Chair@2.1.3.${commandName === 'thumbnail' ? 'webp' : 'glb'}`);
  });
  it('uses the selector for asset metadata reads', async () => {
    selectedVersion = '2.1.3';
    await run(['--version', '2.1.3', '--format', 'json'], 'get');
    expect(requests).toEqual(['GET /assets/Org/Project/Chair@2.1.3']);
  });
  it('rejects versions embedded in the asset name', async () => {
    assetName = 'Chair@1.0.0';
    await expect(run()).rejects.toThrow();
    expect(requests).toEqual([]);
  });
});

describe('positional CLI asset references', () => {
  it('runs thumbnail MyChair with configured org/project defaults', async () => {
    assetName = 'MyChair';
    await run(['MyChair'], 'thumbnail', false);
    expect(requests).toContain('GET /assets/Org/Project/MyChair');
    expect(requests).toContain('GET /media/Org/Project/MyChair@1.0.0.webp');
    expect(await readFile(join(home, 'MyChair_thumbnail.png'))).toEqual(bytes);
  });
  it('runs a versioned positional download using the exact resolved version', async () => {
    assetName = 'MyChair';
    selectedVersion = '2.1.3';
    await run(['MyChair@2.1'], 'download', false);
    expect(requests).toContain('GET /assets/Org/Project/MyChair@2.1');
    expect(requests).toContain('GET /media/Org/Project/MyChair@2.1.3.glb');
  });
  it('lets explicit org/project override the configured defaults', async () => {
    await run(['MyChair', '--org', 'OtherOrg', '--project', 'OtherProject'], 'get', false);
    expect(requests).toEqual(['GET /assets/OtherOrg/OtherProject/MyChair']);
  });
  it.each([
    ['--asset', 'MyChair'],
    ['--version', '1.2.3'],
    ['--asset', 'MyChair', '--version', '1.2.3'],
  ])('rejects positional input combined with %j', async (...options) => {
    await expect(run(['MyChair@1.2.3', ...options], 'thumbnail', false)).rejects.toThrow('never both');
    expect(requests).toEqual([]);
  });
  it('rejects versions on whole-asset commands before making requests', async () => {
    await expect(run(['MyChair@1.2.3'], 'delete', false)).rejects.toThrow('does not accept');
    expect(requests).toEqual([]);
  });
});
