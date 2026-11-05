import type { CliDeps } from './deps.ts';
import { getEnvConfig } from './env-vars.ts';

export type AuthConfig = {
  type: 'session' | 'secretToken';
  token: string;
  loggedInAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

export type Config = {
  host: string;
  auth?: AuthConfig;
  org?: string;
  project?: string;
};

/**
 * Read configuration (merges env vars with global config)
 */
export async function getConfig(deps: Pick<CliDeps, 'persistentConfig' | 'envVars'>): Promise<Config> {
  const globalConfig = await deps.persistentConfig.get();
  const envConfig = getEnvConfig(deps.envVars);
  return { host: 'https://api.threeify.com', ...globalConfig, ...envConfig };
}
