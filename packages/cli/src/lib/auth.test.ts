import { refreshAccessToken } from '@threeify/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthStatus, loginWithToken } from './auth.ts';
import type { CliDeps } from './deps.ts';
import { MemoryEnvVars } from './env-vars.ts';
import { MemoryLogger } from './logger.ts';
import { MemoryPersistentConfig } from './persistent-config.ts';

vi.mock('@threeify/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@threeify/sdk')>()),
  refreshAccessToken: vi.fn(),
}));

const host = 'https://api.example.com';
const token = `ut_${'a'.repeat(36)}`;
const createdAt = '2026-11-01T12:00:00Z';
const expiresAt = '2026-12-01T12:00:00Z';
let deps: CliDeps;
let logger: MemoryLogger;
let envVars: MemoryEnvVars;

beforeEach(() => {
  vi.clearAllMocks();
  logger = new MemoryLogger();
  envVars = new MemoryEnvVars();
  deps = {
    persistentConfig: new MemoryPersistentConfig({ host, auth: { type: 'session', token } }),
    logger,
    envVars,
  };
  vi.mocked(refreshAccessToken).mockResolvedValue({
    accessToken: 'private-access-token',
    auth: { username: 'alice', createdAt, expiresAt },
  });
});

describe('authentication status', () => {
  it('fetches the current identity and session lifetime without printing credentials', async () => {
    await getAuthStatus(host, deps);
    expect(refreshAccessToken).toHaveBeenCalledWith(host, { body: { refreshToken: token } }, true);
    expect(logger.toString()).toContain(`Host: ${host}`);
    expect(logger.toString()).toContain('Username: alice');
    expect(logger.toString()).toContain('Logged in: 2026-11-01T12:00:00.000Z');
    expect(logger.toString()).toContain('Expires: 2026-12-01T12:00:00.000Z');
    expect(logger.toString()).toContain('Token is valid');
    expect(logger.toString()).not.toContain(token);
    expect(logger.toString()).not.toContain('private-access-token');
  });

  it('uses the supplied host and server identity instead of stale cached identity', async () => {
    await deps.persistentConfig.set({
      auth: { type: 'session', token, user: { id: '1', name: 'stale', email: 'old@example.com' } },
    });
    const overrideHost = 'https://preview.example.com';
    await getAuthStatus(overrideHost, deps);
    expect(refreshAccessToken).toHaveBeenCalledWith(overrideHost, expect.anything(), true);
    expect(logger.toString()).toContain(`Host: ${overrideHost}`);
    expect(logger.toString()).toContain('Username: alice');
    expect(logger.toString()).not.toContain('stale');
  });

  it('reports the API token account, local login time, and non-expiring lifetime', async () => {
    await deps.persistentConfig.set({ auth: { type: 'secretToken', token: 'st_secret', loggedInAt: createdAt } });
    vi.mocked(refreshAccessToken).mockResolvedValue({
      accessToken: 'access',
      auth: { username: 'service-account', createdAt: '2026-10-01T00:00:00Z', expiresAt: null },
    });
    await getAuthStatus(host, deps);
    expect(logger.toString()).toContain('Username: service-account');
    expect(logger.toString()).toContain('Logged in: 2026-11-01T12:00:00.000Z');
    expect(logger.toString()).toContain('Token created: 2026-10-01T00:00:00.000Z');
    expect(logger.toString()).toContain('Expires: Never');
  });

  it('checks an environment token in preference to a saved session', async () => {
    envVars.set('LOA_TOKEN', 'st_environment');
    await getAuthStatus(host, deps);
    expect(refreshAccessToken).toHaveBeenCalledWith(host, { body: { refreshToken: 'st_environment' } }, true);
    expect(logger.toString()).toContain('Type: secretToken');
    expect(logger.toString()).toContain('Logged in: Unknown');
  });

  it('shows unknown metadata for servers that only return an access token', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'access' });
    await getAuthStatus(host, deps);
    expect(logger.toString()).toContain('Username: Unknown');
    expect(logger.toString()).toContain('Logged in: Unknown');
    expect(logger.toString()).toContain('Expires: Unknown');
    expect(logger.toString()).toContain('Token is valid');
  });

  it('retains a known local login time when an older server omits metadata', async () => {
    await deps.persistentConfig.set({ auth: { type: 'session', token, loggedInAt: createdAt } });
    vi.mocked(refreshAccessToken).mockResolvedValue({ accessToken: 'access' });
    await getAuthStatus(host, deps);
    expect(logger.toString()).toContain('Logged in: 2026-11-01T12:00:00.000Z');
    expect(logger.toString()).toContain('Expires: Unknown');
  });

  it('does not claim an invalid or expired credential is valid', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Session has expired or been invalidated'));
    await expect(getAuthStatus(host, deps)).rejects.toThrow('Session has expired');
    expect(logger.toString()).not.toContain('Token is valid');
    expect(logger.toString()).not.toContain('Username:');
  });

  it('does not make a request when unauthenticated', async () => {
    await deps.persistentConfig.set({ host });
    await getAuthStatus(host, deps);
    expect(logger.toString()).toContain('Not authenticated');
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('records when an API token is saved without replacing its creation time', async () => {
    const before = Date.now();
    await loginWithToken(host, `st_${'a'.repeat(36)}`, deps);
    const saved = await deps.persistentConfig.get();
    expect(saved.auth?.loggedInAt).toBeDefined();
    expect(Date.parse(saved.auth!.loggedInAt!)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(saved.auth!.loggedInAt!)).toBeLessThanOrEqual(Date.now());
  });
});

describe('login callback port', () => {
  it('skips occupied ports and listens on the next free one', async () => {
    const { createServer } = await import('node:http');
    const { listenOnFreePort } = await import('./auth.ts');
    const actualPort = (server: import('node:http').Server) =>
      (server.address() as import('node:net').AddressInfo).port;
    const busy = createServer();
    await listenOnFreePort(busy, [0]);
    const first = actualPort(busy);
    const free = createServer();
    try {
      const probe = createServer();
      await listenOnFreePort(probe, [0]);
      const second = actualPort(probe);
      await new Promise((done) => probe.close(done));
      expect(await listenOnFreePort(free, [first, second])).toBe(second);
      await expect(listenOnFreePort(createServer(), [first, second])).rejects.toThrow(/all in use/);
    } finally {
      busy.close();
      free.close();
    }
  });
});
