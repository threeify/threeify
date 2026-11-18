import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliDeps } from '../../lib/deps.ts';
import { MemoryEnvVars } from '../../lib/env-vars.ts';
import { MemoryLogger } from '../../lib/logger.ts';
import { MemoryPersistentConfig } from '../../lib/persistent-config.ts';
import { runCli } from '../../runCli.ts';

const auth = vi.hoisted(() => ({
  loginWithBrowser: vi.fn(),
  loginWithToken: vi.fn(),
  getAuthStatus: vi.fn(),
  deleteRefreshToken: vi.fn(),
  healthRequest: vi.fn(),
}));

vi.mock('../../lib/auth.ts', () => auth);
vi.mock('../../lib/client.ts', () => ({
  createClientWithHost: () => ({ axios: { get: auth.healthRequest } }),
}));
vi.mock('@threeify/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@threeify/sdk')>()),
  deleteRefreshToken: auth.deleteRefreshToken,
}));
// Keep the real runCli parser and real command definitions; replace only filesystem discovery
// so their authentication dependencies are mocked before commands are imported.
vi.mock('yargs-file-commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('yargs-file-commands')>()),
  fileCommands: async () => {
    const [{ command: login }, { command: status }, { command: logout }, { command: health }] = await Promise.all([
      import('./login.ts'),
      import('./status.ts'),
      import('./logout.ts'),
      import('../health.ts'),
    ]);
    return [
      {
        command: 'auth',
        describe: 'Authentication',
        builder: (yargs: import('yargs').Argv) => yargs.command(login).command(status).command(logout),
      },
      health,
    ];
  },
}));

let deps: CliDeps;
const host = 'https://api-preview.threeify.com';

beforeEach(() => {
  vi.clearAllMocks();
  deps = {
    persistentConfig: new MemoryPersistentConfig({ host: 'https://configured.example.com' }),
    envVars: new MemoryEnvVars(),
    logger: new MemoryLogger(),
  };
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('auth host and help parsing', () => {
  it.each([['--host', host], [`--host=${host}`]])('passes explicit browser login host with %j', async (...args) => {
    await runCli(['auth', 'login', ...args], deps);
    expect(auth.loginWithBrowser).toHaveBeenCalledWith(host, deps);
    expect(auth.loginWithToken).not.toHaveBeenCalled();
  });

  it.each([['--host', host], [`--host=${host}`]])('passes explicit status host with %j', async (...args) => {
    await runCli(['auth', 'status', ...args], deps);
    expect(auth.getAuthStatus).toHaveBeenCalledWith(host, deps);
  });

  it('passes both token and host to token login', async () => {
    await runCli(['auth', 'login', '--host', host, '--token', 'st_example'], deps);
    expect(auth.loginWithToken).toHaveBeenCalledWith(host, 'st_example', deps);
    expect(auth.loginWithBrowser).not.toHaveBeenCalled();
  });

  it.each(['login', 'status', 'logout'])('shows help for auth %s without authentication actions', async (command) => {
    for (const flag of ['--help', '-h']) {
      await runCli(['auth', command, flag], deps);
    }
    expect(auth.loginWithBrowser).not.toHaveBeenCalled();
    expect(auth.loginWithToken).not.toHaveBeenCalled();
    expect(auth.getAuthStatus).not.toHaveBeenCalled();
    expect(auth.deleteRefreshToken).not.toHaveBeenCalled();
    expect(await deps.persistentConfig.get()).toEqual({ host: 'https://configured.example.com' });
  });

  it('shows health help without making requests', async () => {
    for (const flag of ['--help', '-h']) await runCli(['health', flag], deps);
    expect(auth.healthRequest).not.toHaveBeenCalled();
  });
});
