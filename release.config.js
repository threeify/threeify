import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Packages published to npm, in dependency order (runtime and SDK before CLI).
// pnpm publish rewrites workspace:* to a resolved semver range natively.
const packages = ['packages/runtime', 'packages/sdk', 'packages/cli'];

export default {
  branches: ['main'],
  repositoryUrl: 'https://github.com/threeify/threeify.git',
  tagFormat: 'v${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    // pkgRoot only (no tarballDir): @anolilab/semantic-release-pnpm's tarballDir option
    // shells out to `pnpm pack <pkgRoot>`, which pnpm packs from the cwd instead -- pack
    // explicitly below, once both packages have their final bumped version.
    ...packages.map((path) => ['@anolilab/semantic-release-pnpm', { pkgRoot: path }]),
    {
      prepare: () => {
        // Absolute destination: `pnpm --dir <path>` changes pnpm's cwd, so a relative
        // destination would land inside each package instead of the repo-root
        // `release-artifacts` that @semantic-release/github globs for its release assets.
        const tarballDir = resolve('release-artifacts');
        for (const path of packages) {
          execFileSync('pnpm', ['--dir', path, 'pack', '--pack-destination', tarballDir], {
            stdio: 'inherit',
          });
        }
      },
    },
    [
      '@semantic-release/github',
      {
        assets: ['release-artifacts/*.tgz'],
        successComment: false,
        failComment: false,
        releasedLabels: false,
      },
    ],
  ],
};
