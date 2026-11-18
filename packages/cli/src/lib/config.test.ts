import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { type Config, FilePersistentConfig, getConfig, MemoryEnvVars, ProcessEnvVars } from '../index.ts';

describe('config', () => {
  let tempConfigDir: string;
  let filePersistentConfig: FilePersistentConfig;

  beforeEach(async () => {
    tempConfigDir = await mkdtemp(join(tmpdir(), 'loa-config-test-'));
    filePersistentConfig = new FilePersistentConfig(tempConfigDir);
  });

  afterAll(async () => {
    await rm(tempConfigDir, { recursive: true, force: true });
  });

  it('should resolve config directory and file inside LOA_CONFIG_DIR', () => {
    const dir = filePersistentConfig.configDir;

    expect(dir).toBe(tempConfigDir);
  });

  it('should return default config when no file exists (get)', async () => {
    // Ensure no config file exists
    await rm(join(filePersistentConfig.configDir, 'config.json'), { recursive: true, force: true });

    const config = await getConfig({
      persistentConfig: filePersistentConfig,
      envVars: new MemoryEnvVars(),
    });

    // get() should return default config without env vars
    expect(config.host).toBe('https://api.threeify.com');
    expect(config.auth).toBeUndefined();
  });

  it('should include env vars in getConfig() but not in get()', async () => {
    process.env.LOA_HOST = 'https://api.env.test';
    process.env.LOA_TOKEN = 'st_'.padEnd(39, 'x');

    // Set global config
    const globalCfg: Config = {
      host: 'https://api.global.test',
      org: 'test-org',
      project: 'test-project',
    };
    await filePersistentConfig.set(globalCfg);

    // get() should return only global config (no env vars)
    const globalConfig = await filePersistentConfig.get();
    expect(globalConfig.host).toBe('https://api.global.test');
    expect(globalConfig.org).toBe('test-org');
    expect(globalConfig.project).toBe('test-project');
    expect(globalConfig.auth).toBeUndefined();

    // getConfig() should merge env vars with global config (env takes precedence)
    const mergedConfig = await getConfig({
      persistentConfig: filePersistentConfig,
      envVars: new ProcessEnvVars(),
    });
    expect(mergedConfig.host).toBe('https://api.env.test'); // env takes precedence
    expect(mergedConfig.auth?.token).toBe('st_'.padEnd(39, 'x')); // from env
    expect(mergedConfig.org).toBe('test-org'); // from global config
    expect(mergedConfig.project).toBe('test-project'); // from global config
  });

  it('should persist and read global config file', async () => {
    const cfg: Config = {
      host: 'https://api.persisted.test',
      auth: {
        type: 'secretToken',
        token: 'st_'.padEnd(39, 'y'),
      },
      org: 'org',
      project: 'project',
    };

    await filePersistentConfig.set(cfg);

    const raw = await readFile(join(filePersistentConfig.configDir, 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Config;

    expect(parsed.host).toBe(cfg.host);
    expect(parsed.auth?.token).toBe(cfg.auth?.token);

    const loaded = await filePersistentConfig.get();
    expect(loaded.host).toBe(cfg.host);
    expect(loaded.auth?.token).toBe(cfg.auth?.token);
  });

  it('should write to global config only (env vars should not interfere)', async () => {
    // Set env vars
    process.env.LOA_HOST = 'https://api.env-interference.test';
    process.env.LOA_TOKEN = 'st_env_token'.padEnd(39, 'x');

    // Set global config
    const cfg: Config = {
      host: 'https://api.global-only.test',
      org: 'global-org',
    };
    await filePersistentConfig.set(cfg);

    // get() should return what was set (not affected by env vars)
    const globalConfig = await filePersistentConfig.get();
    expect(globalConfig.host).toBe('https://api.global-only.test');
    expect(globalConfig.org).toBe('global-org');
    expect(globalConfig.auth).toBeUndefined(); // Not set in global config

    // Verify the file contains only what was set
    const raw = await readFile(join(filePersistentConfig.configDir, 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Config;
    expect(parsed.host).toBe('https://api.global-only.test');
    expect(parsed.org).toBe('global-org');
    expect(parsed.auth).toBeUndefined();
  });
});
