# Threeify — public modules

This repository holds the public, open-source modules of [Threeify](https://threeify.com): the TypeScript SDK, the `loa` command-line tool, and the asset runtime. Use them to manage asset selections, load assets in applications, and integrate with the Threeify REST API from scripts and pipelines.

The Threeify platform itself is closed source. These modules are developed in the open so that integrating is easy, and so you can fix or improve them yourself. **Public pull requests are welcome.**

| Package                                 | npm                                                                                                       | Description                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [`@threeify/sdk`](packages/sdk)         | [![npm](https://img.shields.io/npm/v/@threeify/sdk)](https://www.npmjs.com/package/@threeify/sdk)         | Typed, functional client for the REST API |
| [`@threeify/cli`](packages/cli)         | [![npm](https://img.shields.io/npm/v/@threeify/cli)](https://www.npmjs.com/package/@threeify/cli)         | `loa` command-line interface              |
| [`@threeify/runtime`](packages/runtime) | [![npm](https://img.shields.io/npm/v/@threeify/runtime)](https://www.npmjs.com/package/@threeify/runtime) | Asset URL resolution and Vite integration |

## Asset manager

The `loa` CLI keeps asset selections in Git with `assets.json` and `assets-lock.json`. Native LoA versions have verified hashes and share a global download store; HTTP(S) URLs use a project-local cache when pulled, and `file:` references stay live. Load remotely or pull the same selections for offline use.

```sh
loa add acme/furniture/chair@2.3.0 --as chair
loa pull
```

Read the [asset manager overview](packages/docs/docs/asset-manager.md) for the philosophy, source rules, workspaces, publication, and runtime integration.

## Quick start

### SDK

```sh
npm install @threeify/sdk
```

```ts
import { createSecretTokenInstance, listAssets } from '@threeify/sdk';

const client = createSecretTokenInstance({ secretToken: process.env.LOA_TOKEN! });
const assets = await listAssets(client, { query: { orgName: 'my-org', projectName: 'my-project' } });
```

See the [SDK README](packages/sdk/README.md) for authentication options, uploads, and the full API surface.

### CLI

```sh
npm install -g @threeify/cli
loa auth login
loa assets list --org my-org --project my-project
```

You can also use `three` in place of `loa`, including the shortcuts `three login` and `three logout`. `three install` is an alias for `three pull`. Both executable names share configuration and credentials.

See the [CLI README](packages/cli/README.md) for every command, or run `loa --help`.

The packages require Node.js 22.12 or newer.

## Development

```sh
pnpm install
pnpm build
pnpm tsc
pnpm lint
pnpm test
```

The CLI talks to `https://api.threeify.com` by default. Use `loa config set --host <url>` or the `LOA_HOST` environment variable to point it elsewhere.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. In short: open an issue, branch from `main`, use Conventional Commits, and make sure the local checks pass. Releases to npm are cut by the maintainers from `main`.

## License

[MIT](LICENSE)

## Package scope migration

Packages are now named `@threeify/cli`, `@threeify/sdk`, and `@threeify/runtime`. Update package dependencies, TypeScript imports, runtime/Vite subpaths, and `compilerOptions.types` entries to the new scope. Install the CLI with `npm install -g @threeify/cli`. The `loa` and `three` commands, `LOA_*` variables, credentials, asset manifests, and lockfile formats are unchanged. Existing published packages are not removed or deprecated by this change.

Before publishing, ensure the npm `threeify` scope is controlled by the project and the new public packages have trusted publishing configured for GitHub organization `threeify`, repository `threeify`, workflow `release.yml`, and environment `npm`. Repository renames require checking these publisher bindings as well as package repository metadata. Use the established manually dispatched Release workflow; merging alone does not publish. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
