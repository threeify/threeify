import { createSessionInstance, deleteRefreshToken } from '@threeify/sdk';
import * as Sentry from '@sentry/node';
import { defineCommand } from 'yargs-file-commands';
import { getConfig } from '../../lib/config.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'logout',
  describe: 'Clear stored authentication',
  builder: (yargs) => yargs,
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const config = await getConfig(deps);

    // If we have a session token, try to delete it on the server
    if (config.auth?.type === 'session' && config.auth.token) {
      const client = createSessionInstance({
        host: config.host,
        userSessionToken: config.auth.token,
      });
      await deleteRefreshToken(client, {
        params: { token: config.auth.token },
      });
      // Clear local auth config
      const globalConfig = await deps.persistentConfig.get();
      globalConfig.auth = undefined;
      await deps.persistentConfig.set(globalConfig);

      // Clear user context in Sentry
      Sentry.setUser(null);

      deps.logger.info('Authentication cleared');
    } else {
      throw new Error('No session token found');
    }
  },
});
