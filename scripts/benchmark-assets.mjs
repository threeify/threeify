// pnpm build && node scripts/benchmark-assets.mjs /path/to/project [parallel=8]
// Uses isolated temporary projects and store; never alters the supplied project or default store.
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir, platform, release, arch } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(process.argv[2] ?? '.');
const parallel = Number(process.argv[3] ?? 8);
if (!Number.isInteger(parallel) || parallel < 1) throw new Error('parallel must be a positive integer');
const lock = JSON.parse(await readFile(join(source, 'assets-lock.json'), 'utf8'));
if (
  Object.keys(lock.importers).some((key) => key !== '.') ||
  Object.values(lock.importers['.'].assets).some((entry) => entry.kind !== 'loa')
) {
  throw new Error('Use a single-manifest project with only native assets for comparable cache measurements.');
}
const temporary = await mkdtemp(join(tmpdir(), 'loa-benchmark-'));
const store = join(temporary, 'store');
const cli = fileURLToPath(new URL('../packages/cli/dist/bin/loa.js', import.meta.url));
const samples = [];
const prepare = async (name) => {
  const directory = join(temporary, name);
  await mkdir(directory);
  for (const file of ['assets.json', 'assets-lock.json']) await cp(join(source, file), join(directory, file));
  return directory;
};
function measure(name, directory) {
  const start = performance.now();
  const result = spawnSync(process.execPath, [cli, 'install', '--frozen-lockfile', '--parallel', String(parallel)], {
    cwd: directory,
    env: { ...process.env, LOA_STORE_DIR: store },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  samples.push({
    name,
    seconds: (performance.now() - start) / 1000,
    stdout: result.stdout.trim(),
    stderr: result.stderr,
  });
}
try {
  const first = await prepare('first');
  measure('cold store and project', first);
  for (let i = 1; i <= 3; i++) measure(`warm reinstall ${i}`, first);
  for (let i = 1; i <= 3; i++) measure(`new project, warm store ${i}`, await prepare(`project-${i}`));
  console.log(
    JSON.stringify(
      {
        node: process.version,
        platform: `${platform()} ${release()} ${arch()}`,
        parallel,
        sources: Object.keys(lock.importers['.'].assets).length,
        samples,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
