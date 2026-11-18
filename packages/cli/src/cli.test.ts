import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const execute = promisify(execFile);
const executable = fileURLToPath(new URL('../dist/bin/threeify.js', import.meta.url));

test('threeify reports the package version and uses its installed command name in help', async () => {
  const home = await mkdtemp(join(tmpdir(), 'threeify-command-'));
  try {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const options = { env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config') } };
    const version = await execute(process.execPath, [executable, '--version'], options);
    expect(version.stdout.trim()).toBe(pkg.version);
    const help = await execute(process.execPath, [executable, '--help'], options);
    expect(help.stdout).toContain('threeify <command>');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
