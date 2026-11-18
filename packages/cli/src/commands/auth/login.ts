import { defineCommand } from 'yargs-file-commands';
import { loginWithBrowser, loginWithToken } from '../../lib/auth.ts';
import { getConfig } from '../../lib/config.ts';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'login',
  describe: 'Authenticate with the Threeify platform',
  builder: (yargs) =>
    yargs.options({
      token: {
        type: 'string',
        alias: 't',
        description: 'Secret API token (st_...) for service account authentication',
      },
      host: {
        type: 'string',
        description: 'API host URL (overrides config)',
      },
    }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const config = await getConfig(deps);
    const host = argv.host || config.host;

    if (argv.token) {
      await loginWithToken(host, argv.token, deps);
    } else {
      await loginWithBrowser(host, deps);
    }
  },
});
