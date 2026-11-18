import { beforeEach, describe, expect, it } from 'vitest';
import { getConfig } from '../../lib/config.ts';
import type { CliDeps } from '../../lib/deps.ts';
import { MemoryEnvVars } from '../../lib/env-vars.ts';
import { MemoryLogger } from '../../lib/logger.ts';
import { MemoryPersistentConfig } from '../../lib/persistent-config.ts';
import { runCli } from '../../runCli.ts';

describe('config commands', () => {
  let deps: CliDeps;
  let envVars: MemoryEnvVars;
  let logger: MemoryLogger;
  let persistentConfig: MemoryPersistentConfig;

  beforeEach(() => {
    persistentConfig = new MemoryPersistentConfig({});
    envVars = new MemoryEnvVars();
    logger = new MemoryLogger();
    deps = {
      persistentConfig,
      envVars,
      logger,
    };
  });

  describe('config get', () => {
    it('should return only global config (no env vars)', async () => {
      // Set global config
      await persistentConfig.set({
        host: 'https://api.global.test',
        org: 'test-org',
        project: 'test-project',
      });

      // Set env vars (should not appear in config get output)
      envVars.set('LOA_HOST', 'https://api.env.test');
      envVars.set('LOA_TOKEN', 'st_env_token'.padEnd(39, 'x'));

      await runCli(['config', 'get'], deps);

      const config = await persistentConfig.get();

      // Should only show global config, not env vars
      expect(config.host).toBe('https://api.global.test');
      expect(config.org).toBe('test-org');
      expect(config.project).toBe('test-project');
      expect(config.auth).toBeUndefined(); // Not in global config
    });

    it('should return empty config when no global config is set', async () => {
      // Start with empty config
      await persistentConfig.set({
        host: 'https://api.test.example',
      });

      // Set env vars (should not appear)
      envVars.set('LOA_HOST', 'https://api.env.test');
      envVars.set('LOA_TOKEN', 'st_env_token'.padEnd(39, 'x'));

      await runCli(['config', 'get'], deps);

      const config = await persistentConfig.get();

      // Should only show what's in global config
      expect(config.host).toBe('https://api.test.example');
      expect(config.org).toBeUndefined(); // Not in global config
      expect(config.auth).toBeUndefined(); // Not in global config
    });

    describe('config set', () => {
      it('should read and write only global config (env vars should not interfere)', async () => {
        // Set initial global config
        await persistentConfig.set({
          host: 'https://api.initial.test',
          org: 'initial-org',
        });

        // Set env vars that should not interfere
        envVars.set('LOA_HOST', 'https://api.env-interference.test');
        envVars.set('LOA_TOKEN', 'st_env_token'.padEnd(39, 'x'));

        await runCli(['config', 'set', '--org', 'new-org', '--project', 'new-project'], deps);

        // Verify global config was updated correctly
        const globalConfig = await persistentConfig.get();
        expect(globalConfig.org).toBe('new-org');
        expect(globalConfig.project).toBe('new-project');
        expect(globalConfig.host).toBe('https://api.initial.test'); // Should remain unchanged

        // Verify env vars didn't interfere
        expect(globalConfig.auth).toBeUndefined(); // Not set in global config
      });

      it('should update host in global config', async () => {
        await persistentConfig.set({
          host: 'https://api.old.test',
        });

        await runCli(['config', 'set', '--host', 'https://api.new.test'], deps);

        let globalConfig = await persistentConfig.get();
        expect(globalConfig.host).toBe('https://api.new.test');

        await runCli(['config', 'clear', '--host'], deps);

        globalConfig = await persistentConfig.get();
        expect(globalConfig.host).toBeUndefined();
      });

      describe('host validation', () => {
        it('should accept valid https:// URLs', async () => {
          await runCli(['config', 'set', '--host', 'https://api.example.com'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.host).toBe('https://api.example.com');
        });

        it('should accept valid http:// URLs', async () => {
          await runCli(['config', 'set', '--host', 'http://localhost:3000'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.host).toBe('http://localhost:3000');
        });

        it('should accept URLs with username and password', async () => {
          await runCli(['config', 'set', '--host', 'https://user:pass@api.example.com'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.host).toBe('https://user:pass@api.example.com');
        });

        it('should accept URLs with port', async () => {
          await runCli(['config', 'set', '--host', 'https://api.example.com:8080'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.host).toBe('https://api.example.com:8080');
        });

        it('should accept URLs with username, password, and port', async () => {
          await runCli(['config', 'set', '--host', 'https://user:pass@api.example.com:8080'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.host).toBe('https://user:pass@api.example.com:8080');
        });

        it('should reject URLs without http:// or https:// prefix', async () => {
          await expect(runCli(['config', 'set', '--host', 'api.example.com'], deps)).rejects.toThrow(
            'Host must start with http:// or https://',
          );
        });

        it('should reject invalid URL formats', async () => {
          await expect(runCli(['config', 'set', '--host', 'https://'], deps)).rejects.toThrow(
            'Invalid host URL format',
          );
        });

        it('should reject malformed URLs', async () => {
          await expect(runCli(['config', 'set', '--host', 'https://[invalid'], deps)).rejects.toThrow(
            'Invalid host URL format',
          );
        });
      });

      describe('org name validation', () => {
        it('should accept valid org names', async () => {
          await runCli(['config', 'set', '--org', 'my-org'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.org).toBe('my-org');
        });

        it('should accept org names with numbers', async () => {
          await runCli(['config', 'set', '--org', 'org123'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.org).toBe('org123');
        });

        it('should accept org names with dashes', async () => {
          await runCli(['config', 'set', '--org', 'my-org-name'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.org).toBe('my-org-name');
        });

        it('should reject org names starting with a number', async () => {
          await expect(runCli(['config', 'set', '--org', '123org'], deps)).rejects.toThrow('Invalid organization name');
        });

        it('should reject org names with consecutive dashes', async () => {
          await expect(runCli(['config', 'set', '--org', 'my--org'], deps)).rejects.toThrow(
            'Invalid organization name',
          );
        });

        it('should reject org names with trailing dashes', async () => {
          await expect(runCli(['config', 'set', '--org', 'my-org-'], deps)).rejects.toThrow(
            'Invalid organization name',
          );
        });

        it('should reject org names that are too long', async () => {
          const longName = 'a'.repeat(31); // 31 characters, max is 30
          await expect(runCli(['config', 'set', '--org', longName], deps)).rejects.toThrow('Invalid organization name');
        });

        it('should reject empty org names', async () => {
          await expect(runCli(['config', 'set', '--org', ''], deps)).rejects.toThrow('Invalid organization name');
        });

        it('should reject org names with invalid characters', async () => {
          await expect(runCli(['config', 'set', '--org', 'my_org'], deps)).rejects.toThrow('Invalid organization name');
        });
      });

      describe('project name validation', () => {
        it('should accept valid project names', async () => {
          await runCli(['config', 'set', '--org', 'my-org', '--project', 'my-project'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.project).toBe('my-project');
        });

        it('should accept project names with numbers', async () => {
          await runCli(['config', 'set', '--org', 'my-org', '--project', 'project123'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.project).toBe('project123');
        });

        it('should accept project names with dashes', async () => {
          await runCli(['config', 'set', '--org', 'my-org', '--project', 'my-project-name'], deps);
          const globalConfig = await persistentConfig.get();
          expect(globalConfig.project).toBe('my-project-name');
        });

        it('should reject project names starting with a number', async () => {
          await expect(runCli(['config', 'set', '--org', 'my-org', '--project', '123project'], deps)).rejects.toThrow(
            'Invalid project name',
          );
        });

        it('should reject project names with consecutive dashes', async () => {
          await expect(runCli(['config', 'set', '--org', 'my-org', '--project', 'my--project'], deps)).rejects.toThrow(
            'Invalid project name',
          );
        });

        it('should reject project names with trailing dashes', async () => {
          await expect(runCli(['config', 'set', '--org', 'my-org', '--project', 'my-project-'], deps)).rejects.toThrow(
            'Invalid project name',
          );
        });

        it('should reject project names that are too long', async () => {
          const longName = 'a'.repeat(31); // 31 characters, max is 30
          await expect(runCli(['config', 'set', '--org', 'my-org', '--project', longName], deps)).rejects.toThrow(
            'Invalid project name',
          );
        });

        it('should reject empty project names', async () => {
          await expect(runCli(['config', 'set', '--org', 'my-org', '--project', ''], deps)).rejects.toThrow(
            'Invalid project name',
          );
        });

        it('should reject project names with invalid characters', async () => {
          await expect(runCli(['config', 'set', '--org', 'my-org', '--project', 'my_project'], deps)).rejects.toThrow(
            'Invalid project name',
          );
        });
      });

      it('should persist config values correctly', async () => {
        // Set org and project
        await runCli(['config', 'set', '--org', 'persisted-org', '--project', 'persisted-project'], deps);

        // Verify they persisted
        let globalConfig = await persistentConfig.get();
        expect(globalConfig.org).toBe('persisted-org');
        expect(globalConfig.project).toBe('persisted-project');

        // Update org
        await runCli(['config', 'set', '--org', 'updated-org'], deps);

        // Verify org updated but project remained
        globalConfig = await persistentConfig.get();
        expect(globalConfig.org).toBe('updated-org');
        expect(globalConfig.project).toBe('persisted-project');
      });
    });

    describe('config clear', () => {
      it('should clear org from global config', async () => {
        // Set initial config
        await persistentConfig.set({
          host: 'https://api.test.example',
          org: 'test-org',
          project: 'test-project',
        });

        await runCli(['config', 'clear', '--org'], deps);

        const globalConfig = await persistentConfig.get();
        expect(globalConfig.org).toBeUndefined();
        expect(globalConfig.project).toBeUndefined(); // Should also be cleared since project is scoped to org
      });

      it('should clear project from global config', async () => {
        await persistentConfig.set({
          host: 'https://api.test.example',
          org: 'test-org',
          project: 'test-project',
        });

        await runCli(['config', 'clear', '--project'], deps);

        const globalConfig = await persistentConfig.get();
        expect(globalConfig.org).toBe('test-org'); // Should remain
        expect(globalConfig.project).toBeUndefined();
      });

      it('should reset host to default when cleared', async () => {
        await persistentConfig.set({
          host: 'https://api.custom.test',
          org: 'test-org',
        });

        await runCli(['config', 'clear', '--host'], deps);

        const globalConfig = await persistentConfig.get();
        expect(globalConfig.host).toBeUndefined(); // Should reset to empty
        expect(globalConfig.org).toBe('test-org'); // Should remain

        // and the defaults should be restored when getting the full config
        const fullConfig = await getConfig(deps);
        expect(fullConfig.host).toBe('https://api.threeify.com');
        expect(fullConfig.org).toBe('test-org');
        expect(fullConfig.project).toBeUndefined();
      });

      it('should clear multiple values at once', async () => {
        await persistentConfig.set({
          host: 'https://api.custom.test',
          org: 'test-org',
          project: 'test-project',
        });

        await runCli(['config', 'clear', '--org', '--host'], deps);

        const globalConfig = await persistentConfig.get();
        expect(globalConfig.org).toBeUndefined();
        expect(globalConfig.project).toBeUndefined(); // Cleared with org
        expect(globalConfig.host).toBeUndefined(); // Reset to default

        // and the defaults should be restored when getting the full config
        const fullConfig = await getConfig(deps);
        expect(fullConfig.host).toBe('https://api.threeify.com');
        expect(fullConfig.org).toBeUndefined();
        expect(fullConfig.project).toBeUndefined();
      });
    });

    describe('config commands with env vars', () => {
      it('should show env vars in getConfig() but not in config get command', async () => {
        // Set global config
        await persistentConfig.set({
          host: 'https://api.global.test',
          org: 'global-org',
        });

        // Set env vars
        envVars.set('LOA_HOST', 'https://api.env.test');
        envVars.set('LOA_TOKEN', 'st_env_token'.padEnd(39, 'x'));

        // getConfig() should include env vars
        const mergedConfig = await persistentConfig.get();
        expect(mergedConfig.host).toBe('https://api.global.test'); // env takes precedence
        expect(mergedConfig.auth?.token).toBeUndefined();
        expect(mergedConfig.org).toBe('global-org'); // from global

        const fullConfig = await getConfig(deps);
        expect(fullConfig.host).toBe('https://api.env.test');
        expect(fullConfig.auth?.token).toBe('st_env_token'.padEnd(39, 'x'));
        expect(fullConfig.org).toBe('global-org');
      });
    });
  });
});
