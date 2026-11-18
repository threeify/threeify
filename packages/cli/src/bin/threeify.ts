#!/usr/bin/env node

// Initialize Sentry early, before any other imports
import '../instrumentation.ts';

import * as Sentry from '@sentry/node';
import { hideBin } from 'yargs/helpers';
import { runCli } from '../index.ts';
import { ProcessEnvVars } from '../lib/env-vars.ts';
import { formatError } from '../lib/errors.ts';
import { ConsoleLogger } from '../lib/logger.ts';
import { FilePersistentConfig } from '../lib/persistent-config.ts';

runCli(hideBin(process.argv), {
  persistentConfig: new FilePersistentConfig(),
  envVars: new ProcessEnvVars(),
  logger: new ConsoleLogger(),
})
  .then(() => {
    // Exit successfully after command completes
    process.exit(0);
  })
  .catch((error) => {
    // Capture the original error in Sentry (use originalError if available, otherwise the error itself)
    const originalError = (error as { originalError?: unknown })?.originalError ?? error;
    Sentry.captureException(originalError);
    // Use formatError to get a user-friendly message without the verbose stack trace
    console.error(formatError(error));
    process.exit(1);
  });
