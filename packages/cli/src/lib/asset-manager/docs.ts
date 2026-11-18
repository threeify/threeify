import type { DocumentOverrides } from '@clidoc/core';

/** Longer command reference prose layered onto clidoc's generated arguments and flags. */
export const assetManagerDocs: DocumentOverrides = {
  commands: {
    'loa add': {
      description: [
        'Adds a source to the current `assets.json` and resolves it into the workspace-root `assets-lock.json`. Creates the manifest when needed. Adding an asset does not download its bytes.',
        'For native assets, use `org/project/asset@version`. Omit `@version` on the command line to select the latest version and save an exact pin. Numeric selectors such as `@2` and `@2.3`, and `@latest`, are also supported. `latest` means the highest numeric version, not the most recently uploaded version. The registry response supplies the hash; the asset file is not downloaded.',
        'The manifest key is a binding name. Use `--as` to choose an alias; otherwise native assets use their canonical ref as the key. A canonical key supports a bare version selector, for example `"acme/furniture/chair": "2.3.0"`. An alias uses the full source, for example `"chair": "acme/furniture/chair@2.3.0"`. The CLI writes shorthand for canonical bindings, while lockfiles always retain full source refs.',
        'Every HTTP(S) source is a direct, unverified URL, even if hosted by a LoA service or containing `@version`. Adding a URL does not fetch it or use the global store. Local paths become live `file:` references relative to the declaring manifest; they are not hashed, copied, or adopted into the registry.',
        'Run this command inside the workspace whose manifest should own the binding. All workspace aliases share one runtime namespace, so duplicates across manifests are rejected.',
        'Native references use `LOA_HOST` or the configured host, defaulting to `https://api.threeify.com`. The lockfile preserves the resolved host, so changing the environment does not redirect an existing locked asset. Native consumption uses anonymous requests.',
      ].join('\n\n'),
      examples: [
        { title: 'Add a native version with a local alias', content: 'loa add acme/furniture/chair@2.3.0 --as chair' },
        { title: 'Use the canonical ref as the binding name', content: 'loa add acme/furniture/chair@2.3.0' },
        {
          title: 'Add a direct URL or live local file',
          content: 'loa add https://example.com/downlight.ies --as downlight\nloa add ../brand/logo.png --as logo',
        },
      ],
    },
    'loa remove': {
      description: [
        'Removes the alias from the current manifest and its lockfile importer. In a workspace, run the command inside the manifest that owns the binding; an alias from another manifest is not removed.',
        'Reconciles the remaining workspace selection through the same install queue, then prunes obsolete local files, aliases and directories. Each native binding points directly to its global cached object, so removing a local path cannot invalidate another binding or delete cached bytes. The shared global store and live `file:` inputs are retained; `loa store prune` separately removes globally cached native content no registered project needs. `--parallel` caps install and cleanup tasks, defaulting to eight.',
      ].join('\n\n'),
      examples: [{ content: 'loa remove chair' }],
    },
    'loa pull': {
      description: [
        'Also available as `loa install` or `three install`, with the same options and behavior.',
        '`loa install` is an alias for `loa pull`, with identical flags. Interactive terminals show one updating progress line with completed sources and downloaded MiB; redirected output contains one completion summary. Resolves changed declarations and materializes the combined workspace asset set into project-local `assets/`. Every installed path is `assets/<manifest-key><extension>`. Every native binding is a relative symlink directly to its read-only global cache object, falling back to an independent copy if symlinks are unavailable. Native bindings never point to another local asset. Different versions coexist under different keys chosen with `--as`. Native bytes live only in the global cache and local assets, with no third versioned store. Direct URLs use the same key-based paths and stay project-local. Serve these files directly at `/assets/...` without a runtime adapter; ensure deployment tools follow symlinks. Conflicting local paths fail before project asset files are installed. Live files remain at their original locations. Metadata lookups, native downloads, local installation, alias creation, and pruning use one FIFO task queue. Each install or pull takes one snapshot of the local assets tree and removes files and directories absent from the required workspace layout. Scanning does not follow directory symlinks; cleanup preserves declared live inputs, local override files, URL metadata, and the global store. Unreferenced local branches can be removed during installation. Each completed metadata task can enqueue a native download immediately, so downloads overlap remaining metadata work. `--parallel` caps the whole queue across the workspace, with eight concurrent tasks by default. Unchanged bindings reuse their locked metadata without registry requests. Commit `assets.json` and `assets-lock.json`; the CLI adds generated cache and resolution-map paths to `.gitignore`.',
        'Native files are downloaded anonymously into the content-addressed global store and SHA-256 verified. Cached native bytes are checked before reuse. Local symlinks target the cache directly; removing them does not remove the cached object. Copies (preferably copy-on-write clones) are used only when symlinks are unavailable. Treat native installed paths as read-only; use live inputs or overrides for edits. Native project files remain read-only and integrity-checked; use local overrides or `file:` sources for drafts.',
        'Direct HTTP(S) URLs are downloaded only into this project cache without integrity checks. Existing downloads are reused; `--refresh` fetches their current response again. A failed refresh preserves an existing cached download. URL downloads never enter the global store.',
        '`file:` sources are never read, hashed, copied, or altered by pull. Offline use still requires those original files and any decoder/WASM resources used by your application to be available.',
        '`--frozen-lockfile` fails before fetching if the root lockfile is missing or differs from the manifests. It prevents resolution changes, but cannot make direct URLs or live files immutable. Use it in CI when selections must already be committed.',
        'Run `loa resolve` again after pulling if your application uses an exported JSON map. Applications using the Vite plugin obtain their map through `virtual:loa`.',
      ].join('\n\n'),
      examples: [
        { title: 'Pull the workspace asset set', content: 'loa pull' },
        { title: 'Require committed resolutions in CI', content: 'loa pull --frozen-lockfile' },
        { title: 'Refresh direct URL downloads', content: 'loa pull --refresh' },
      ],
    },
    'loa update': {
      description: [
        'Re-resolves native bindings within their declared selectors. An exact `@2.3.0` pin stays exact; `@2`, `@2.3`, and `@latest` can select newer matching versions. Omit the alias to update all native bindings across the workspace. Unrelated locked bindings remain unchanged.',
        '`--latest` selects the highest numeric version and rewrites the manifest value as a full `org/project/asset@version` exact pin. Canonical keys using a bare selector keep that shorthand; aliased bindings retain the full ref.',
        'Updates declarations and locks without downloading asset files. Direct URLs and live files are not version-updated. Use `loa pull --refresh` to refresh URL bytes, and `loa pull` to materialize newly selected native versions.',
        'The CLI writes sorted bindings with one entry per line and a trailing newline. Resolve manifest conflicts in Git and regenerate the lockfile with `loa pull`; do not hand-edit generated hashes.',
      ].join('\n\n'),
      examples: [
        { title: 'Update within the declared selector', content: 'loa update chair' },
        { title: 'Replace a pin with the latest version', content: 'loa update chair --latest' },
        { title: 'Update all native bindings', content: 'loa update' },
      ],
    },
    'loa outdated': {
      description: [
        'Checks locked native bindings for a higher numeric version on their recorded LoA host. Requires a lockfile matching the workspace manifests and does not change declarations, locks, or downloaded bytes.',
        'Prints a JSON array with `alias`, `current`, and `latest` for each outdated binding, sorted by alias. It does not include a separate highest-allowed ("wanted") version. Direct URL and live file sources are skipped.',
      ].join('\n\n'),
      examples: [{ content: 'loa outdated' }],
    },
    'loa publish': {
      description: [
        'Publishes a public immutable version to `--to org/project/asset`, using an exact `--version major.minor.patch`. Requires authentication and permission to write to the target organization and project. Use `loa auth login` to configure authentication.',
        'Creates the asset when it does not exist, inferring its type from the file extension; otherwise appends a new version. Existing version numbers are rejected and cannot be overwritten. Initial assets default to the `CC_BY` license unless `--license` is supplied. `--description` supplies the initial description or new-version release notes.',
        'Self-contained validation runs in the web service for both initial publication and new versions. The CLI does not inspect or package dependencies to enforce resource closure. GLB resources must be embedded. MaterialX packages must include required textures and documents safely within the archive; built-in standard node definitions do not need to be packaged. Missing, external, or escaping required resources are rejected by the service.',
        'Publication does not change the consuming manifest. Select the published version separately with `loa add` or `loa update` so the change can be reviewed with code. Existing administrative `loa assets create` and `loa assets upload` commands remain available.',
      ].join('\n\n'),
      examples: [
        {
          title: 'Publish, then select the new version',
          content:
            'loa auth login\nloa publish ./chair.glb --to acme/furniture/chair --version 3.0.0\nloa add acme/furniture/chair@3.0.0 --as chair',
        },
      ],
    },
    'loa resolve': {
      description: [
        'Writes an optional alias-to-URL map to `asset-resolution.json` at the workspace root. Requires a matching lockfile and makes no registry or download requests. Serve the JSON with your application and load it before the first asset request. Vite users can use `virtual:loa` instead of exporting this file.',
        'The default `auto` mode checks each native asset and direct URL for a pulled file in project-local `assets/`. Present files receive local URLs; absent files keep their remote URLs. Native local bytes are hash-verified before use; a mismatch fails without replacing the previous map. Direct URL downloads remain unverified. Live `file:` entries retain their live serving URLs. Optional workspace-root `assets.local.json` overrides take precedence in every mode: `{ "overrides": { "chair": "file:./drafts/chair.glb" } }`. Override paths are relative to that root; aliases must already exist. Overrides never change manifests or locks, and pull still installs published selections.',
        '`--mode remote` forces native and direct URL sources to their remote URLs. `--mode local` forces their expected project-cache URLs. Detection occurs when the command runs, not during a loader request; regenerate the map after pulling or removing local files.',
        'Use `--output` for another JSON destination and `--base-url` for the public prefix of local asset URLs. Configure your server to serve those paths. Live `file:` sources require explicit serving or bundling, including files outside the project directory; the Vite plugin supplies that integration.',
      ].join('\n\n'),
      examples: [
        { title: 'Prefer available local files', content: 'loa resolve' },
        { title: 'Force remote URLs', content: 'loa resolve --mode remote' },
        {
          title: 'Export local URLs under a deployment prefix',
          content: 'loa resolve --mode local --base-url /showroom/ --output public/asset-resolution.json',
        },
      ],
    },
    'loa store path': {
      description: [
        'Prints the active global native-asset store directory without downloading files. Set `LOA_STORE_DIR` to override the location.',
        '| Platform | Default location |\n| --- | --- |\n| macOS | `~/Library/Caches/loa` |\n| Linux | `$XDG_CACHE_HOME/loa`, or `~/.cache/loa` |\n| Windows | `%LOCALAPPDATA%\\loa\\Cache` |',
        'Only native LoA bytes belong in this store. Native materializations and direct URL downloads live together in project-local `assets/`, but direct URLs never use the global store. Live files stay at their original locations.',
      ].join('\n\n'),
      examples: [{ content: 'loa store path' }],
    },
    'loa store status': {
      description: [
        'Checks every native file in the global store against the SHA-256 encoded in its filename. Reports the number checked and succeeds when all bytes match. If any file is modified, the command lists the corrupt paths and exits unsuccessfully.',
        'This is an integrity check, not a repair operation. `loa pull` repairs required corrupt native content when it downloads the expected bytes again. Direct URL downloads and live `file:` references are not checked.',
      ].join('\n\n'),
      examples: [{ content: 'loa store status' }],
    },
    'loa store prune': {
      description: [
        'Removes globally cached native hashes that are not referenced by the current lockfiles of registered projects. Native pulls register the project root; clone and copy materializations are all tracked through project lockfiles rather than inode counts.',
        'Deleted projects no longer retain content. If an existing registered project has a missing or malformed lockfile, pruning fails rather than guessing which bytes are unused. It leaves project-local caches and live files untouched.',
        'Switching branches can make older asset versions useful again. If their global content was pruned, a later `loa pull` downloads it again. Removing a binding does not itself prune the store.',
      ].join('\n\n'),
      examples: [{ content: 'loa store prune' }],
    },
  },
};
