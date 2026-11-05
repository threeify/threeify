import { expect, it } from 'vitest';
import { MemoryEnvVars } from '../../lib/env-vars.ts';
import { MemoryLogger } from '../../lib/logger.ts';
import { MemoryPersistentConfig } from '../../lib/persistent-config.ts';
import { runCli } from '../../runCli.ts';

function createDeps() {
  return {
    persistentConfig: new MemoryPersistentConfig({ host: 'https://api.test.example' }),
    envVars: new MemoryEnvVars(),
    logger: new MemoryLogger(),
  };
}

it.each([['login'], ['auth', 'login']])('stores credentials via %j', async (...command) => {
  const deps = createDeps();
  const token = 'st_test'.padEnd(39, 'x');
  await runCli([...command, '-t', token, '--host', 'https://override.test.example'], deps);
  expect(await deps.persistentConfig.get()).toEqual({
    host: 'https://override.test.example',
    auth: { type: 'secretToken', token, loggedInAt: expect.any(String) },
  });
});

it.each([['login'], ['auth', 'login']])('rejects invalid tokens via %j', async (...command) => {
  const deps = createDeps();
  await expect(runCli([...command, '--token', 'invalid'], deps)).rejects.toThrow('Invalid token format');
  expect((await deps.persistentConfig.get()).auth).toBeUndefined();
});

it.each([['logout'], ['auth', 'logout']])('requires a session via %j', async (...command) => {
  await expect(runCli(command, createDeps())).rejects.toThrow('No session token found');
});
