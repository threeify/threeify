import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buffer } from 'node:stream/consumers';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { Asset } from '@threeify/sdk';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../../dist/bin/threeify.js', import.meta.url));
const source = Buffer.from('IESNA:LM-63-2002\n[MANUFAC] Example Lighting\nTILT=NONE\n');
const asset: Asset = {
  id: 1,
  name: 'spotlight',
  type: 'LIGHT',
  visibility: 'PRIVATE',
  projectId: 1,
  projectName: 'lighting',
  orgId: 1,
  orgName: 'acme',
  description: '',
  keywords: '',
  shareLicense: 'CC_BY',
  commentMode: 'ENABLED',
  reported: false,
  likeCount: 0,
  shareCount: 0,
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  archived: false,
  metadata: '',
  version: '1.1.0',
  latestVersion: '1.1.0',
  versionId: 1,
  originalExtension: '.ies',
  fileOid: 'a'.repeat(64),
};
let server: Server;
let host: string;
let directory: string;
let requests: { method?: string; url: string; contentType?: string; body: Buffer }[];

async function run(args: string[]) {
  return promisify(execFile)(process.execPath, [cli, 'assets', ...args, '--org', 'acme', '--project', 'lighting'], {
    cwd: directory,
    env: { ...process.env, HOME: directory, LOA_HOST: host, LOA_TOKEN: '' },
  });
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await buffer(req);
    const url = new URL(req.url!, host);
    requests.push({ method: req.method, url: req.url!, contentType: req.headers['content-type'], body });
    if (url.pathname === '/signed-upload') {
      res.writeHead(200).end();
    } else if (url.pathname.endsWith('/prepare-upload')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ uploadUrl: `${host}/signed-upload`, uploadToken: 'upload-token' }));
    } else if (url.pathname.startsWith('/media/')) {
      res.writeHead(200, { 'Content-Type': 'application/ies' });
      res.end(source);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(url.pathname === '/assets' ? { rows: [asset], rowCount: 1 } : asset));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loa-ies-test-'));
  await writeFile(join(directory, 'spotlight.IES'), source);
  requests = [];
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('IES assets executable', () => {
  it.each([{ typeArgs: [] }, { typeArgs: ['--type', 'LIGHT'] }])(
    'creates a light from an IES upload with type args $typeArgs',
    async ({ typeArgs }) => {
      await run(['create', '--file', 'spotlight.IES', '--asset', 'spotlight', '--visibility', 'PRIVATE', ...typeArgs]);
      expect(requests.map((request) => [request.method, request.url])).toEqual([
        ['POST', '/assets/acme/lighting/prepare-upload'],
        ['PUT', '/signed-upload'],
        ['POST', '/assets/acme/lighting'],
      ]);
      expect(JSON.parse(requests[0]!.body.toString())).toEqual({
        filename: 'spotlight.IES',
        contentType: 'application/ies',
        size: source.length,
      });
      expect(requests[1]!.contentType).toBe('application/ies');
      expect(requests[1]!.body).toEqual(source);
      expect(JSON.parse(requests[2]!.body.toString())).toMatchObject({
        name: 'spotlight',
        type: 'LIGHT',
        uploadToken: 'upload-token',
        visibility: 'PRIVATE',
      });
    },
  );

  it('accepts LIGHT as an asset list filter', async () => {
    const { stdout } = await run(['list', '--type', 'LIGHT']);
    expect(new URL(requests[0]!.url, host).searchParams.get('type')).toBe('LIGHT');
    expect(JSON.parse(stdout).rows[0].type).toBe('LIGHT');
  });

  it('publishes an IES source as a new version', async () => {
    await run(['upload', '--asset', 'spotlight', '--file', 'spotlight.IES', '--version', '1.1.0']);
    expect(requests[1]!.body).toEqual(source);
    expect(requests[1]!.contentType).toBe('application/ies');
    expect(requests[2]!.url).toBe('/assets/acme/lighting/spotlight/versions');
    expect(JSON.parse(requests[2]!.body.toString())).toEqual({ uploadToken: 'upload-token', version: '1.1.0' });
  });

  it('downloads the selected IES original with its exact version', async () => {
    await run(['download', '--asset', 'spotlight', '--version', 'latest', '--output', 'download.ies']);
    expect(decodeURIComponent(requests[0]!.url)).toBe('/assets/acme/lighting/spotlight@latest');
    const mediaUrl = new URL(requests[1]!.url, host);
    expect(mediaUrl.pathname).toBe('/media/acme/lighting/spotlight@1.1.0.ies');
    expect(mediaUrl.searchParams.get('original')).toBe('true');
    expect(mediaUrl.searchParams.get('download')).toBe('true');
    expect(await readFile(join(directory, 'download.ies'))).toEqual(source);
  });
});
