import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { getCliDeps } from '../../lib/deps.ts';

export const command = defineCommand({
  command: 'set',
  describe: 'Set default org, project, and/or API host',
  builder: (yargs) =>
    yargs
      .option('org', {
        alias: 'o',
        type: 'string',
        description: 'Organization name',
      })
      .option('project', {
        alias: 'p',
        type: 'string',
        description: 'Project name (requires org to be set)',
      })
      .option('host', {
        type: 'string',
        description: 'API host URL (defaults to https://api.threeify.com)',
      }),
  handler: async (argv) => {
    // Validate: cannot set project without org
    if (argv.project && !argv.org) {
      throw new Error('Cannot set project without org. Project is scoped to org.');
    }

    // Validate org name if provided (including empty strings)
    if (argv.org !== undefined) {
      const result = sdk.orgNameSchema.safeParse(argv.org);
      if (!result.success) {
        const errorMessage = result.error.issues.map((e) => e.message).join('; ');
        throw new Error(`Invalid organization name: ${errorMessage}`);
      }
    }

    // Validate project name if provided (including empty strings)
    if (argv.project !== undefined) {
      const result = sdk.projectNameSchema.safeParse(argv.project);
      if (!result.success) {
        const errorMessage = result.error.issues.map((e) => e.message).join('; ');
        throw new Error(`Invalid project name: ${errorMessage}`);
      }
    }

    // Validate host if provided
    if (argv.host) {
      // Check that host starts with http:// or https://
      if (!(argv.host.startsWith('http://') || argv.host.startsWith('https://'))) {
        throw new Error('Host must start with http:// or https://');
      }

      if (!sdk.validateUrl(argv.host)) {
        throw new Error('Invalid host URL format');
      }
    }

    // Must set at least one (check after validation so validation errors are shown first)
    if (!(argv.org || argv.project || argv.host)) {
      throw new Error('Must specify at least --org, --project, or --host');
    }

    const deps = getCliDeps(argv);

    // Write to global config
    const globalConfig = await deps.persistentConfig.get();
    if (argv.org) {
      globalConfig.org = argv.org;
    }
    if (argv.project) {
      globalConfig.project = argv.project;
    }
    if (argv.host) {
      globalConfig.host = argv.host;
    }

    // Validate config
    if (globalConfig.project && !globalConfig.org) {
      throw new Error('Cannot set project without org. Project is scoped to org.');
    }

    await deps.persistentConfig.set(globalConfig);
  },
});
