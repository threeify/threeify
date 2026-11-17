---
title: Asset manager
sidebar_position: 1
description: Keep asset selections in Git and load the same assets from the cloud or a local checkout with the loa CLI.
---

# Asset manager

Build with a shared asset library without filling your Git repository with large binary files. The `loa` CLI lets you reuse models, materials, images, and lighting across projects while keeping each application's asset choices in a small, reviewable manifest.

Pin an immutable version so a new upload cannot unexpectedly change your scene. Review asset updates alongside the code that uses them, try a different chair or lighting rig on a feature branch, and return to the previous selection when needed. Teammates and CI can install the same verified native assets, with a shared cache that avoids downloading identical bytes for every project.

Start loading from the cloud without installing files first, install assets for offline work, or bundle them into a self-contained deployment. Mix published LoA assets with direct URLs and live local files as you develop, then publish the assets you want to share and pin. Your code keeps the same asset names as the project grows.

## Select assets with your code

Install the CLI, then [add an asset](./cli/loa-add.md) from your application's directory. Replace the example with a public asset you can access:

```sh
npm install -g @landofassets/cli
loa add acme/furniture/chair@2.3.0 --as chair
```

The CLI writes `assets.json` and `assets-lock.json`. Commit both with your code. The manifest says what you want; the lockfile records the resolved versions and native content hashes.

```json
{
  "name": "showroom",
  "assets": {
    "chair": "acme/furniture/chair@2.3.0"
  }
}
```

Keys name bindings used by your code. Values contain the full source, even if you use the canonical `org/project/asset` name as the key.

## Choose a source

| Source                                               | Behavior                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Native LoA ref, such as `acme/furniture/chair@2.3.0` | An immutable version with a verified content hash and shared global cache               |
| Direct HTTP(S) URL                                   | Loaded directly or installed into the project cache, without integrity checks           |
| Live `file:` reference                               | Loaded from its original location; edits stay live and installation leaves it untouched |

Only native LoA versions guarantee pinned bytes. Publish an asset when you need repeatable consumption; use URLs and local files for inputs that may change. See [`loa add`](./cli/loa-add.md) for source syntax, aliases, and version selection.

## Work from the cloud or locally

You can load native assets remotely without downloading them first. To work locally, [install the selected assets](./cli/loa-pull.md):

```sh
# pull and install are aliases
loa install
# Or use the three executable alias:
three install
```

All installed files live in the project's gitignored `asset_cache/`. Native files come through the verified global store; direct URL downloads stay project-local. Live files stay at their original locations. The [`install` / `pull` reference](./cli/loa-pull.md) covers offline requirements, frozen lockfiles, refreshing URL downloads, and cache behavior.

## Load assets in an application

`loaResolver` turns a JSON map of binding names to URLs into a resolver. It always returns a promise and takes an in-memory map (`{ resolution }`). Your application loads the map before initializing the resolver; the resolver does not fetch it.

Install the runtime:

```sh
npm install @landofassets/runtime
```

Use [`loa resolve`](./cli/loa-resolve.md) to export `asset-resolution.json`. It prefers locally installed files where present and remote URLs otherwise. The map associates each binding name with its resolved URL, for example:

```json
{
  "chair": "https://example.com/models/chair.glb"
}
```

Serve the map with your application, then fetch and parse it before creating the resolver. Your application controls the request, caching, and error handling:

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loaResolver } from '@landofassets/runtime';

const response = await fetch('/asset-resolution.json');
if (!response.ok) throw new Error(`Could not load asset map: HTTP ${response.status}`);
const resolution = await response.json();
const assets = await loaResolver({ resolution });

new GLTFLoader().load(assets.url('chair'), (gltf) => scene.add(gltf.scene));
```

`assets.url('chair')` returns the URL for that binding, ready to pass to any loader. Binding names do not need a `loa:` prefix. See the [`resolve` reference](./cli/loa-resolve.md) for mode overrides, serving local files, and regenerating the map.

If you prefer passing an alias directly to a three.js loader, register the optional URL modifier:

```ts
import { LoadingManager } from 'three';

const manager = new LoadingManager();
manager.setURLModifier(assets.urlModifier);
new GLTFLoader(manager).load('loa:chair', (gltf) => scene.add(gltf.scene));
```

Only this URL-modifier form requires `loa:`. The modifier receives every loader URL; the prefix distinguishes asset bindings from ordinary URLs and relative paths for textures, decoders, and other resources, which pass through unchanged. `loader.load('chair')` alone does not resolve a binding; use `loader.load(assets.url('chair'))` to avoid the prefix.

### Vite

The Vite plugin provides the resolution map through `virtual:loa`, so your application can import it instead of fetching a JSON file. Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { loa } from '@landofassets/runtime/vite';

export default defineConfig({
  plugins: [loa()],
});
```

Use `remote` for cloud loading or `local` after installation to serve local files and include them in a production build.

For TypeScript, include the virtual module declaration in your application's environment declarations:

```ts
/// <reference types="@landofassets/runtime/virtual" />
```

Then resolve the binding name before passing its URL to a loader:

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loaResolver } from '@landofassets/runtime';
import resolution from 'virtual:loa';

const assets = await loaResolver({ resolution });
new GLTFLoader().load(assets.url('chair'), (gltf) => scene.add(gltf.scene));
```

Both examples use the same `loaResolver({ resolution })` API; Vite supplies the map through an import instead of an application-managed JSON request.

## Try unpublished changes

Keep application code using stable aliases such as `loa:chair`. The manifest and lockfile select the published version; the loader never needs its version number or canonical registry name.

For a local experiment, create `assets.local.json` beside the root lockfile:

```json
{
  "overrides": {
    "chair": "file:./drafts/chair.glb"
  }
}
```

`loa add` and `loa install` add this file to `.gitignore`; add it manually if you create manifests without those commands. Paths are relative to the workspace root, and keys must match existing aliases. Overrides take precedence in every resolution mode. The Vite plugin serves the draft, observes edits, and bundles it when building. With `loa resolve`, regenerate the map after changing overrides and configure your server to serve the generated live-file routes.

Remove an override to return to the installed selection, or its remote URL if no installed copy exists in `auto` mode. `loa install` (an alias for `loa pull`) continues to install the tracked versions and leaves drafts untouched. Publish an approved draft, then update the manifest to share it with teammates.

Native installed files use copy-on-write clones where supported, with independent copies as the fallback. Editing or deleting them cannot change the shared store. Native integrity checks reject edited installed bytes, so use overrides for deliberate edits. Filesystem support determines disk savings; independent copies consume additional space.

## Review and change selections

Asset selections travel with code branches and reviews. Use the command references for individual operations:

| Command                                 | Purpose                                              |
| --------------------------------------- | ---------------------------------------------------- |
| [`loa add`](./cli/loa-add.md)           | Select an asset or change an existing binding        |
| [`loa remove`](./cli/loa-remove.md)     | Remove a binding                                     |
| [`loa outdated`](./cli/loa-outdated.md) | Find newer published versions                        |
| [`loa update`](./cli/loa-update.md)     | Update selected versions                             |
| [`loa publish`](./cli/loa-publish.md)   | Publish an immutable version for consumers to select |

Publishing and selecting are separate actions, so a newly published version can be adopted through a code review. The publish reference covers authentication, versions, and server-side asset validation.

## Share assets across workspaces

Large projects can keep an `assets.json` in each level, area, or package and list their directories in a root manifest:

```json
{
  "name": "world",
  "assets": {},
  "workspaces": ["levels/*"]
}
```

One root `assets-lock.json` records the combined selections. Each manifest owns its declarations; the runtime uses one shared binding namespace. See [`add`](./cli/loa-add.md), [`remove`](./cli/loa-remove.md), and [`install`](./cli/loa-pull.md) for workspace command behavior.

## Maintain the shared store

The CLI provides [`loa store path`](./cli/loa-store-path.md), [`loa store status`](./cli/loa-store-status.md), and [`loa store prune`](./cli/loa-store-prune.md). Their reference pages describe configuration and maintenance.

See the [CLI reference](/cli) for all commands and the [SDK reference](/sdk) for programmatic catalog and publication APIs.
