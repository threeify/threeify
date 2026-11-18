import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { generatePages, parse } from '@clidoc/core';
import { expect, it } from 'vitest';

const executable = fileURLToPath(new URL('../../../dist/bin/threeify.js', import.meta.url));

it('generates validated command references with authored prose, examples, and discovered flags', async () => {
  const root = await mkdtemp(join(tmpdir(), 'loa-docgen-'));
  try {
    const output = join(root, 'opencli.json');
    await promisify(execFile)(process.execPath, [executable, 'docgen', '--output', output], {
      cwd: root,
      env: { ...process.env, HOME: root, LOA_TOKEN: '' },
    });
    const document = parse(await readFile(output, 'utf8'));
    const pages = generatePages(document, { basePath: '/cli' });
    for (const name of [
      'add',
      'remove',
      'pull',
      'update',
      'outdated',
      'publish',
      'resolve',
      'store path',
      'store status',
      'store prune',
    ]) {
      const command = document.commands![`threeify ${name}`]!;
      expect(command.description).toBeTruthy();
      expect(command.examples?.length).toBeGreaterThan(0);
      const page = pages.find((candidate) => candidate.title === `threeify ${name}`)!;
      expect(page.content).toContain(command.description);
      for (const example of command.examples!) {
        expect(page.content).toContain(example.content);
        expect(example.content).not.toMatch(/(?:^|\n)\s*(?:loa|three)\s/);
      }
    }
    expect(document.commands!['threeify pull']!.flags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'frozen-lockfile', type: 'boolean', default: false })]),
    );
    expect(document.commands!['threeify publish']!.flags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'version', required: true })]),
    );
    expect(document.commands!['threeify resolve']!.flags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'mode', default: 'auto' })]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
