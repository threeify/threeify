<p align="center">
  <a href="https://threeify.com"><img alt="Threeify logo" src="https://raw.githubusercontent.com/threeify/threeify/main/packages/docs/static/img/logo.png" height="96"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@threeify/sdk"><img src="https://img.shields.io/npm/v/@threeify/sdk.svg" alt="@threeify/sdk version on npm"></a>
  <a href="https://docs.landofassets.com/sdk-guide"><img src="https://img.shields.io/badge/docs-read-blue?style=flat" alt="documentation"></a>
  <a href="https://discord.gg/mrags8WyuH"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat&logo=discord" alt="Discord community"></a>
</p>

# @threeify/sdk

> Call the Threeify REST API from TypeScript.

A typed client for assets, projects, uploads, conversions, and collaboration on [Threeify](https://threeify.com). Requires Node.js 22 or newer.

## Installation

```sh
npm install @threeify/sdk
```

## Usage

```ts
import { createSecretTokenInstance, listAssets } from '@threeify/sdk';

const client = createSecretTokenInstance({ secretToken: process.env.LOA_TOKEN! });
const assets = await listAssets(client, { query: { orgName: 'my-org', projectName: 'my-project' } });
```

Create an API token in the [Threeify dashboard](https://threeify.com).

## Documentation

Read the [SDK guide](https://docs.landofassets.com/sdk-guide) for authentication, uploads, and examples, or browse the [SDK API reference](https://docs.landofassets.com/sdk) and [REST API reference](https://docs.landofassets.com/api).

## Contribution

See the [contributing guide](https://github.com/threeify/threeify/blob/main/CONTRIBUTING.md).

## License

MIT. Built by [Ben Houston](https://ben3d.ca) for [Threeify](https://threeify.com).
