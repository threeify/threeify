import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { infoFromPackageJson, mergeDocument } from '@clidoc/core';
import { createDocgenCommand, fromYargsAsync } from '@clidoc/yargs';
import yargs from 'yargs';
import { fileCommands } from 'yargs-file-commands';
import { initializeConfigDefaults } from './lib/config-defaults.ts';
import { type CliDeps, setCliDeps } from './lib/deps.ts';
import { assetManagerDocs } from './lib/asset-manager/docs.ts';

// Regex to extract command name from yargs error messages
const SUBCOMMAND_ERROR_REGEX = /You must specify a (\w+) subcommand/i;

/**
 * Core CLI runner that can be used programmatically from tests.
 *
 * This sets up yargs with the same commands and options as the real `threeify` CLI,
 * but does not call `process.exit` on failure; callers can decide how to
 * handle errors.
 */
export async function runCli(argv: string[], deps: CliDeps): Promise<unknown> {
  // Get the directory of the current file (dist/index.js in production, src/index.ts in tests)
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const defaultCommandsDir = join(thisDir, 'commands');
  const commandDirs = [defaultCommandsDir];
  const pkg = JSON.parse(readFileSync(join(thisDir, '..', 'package.json'), 'utf8'));
  const info = infoFromPackageJson(pkg);

  // Pre-load config defaults before commands are registered
  await initializeConfigDefaults(deps);

  const commandModules = await fileCommands({ commandDirs });
  const docgen = createDocgenCommand(async () =>
    mergeDocument(await fromYargsAsync([...commandModules, docgen], info), assetManagerDocs),
  );

  const y = yargs(argv)
    .scriptName('threeify')
    .usage('$0 <command> [options]')
    .command(commandModules)
    .command(docgen)
    .option('parallel', {
      type: 'number',
      description: 'Number of parallel operations to run concurrently',
      default: 4,
    })
    .middleware((parsedArgv) => {
      setCliDeps(parsedArgv, deps);
    })
    .help()
    .alias('h', 'help')
    .version(pkg.version)
    .alias('v', 'version')
    .strict()
    .exitProcess(false)
    .fail((msg, err) => {
      // If the error is about missing subcommand, show help instead of throwing
      // This handles cases like "threeify config" or "threeify orgs" without a subcommand
      if (!err) {
        const errorMsg = msg.toLowerCase();
        if (errorMsg.includes('must specify') || errorMsg.includes('subcommand')) {
          // Extract the command name from the error message if possible
          const commandMatch = msg.match(SUBCOMMAND_ERROR_REGEX);
          const commandName = commandMatch ? commandMatch[1] : 'command';
          console.error(`Please specify a ${commandName} subcommand.\n`);
          y.showHelp();
          // Throw a special error that we'll catch and ignore
          throw new HelpShownError();
        }
      }
      // Re-throw the error so it can be caught and formatted by the caller
      // This prevents yargs from printing the full error object
      if (err) {
        throw err;
      }
      throw new Error(msg);
    });

  // Check if argv is completely empty (no arguments at all)
  // If so, show help. Otherwise let yargs handle --help, --version, etc. normally
  if (argv.length === 0) {
    console.error('Please specify a command.\n');
    y.showHelp();
    return;
  }

  try {
    // `parse` returns `Promise<unknown>` in async mode
    return await y.parseAsync();
  } catch (error) {
    // If help was shown (via HelpShownError), return normally instead of throwing
    if (error instanceof HelpShownError) {
      return;
    }
    // If the error is about missing subcommand, show help instead
    // This handles cases like "threeify config" or "threeify orgs" without a subcommand
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('must specify') || errorMsg.includes('subcommand')) {
        // Extract the command name from the error message if possible
        const commandMatch = error.message.match(SUBCOMMAND_ERROR_REGEX);
        const commandName = commandMatch ? commandMatch[1] : 'command';
        console.error(`Please specify a ${commandName} subcommand.\n`);
        y.showHelp();
        return;
      }
    }
    throw error;
  }
}

// Special error class to indicate help was shown
class HelpShownError extends Error {
  constructor() {
    super('Help shown');
    this.name = 'HelpShownError';
  }
}
