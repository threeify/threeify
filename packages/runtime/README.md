# @landofassets/runtime

Resolve Git-locked asset aliases in browsers and integrate them with Vite.

For static local URLs, the runtime is optional: run `loa install`, serve the generated `assets/` directory, and load `/assets/chair.glb` directly. Manifest keys determine `assets/<key><extension>` paths. Bindings selecting the same version share a local file through relative symlinks, with a copy fallback; different versions use separate manifest keys. Use this runtime when you need automatic remote/local resolution or live overrides.

```ts
import { loaResolver } from '@landofassets/runtime';
import resolution from 'virtual:loa';
const assets = await loaResolver({ resolution });
manager.setURLModifier(assets.urlModifier);
loader.load('loa:chair');
```

Add `loa()` from `@landofassets/runtime/vite` to Vite's plugins. The default `auto` mode prefers installed files and uses remote URLs for missing files. Choose `remote` explicitly to always use published URLs. Local overrides and live files take precedence in every mode and are bundled when building. With `loa({ mode: 'local' })`, run `loa pull` first; the plugin serves downloaded assets in development and emits them into builds. `file:` sources always read live from their declared location and are bundled at build time. TypeScript users can add `@landofassets/runtime/virtual` to `compilerOptions.types` for the virtual module declaration.

Native assets are hash-verified. Direct HTTP(S) URLs and live files deliberately have no integrity pin. Both native assets and direct URL downloads are materialized in the project's `assets/`. Only native assets use the global store; live files stay at their original paths.

`loaResolver` always returns a promise and accepts `{ resolution }`. Supply the map yourself and await initialization before loading assets.

Without Vite, run `loa resolve` to generate `asset-resolution.json`, preferring pulled files in `assets/` and using remote URLs for missing files. Fetch and parse that map in your application, then pass it to `await loaResolver({ resolution })` before creating loaders. The resolver does not fetch the map. Non-`loa:` loader URLs pass through unchanged; unknown aliases throw.

```ts
const response = await fetch('/asset-resolution.json');
if (!response.ok) throw new Error(`Could not load asset map: HTTP ${response.status}`);
const resolution = await response.json();
const assets = await loaResolver({ resolution });
```

For unpublished experiments, create a gitignored `assets.local.json` beside the root lockfile:

```json
{ "overrides": { "chair": "file:./drafts/chair.glb" } }
```

Paths are relative to that root. Use the existing binding name, including for workspace assets. Vite serves edits live and reloads when overrides or installed files are added or removed. Remove the override entry to return to the selected installed or remote version. `loa resolve` also honors overrides; custom servers must serve its generated live-file routes. `loa install` still installs the tracked selections and never writes drafts into the shared store.

Native installed files use copy-on-write clones or independent copies, so edits and deletion cannot mutate the store. Integrity checks still reject edited installed native files; use an override for deliberate changes.
