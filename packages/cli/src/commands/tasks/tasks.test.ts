import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CliDeps } from '../../lib/deps.ts';
import { MemoryEnvVars } from '../../lib/env-vars.ts';
import { MemoryLogger } from '../../lib/logger.ts';
import { MemoryPersistentConfig } from '../../lib/persistent-config.ts';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Exercise command discovery in the built executable, including native dynamic imports.
async function runCli(args: string[], deps: CliDeps): Promise<void> {
  const home = await mkdtemp(join(tmpdir(), 'loa-tasks-test-'));
  try {
    await mkdir(join(home, '.config', 'loa'), { recursive: true });
    await writeFile(join(home, '.config', 'loa', 'config.json'), JSON.stringify(await deps.persistentConfig.get()));
    const { stdout } = await promisify(execFile)(process.execPath, ['packages/cli/dist/bin/threeify.js', ...args], {
      env: {
        ...process.env,
        HOME: home,
        LOA_HOST: deps.envVars.get('LOA_HOST'),
        LOA_TOKEN: deps.envVars.get('LOA_TOKEN'),
      },
    });
    deps.logger.info(stdout.trim());
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

const task = {
  id: 42,
  taskType: 'example',
  runner: 'simple',
  parameters: null,
  createdAt: '2026-01-01T00:00:00Z',
  name: 'Example task',
  targetUrl: null,
  orgName: 'my-org',
  projectName: 'my-project',
  createdByName: 'Tester',
  latestRunStatus: 'FAILED',
  latestRunDuration: 2,
  latestRunResults: { reason: 'example' },
};
let server: Server;
let host: string;
let deps: CliDeps;
let logger: MemoryLogger;
let status: number;
let requests: { method?: string; url?: string; auth?: string; body: string }[];

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.url === '/auth/refresh-access-token') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accessToken: 'test-access-token' }));
      return;
    }
    requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
    res.writeHead(status, { 'Content-Type': 'application/json' });
    const url = new URL(req.url!, host);
    const result =
      status !== 200
        ? { message: 'Task unavailable' }
        : req.method === 'POST'
          ? { success: true }
          : url.pathname.endsWith('/42')
            ? task
            : { rows: [task], rowCount: 1 };
    res.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
beforeEach(() => {
  status = 200;
  requests = [];
  logger = new MemoryLogger();
  deps = {
    logger,
    persistentConfig: new MemoryPersistentConfig({
      host: 'http://unused.invalid',
      org: 'my-org',
      project: 'my-project',
    }),
    envVars: new MemoryEnvVars({ LOA_HOST: host, LOA_TOKEN: 'st_test' }),
  };
});

describe('tasks commands over HTTP', () => {
  it('lists tasks using config scope, environment host/auth, and pagination/sorting', async () => {
    await runCli(
      ['tasks', 'list', '--page-offset', '20', '--page-size', '10', '--sort-by', 'runner', '--sort-dir', 'asc'],
      deps,
    );
    const url = new URL(requests[0]!.url!, host);
    expect(url.pathname).toBe('/tasks/my-org/my-project');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      pageOffset: '20',
      pageSize: '10',
      sortBy: 'runner',
      sortDir: 'asc',
    });
    expect(requests[0]!.auth).toBe('Bearer test-access-token');
    const { latestRunResults: _, ...summary } = task;
    expect(JSON.parse(logger.toString())).toEqual({ rows: [summary], rowCount: 1 });
  });

  it('gets status and results with explicit scope overriding defaults', async () => {
    await runCli(['tasks', 'get', '42', '--org', 'other-org', '--project', 'other-project'], deps);
    expect(requests[0]!.url).toBe('/tasks/other-org/other-project/42');
    expect(JSON.parse(logger.toString())).toEqual(task);
  });

  it('retries exactly once through the resubmit endpoint', async () => {
    await runCli(['tasks', 'retry', '42'], deps);
    expect(requests).toEqual([
      { method: 'POST', url: '/tasks/my-org/my-project/42/resubmit', auth: 'Bearer test-access-token', body: '{}' },
    ]);
    expect(JSON.parse(logger.toString())).toEqual({ success: true });
  });

  it.each(['yaml', 'csv'])('supports %s output', async (format) => {
    await runCli(['tasks', 'get', '42', '--format', format], deps);
    expect(logger.toString()).toContain(format === 'yaml' ? 'latestRunStatus: FAILED' : 'latestRunStatus');
  });

  it.each(
    ['get', 'retry'].flatMap((command) =>
      ['0', '-1', '1.5', 'nope', 'Infinity', '9007199254740992'].map((id) => [command, id] as const),
    ),
  )('rejects invalid ID for %s: %s before making requests', async (command, id) => {
    await expect(runCli(['tasks', command, id], deps)).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });

  it.each([
    ['--page-size', '0'],
    ['--page-size', '1001'],
    ['--page-offset', '-1'],
    ['--page-offset', '1.5'],
    ['--sort-by', 'invalid'],
  ])('rejects invalid list option %s %s', async (option, value) => {
    await expect(runCli(['tasks', 'list', option, value], deps)).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });

  it.each([401, 403, 404, 500])('propagates HTTP %s errors without reporting success', async (code) => {
    status = code;
    await expect(runCli(['tasks', 'retry', '42'], deps)).rejects.toThrow();
    expect(requests).toHaveLength(code === 401 ? 2 : 1);
    expect(logger.toString()).toBe('');
  });

  it('requires project scope when no defaults exist', async () => {
    deps.persistentConfig = new MemoryPersistentConfig({ host });
    await expect(runCli(['tasks', 'get', '42'], deps)).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });
});
