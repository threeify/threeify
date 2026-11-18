import type { ApiClient } from '@threeify/sdk';
import { createAnonymousClient, createSecretTokenInstance, createSessionInstance } from '@threeify/sdk';
import { getConfig } from './config.ts';
import type { CliDeps } from './deps.ts';

/**
 * Create an API client from stored configuration
 */
export async function createClient(deps: Pick<CliDeps, 'persistentConfig' | 'envVars'>): Promise<ApiClient> {
  const config = await getConfig(deps);

  if (config.auth) {
    if (config.auth.type === 'secretToken') {
      return createSecretTokenInstance({
        host: config.host,
        secretToken: config.auth.token,
      });
    }
    if (config.auth.type === 'session') {
      return createSessionInstance({
        host: config.host,
        userSessionToken: config.auth.token,
      });
    }
  }

  // Return anonymous client if no auth
  return createAnonymousClient({
    host: config.host,
  });
}

/**
 * Create an API client with a specific host
 */
export function createClientWithHost(host: string): ApiClient {
  return createAnonymousClient({ host });
}
