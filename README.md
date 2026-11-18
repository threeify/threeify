<p align="center">
  <a href="https://threeify.com">
    <img alt="Threeify logo" src="https://raw.githubusercontent.com/threeify/threeify/main/packages/docs/static/img/logo.png" height="96">
  </a>
</p>

<p align="center">
  <a href="https://docs.landofassets.com"><img src="https://img.shields.io/badge/docs-read-blue?style=flat" alt="documentation"></a>
  <a href="https://discord.gg/mrags8WyuH"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat&logo=discord" alt="Discord community"></a>
</p>

# Threeify

> Manage, version, and deliver 3D assets from your terminal, scripts, and applications.

These are the public, open-source modules for [Threeify](https://threeify.com): the `threeify` CLI, TypeScript SDK, and asset runtime. Upload and convert source files, keep asset selections in Git, and load the same assets remotely or from a local checkout.

The hosted platform is closed source. These modules are developed in the open, and public pull requests are welcome.

## Packages

| Package                                 | Version on npm                                                                                                            | Description                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [`@threeify/cli`](packages/cli)         | [![CLI version](https://img.shields.io/npm/v/@threeify/cli.svg)](https://www.npmjs.com/package/@threeify/cli)             | The `threeify` command-line interface     |
| [`@threeify/sdk`](packages/sdk)         | [![SDK version](https://img.shields.io/npm/v/@threeify/sdk.svg)](https://www.npmjs.com/package/@threeify/sdk)             | Typed client for the REST API             |
| [`@threeify/runtime`](packages/runtime) | [![Runtime version](https://img.shields.io/npm/v/@threeify/runtime.svg)](https://www.npmjs.com/package/@threeify/runtime) | Asset URL resolution and Vite integration |

## Get started

Install the CLI with Node.js 22.12 or newer:

```sh
npm install -g @threeify/cli
threeify --version
threeify auth login
```

Select a versioned asset, give it a local alias, and download your selections:

```sh
threeify add acme/furniture/chair@2.3.0 --as chair
threeify pull
```

The CLI records selections in `assets.json` and `assets-lock.json`. Commit those files alongside your application code. Native asset versions have verified hashes and share a global download store; HTTP(S) downloads use a project-local cache, and `file:` references remain live.

See the [asset manager guide](https://docs.landofassets.com/asset-manager) for source formats, workspaces, publication, and runtime integration. Run `threeify --help` for the command reference.

## Use it where you work

- **Terminal and CI:** use the [CLI guide](https://docs.landofassets.com/cli-guide) to manage assets, uploads, downloads, and automation.
- **TypeScript and Node.js:** call the REST API with the [SDK guide](https://docs.landofassets.com/sdk-guide).
- **Browsers and Vite:** resolve aliases and bundle local assets with the [runtime guide](https://docs.landofassets.com/runtime-guide).
- **Any language:** use the [REST API reference](https://docs.landofassets.com/api).

### Call the API from TypeScript

```sh
npm install @threeify/sdk
```

```ts
import { createSecretTokenInstance, listAssets } from '@threeify/sdk';

const client = createSecretTokenInstance({ secretToken: process.env.LOA_TOKEN! });
const assets = await listAssets(client, { query: { orgName: 'my-org', projectName: 'my-project' } });
```

Create an API token in the [Threeify dashboard](https://threeify.com). Read the [SDK guide](https://docs.landofassets.com/sdk-guide) for authentication, uploads, and examples.

## Documentation

Read the [developer documentation](https://docs.landofassets.com), [CLI reference](https://docs.landofassets.com/cli), [SDK reference](https://docs.landofassets.com/sdk), and [asset manager guide](https://docs.landofassets.com/asset-manager). Ask questions in the [Threeify Discord](https://discord.gg/mrags8WyuH).

The CLI uses `https://api.threeify.com` by default. Set a different endpoint with `threeify config set --host <url>` or `LOA_HOST`.

## Development

Use the Node.js and pnpm versions pinned in `.nvmrc` and `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm tsc
pnpm lint
pnpm test
```

Run the built CLI with `pnpm threeify --help`.

## Releases and migration

See [CONTRIBUTING.md](CONTRIBUTING.md) for the release workflow and [GitHub Releases](https://github.com/threeify/threeify/releases) for changes. Merging to `main` does not publish packages.

Packages use the `@threeify` scope, and the installed executable is `threeify`. Update dependencies, TypeScript imports, runtime/Vite subpaths, and `compilerOptions.types` entries to that scope. Existing `LOA_*` variables, credentials, asset manifests, cache locations, runtime APIs, and lockfile formats are unchanged. Earlier published versions are not removed or deprecated by this change.

Trusted publishing is configured per package for GitHub organization `threeify`, repository `threeify`, workflow `release.yml`, and environment `npm`. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Contribution

See the [contributing guide](CONTRIBUTING.md) for issues, pull requests, checks, and release conventions.

## License

MIT. See [LICENSE](LICENSE).

## Author

[Ben Houston](https://ben3d.ca), building [Threeify](https://threeify.com).
