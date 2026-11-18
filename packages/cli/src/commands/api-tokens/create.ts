import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { descriptionOption, formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create <serviceAccount> <token>',
  describe: 'Create API token',
  builder: (yargs) =>
    yargs
      .positional('serviceAccount', {
        type: 'string',
        description: 'Service account name',
        demandOption: true,
      })
      .positional('token', {
        type: 'string',
        description: 'Token name',
        demandOption: true,
      })
      .options({
        type: {
          type: 'string',
          choices: sdk.Enums.ApiTokenType,
          description: 'Token type',
          demandOption: true,
        },
        'domain-whitelist': {
          type: 'string',
          description: 'Domain whitelist (for FRONTEND tokens)',
        },
        ...getOrgOption(),
        ...getProjectOptionalOption(),
        ...descriptionOption,
        ...formatOption,
      }),
  handler: async (argv) => {
    const client = await createClient(getCliDeps(argv));
    const token = await sdk.createAPIToken(client, {
      query: {
        orgName: argv.org,
        ...(argv.project ? { projectName: argv.project } : {}),
      },
      body: {
        serviceAccountName: argv.serviceAccount,
        name: argv.token,
        type: argv.type,
        description: argv.description,
        domainWhitelist: argv['domain-whitelist'],
      },
    });
    const deps = getCliDeps(argv);
    logOutput(token, argv.format, deps.logger);
    deps.logger.info(`\nToken: ${token.token}`);
    if (argv.type === 'SECRET') {
      deps.logger.info('⚠️  Save this token securely - it will not be shown again!');
    }
  },
});
