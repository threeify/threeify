<p align="center">
  <a href="https://threeify.com"><img alt="Threeify logo" src="https://raw.githubusercontent.com/threeify/threeify/main/packages/docs/static/img/logo.png" height="96"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@threeify/runtime"><img src="https://img.shields.io/npm/v/@threeify/runtime.svg" alt="@threeify/runtime version on npm"></a>
  <a href="https://docs.landofassets.com/runtime-guide"><img src="https://img.shields.io/badge/docs-read-blue?style=flat" alt="documentation"></a>
  <a href="https://discord.gg/mrags8WyuH"><img src="https://img.shields.io/badge/chat-discord-blue?style=flat&logo=discord" alt="Discord community"></a>
</p>

# @threeify/runtime

> Resolve asset aliases in your applications.

Load the same versioned assets remotely or from a local checkout, with optional Vite integration for serving and bundling local files. Use it alongside the [Threeify CLI](https://www.npmjs.com/package/@threeify/cli).

## Installation

```sh
npm install @threeify/runtime
```

## Usage

```ts
import { loaResolver } from '@threeify/runtime';

const assets = await loaResolver({
  resolution: { chair: 'https://cdn.example.com/chair.glb' },
});
const modelUrl = assets.url('chair');
```

## Documentation

Read the [runtime guide](https://docs.landofassets.com/runtime-guide) and [asset manager guide](https://docs.landofassets.com/asset-manager) for resolution maps, Vite setup, local overrides, and deployment modes.

## Contribution

See the [contributing guide](https://github.com/threeify/threeify/blob/main/CONTRIBUTING.md).

## License

MIT. Built by [Ben Houston](https://ben3d.ca) for [Threeify](https://threeify.com).
