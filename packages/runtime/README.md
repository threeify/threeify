# @landofassets/runtime

Resolve Git-locked asset aliases synchronously in browsers and integrate them with Vite.

```ts
import { loaResolver } from '@landofassets/runtime';
import resolution from 'virtual:loa';
const assets = await loaResolver({ resolution });
manager.setURLModifier(assets.urlModifier);
loader.load('loa:chair');
```

Add `loa()` from `@landofassets/runtime/vite` to Vite's plugins. The default `remote` mode loads native assets and direct URLs remotely and bundles live files. With `loa({ mode: 'local' })`, run `loa pull` first; the plugin serves downloaded assets in development and emits them into builds. `file:` sources always read live from their declared location and are bundled at build time. TypeScript users can add `@landofassets/runtime/virtual` to `compilerOptions.types` for the virtual module declaration.

Native assets are hash-verified. Direct HTTP(S) URLs and live files deliberately have no integrity pin. Both native assets and direct URL downloads are materialized in the project's `asset_cache/`. Only native assets use the global store; live files stay at their original paths.

`loaResolver` always returns a promise and accepts `{ resolution }`. Supply the map yourself and await initialization before loading assets.

Without Vite, run `loa resolve` to generate `asset-resolution.json`, preferring pulled files in `asset_cache/` and using remote URLs for missing files. Fetch and parse that map in your application, then pass it to `await loaResolver({ resolution })` before creating loaders. The resolver does not fetch the map. Non-`loa:` loader URLs pass through unchanged; unknown aliases throw.

```ts
const response = await fetch('/asset-resolution.json');
if (!response.ok) throw new Error(`Could not load asset map: HTTP ${response.status}`);
const resolution = await response.json();
const assets = await loaResolver({ resolution });
```
