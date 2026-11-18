import * as sdk from '@threeify/sdk';
import { defineCommand } from 'yargs-file-commands';
import { formatOption, getOrgOption, getProjectOptionalOption } from '../../lib/args.ts';
import { createClient } from '../../lib/client.ts';
import { getCliDeps } from '../../lib/deps.ts';
import { logOutput } from '../../lib/output.ts';

export const command = defineCommand({
  command: 'create <url>',
  describe: 'Create a webhook for an organization or project',
  builder: (yargs) =>
    yargs
      .positional('url', {
        type: 'string',
        description: 'URL to deliver webhook events to',
        demandOption: true,
      })
      .options({
        ...getOrgOption(),
        ...getProjectOptionalOption(),
        ...formatOption,
        events: {
          type: 'string',
          description: 'Comma-separated event types (e.g. "asset.created,asset.updated"). Omit for all events.',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of this webhook',
        },
        secret: {
          type: 'string',
          description: 'HMAC signing secret (min 16 chars); if omitted, server generates one',
        },
        active: {
          type: 'boolean',
          default: true,
          description: 'Whether the webhook is active',
        },
      }),
  handler: async (argv) => {
    const deps = getCliDeps(argv);
    const client = await createClient(deps);

    const parsedEvents = argv.events
      ? argv.events
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : [];
    const events = sdk.serverEventTypeSchema.array().parse(parsedEvents);

    const body = {
      url: argv.url,
      events,
      description: argv.description ?? undefined,
      secret: argv.secret && argv.secret.length >= 16 ? argv.secret : undefined,
      active: argv.active,
    };

    const query = argv.project ? { orgName: argv.org, projectName: argv.project } : { orgName: argv.org };

    const webhook = await sdk.createWebhook(client, { query, body });

    logOutput(webhook, argv.format, deps.logger);
    if (webhook.secret) {
      deps.logger.info('\n⚠️  Save this secret securely - it will not be shown again!');
    }
  },
});
