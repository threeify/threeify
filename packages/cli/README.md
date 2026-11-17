# @landofassets/cli

Command-line interface for the [Land of Assets](https://landofassets.com) platform.

## Installation

```bash
npm install -g @landofassets/cli
# or
pnpm add -g @landofassets/cli
# or
yarn global add @landofassets/cli
```

Both `loa` and `three` run the same CLI and share configuration and credentials.
For example, `three auth login` works just like `loa auth login`.

## Quick Start

```bash
# Authenticate with your account
loa auth login

# List your organizations
loa orgs list

# List projects in an organization
loa projects list --org my-org

# List assets in a project
loa assets list --org my-org --project my-project
```

> **Tip**: Use `loa <command> --help` or `loa <category> --help` to see available commands and their descriptions. For example, `loa auth --help` or `loa assets --help`.

## Asset manager

`install` is an alias for `pull`: use `three install` or `loa install` with the same `--frozen-lockfile`, `--refresh`, and `--parallel` options.

Keep consuming asset selections in Git with `assets.json` and `assets-lock.json`. LoA stores immutable native versions; Git branches and merges the selections alongside your code.

```sh
loa add acme/furniture/chair@2.3.0 --as chair
loa add https://example.com/lights/downlight.ies --as downlight
loa add ../brand/logo.png --as logo
loa pull
loa resolve
```

For a static site, run `loa install` and load `/assets/chair.glb` directly. Assets install at `assets/<manifest-key><extension>`; canonical keys can use bare version values, while short aliases specify full refs. Every native binding links directly to the global cached object, or receives an independent copy when symlinks are unavailable. Different versions can coexist under different keys. No runtime adapter is required. Serve `assets/` at the same URL path, or copy it into your build output, dereferencing symlinks if needed. Commit the manifests and lockfile; CI can use `loa install --frozen-lockfile`.

Native refs are hash-verified and downloaded into a global store, then linked directly into `assets/` from the read-only global cache, with clone/copy fallback. Direct HTTP(S) URLs skip integrity checks and global caching; `pull` downloads them into project-local `assets/`, and `pull --refresh` fetches them again. `file:` entries load live from their manifest-relative location and are never copied, hashed, or changed by `pull`. Adding any source does not download its bytes.

| Command                                                           | Purpose                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `loa add <source> [--as alias]`                                   | Add a native ref, direct URL, or local file; update the manifest and lock |
| `loa remove <alias>`                                              | Remove a declaration and its lock entry                                   |
| `loa pull [--frozen-lockfile] [--refresh]`                        | Materialize locked assets; frozen mode requires matching declarations     |
| `loa update [alias] [--latest]`                                   | Re-resolve selectors, or update pins to latest                            |
| `loa outdated`                                                    | Show native selections with newer versions                                |
| `loa publish <file> --to <org/project/asset> --version <version>` | Publish an immutable version; server validates self-contained resources   |
| `loa resolve [--mode auto\|remote\|local]`                        | Write `asset-resolution.json`, preferring locally pulled files by default |
| `loa store <command>`                                             | Inspect and maintain the native global store                              |

Ignore `assets/` and generated `asset-resolution.json`; commit the manifest and lockfile. Only native assets have reproducible verified bytes. External URLs and live files remain mutable even with `--frozen-lockfile`.

Use `@landofassets/runtime` to resolve aliases in an application and `@landofassets/runtime/vite` to serve or bundle local assets. The [asset manager overview](../docs/docs/asset-manager.md) covers runtime integration, workspaces, deployment modes, and the source model.

## Commands

### Authentication

`login` and `logout` are also available as top-level shortcuts with the same options.
Both executable names support these shortcuts:

```bash
three login            # Same as three auth login
three logout           # Same as three auth logout
loa login              # Same as loa auth login
loa logout             # Same as loa auth logout
```

```bash
loa auth login          # Log in to your account (opens browser)
loa auth logout         # Log out and clear credentials
loa auth status         # Show current authentication status
```

### Configuration

```bash
loa config set --org <org> [--project <project>]   # Set default org and/or project
loa config get                                    # Get current configuration
loa config clear [--org] [--project]              # Clear configuration
```

### Organizations

```bash
loa orgs list                  # List all organizations
loa orgs get <slug>            # Get organization details
loa orgs create                # Create a new organization
loa orgs update <slug>         # Update an organization
loa orgs delete <slug>         # Delete an organization
```

### Projects

```bash
loa projects list --org <org>                    # List projects
loa projects get --org <org> --project <slug>    # Get project details
loa projects create --org <org>                  # Create a new project
loa projects update --org <org> --project <slug> # Update a project
loa projects delete --org <org> --project <slug> # Delete a project
```

### Assets

```bash
loa assets list --org <org> --project <project>                 # List assets
loa assets get --org <org> --project <project> --asset <slug>   # Get asset details
loa assets create --org <org> --project <project>               # Create a new asset
loa assets update --org <org> --project <project> --asset <slug> # Update an asset
loa assets delete --org <org> --project <project> --asset <slug> # Delete an asset
loa assets download --org <org> --project <project> --asset <slug> # Download asset files
loa assets thumbnail --org <org> --project <project> --asset <slug> # Get asset thumbnail
```

### Members

```bash
loa members list --org <org> [--project <project>]                # List members
loa members update <userName> --role <role> --org <org> [--project <project>]  # Update member role
loa members delete <userName> --org <org> [--project <project>]  # Remove member
```

### Member Invites

```bash
loa member-invites create <usernameOrEmail> --org <org> [--project <project>]  # Invite a user
loa member-invites list --org <org> [--project <project>]         # List invites
loa member-invites delete <memberInviteId>                       # Delete an invite
```

### Webhooks

```bash
loa webhooks create <url> --org <org> [--project <project>] --events <events>  # Create webhook
loa webhooks list --org <org> [--project <project>]         # List webhooks
loa webhooks delete <webhookId> --org <org> [--project <project>]  # Delete webhook
```

### API Tokens

```bash
loa api-tokens list          # List your API tokens
loa api-tokens create        # Create a new API token
loa api-tokens delete <id>   # Delete an API token
```

### Service Accounts

```bash
loa service-accounts list --org <org>          # List service accounts
loa service-accounts create --org <org>        # Create a service account
loa service-accounts delete --org <org> --id <id> # Delete a service account
```

### Comments

```bash
loa comments list --org <org> --project <project> --asset <asset>     # List comments
loa comments create --org <org> --project <project> --asset <asset>   # Create comment
loa comments edit --org <org> --project <project> --asset <asset> --id <id> # Edit comment
loa comments delete --org <org> --project <project> --asset <asset> --id <id> # Delete comment
```

### Notifications

```bash
loa notifications list             # List notifications
loa notifications mark-read <id>   # Mark notification as read
loa notifications mark-all-read    # Mark all notifications as read
```

### Health Check

```bash
loa health                 # Check API health status
```

## Configuration

The CLI stores configuration in `~/.config/loa/config.json`. Available settings:

- `host` - API base URL (default: `https://api.landofassets.com`, typically doesn't need to be set)
- `output` - Output format: `json`, `yaml`, or `csv` (default: `json`)

### Default Organization and Project

You can set a default organization and/or project to avoid specifying them with each command. This is useful if you're always working with a specific org or org/project combination.

```bash
# Set default organization
loa config set --org my-org

# Set both default organization and project
loa config set --org my-org --project my-project
```

Once set, you can omit the `--org` and `--project` flags from commands. For example:

```bash
# Without defaults
loa assets list --org my-org --project my-project

# With defaults set
loa assets list
```

To clear defaults, use `loa config clear --org` or `loa config clear --project`.

## Environment Variables

- `LOA_HOST` - Override the API host
- `LOA_TOKEN` - Provide an API token for authentication
- `LOA_STORE_DIR` - Override the shared native asset store location

## Requirements

- Node.js >= 22.12.0

## License

MIT

## Asset versions

```sh
# Publish the next major version (e.g. 2.0.0 after 1.0.0)
loa assets upload --org acme --project library --asset chair --file chair.glb
# Publish an explicit unused version
loa assets upload --org acme --project library --asset chair --file chair.glb --version 2.1.0
loa assets versions --org acme --project library --asset chair --format json
loa assets get --org acme --project library --asset chair --version 2.1
loa assets download --org acme --project library --asset chair --version latest --format glb
```

Creation defaults to `1.0.0` and accepts an explicit `--version`. Reads use a separate `--version` option supporting exact, minor, major, and `latest` selectors. Omit it to select latest; `--asset` must contain only the bare name. `latest` means the highest numeric version; uploads may be out of order. Existing versions cannot be overwritten. Each version retains its own thumbnail, uploader, and creation time. `assets update` edits metadata; `assets upload` publishes file versions.

### IES photometric lights

`.ies` files infer the `LIGHT` asset type and `application/ies` MIME type. You can also select
`--type LIGHT` explicitly. Original downloads retain the IES source; omit `--format` when downloading.

```sh
loa assets create --org acme --project lighting --asset spotlight --file spotlight.ies --visibility PRIVATE
loa assets list --org acme --project lighting --type LIGHT
loa assets upload --org acme --project lighting --asset spotlight --file spotlight.ies --version 1.1.0
loa assets download --org acme --project lighting --asset spotlight@1.1.0 --output spotlight.ies
```

### Tasks

Manage background jobs in a project. Organization and project can also come from `loa config set` defaults.

```sh
loa tasks list --org my-org --project my-project --page-size 20 --sort-by createdAt --sort-dir desc
loa tasks get 123 --org my-org --project my-project
loa tasks retry 123 --org my-org --project my-project
```

`list` supports `--page-offset` and `--page-size` (1–1000). `get` includes the latest run status and results; a null latest run status means the task has no run yet. `retry` re-queues an existing task and prints `{ "success": true }` when accepted; it does not wait for completion. IDs must be positive integers. All three commands support `--format json|yaml|csv`.

For a personal backend, set `LOA_HOST=http://localhost:3001` and log in to that host before running commands. Tasks use the existing project permissions and authentication.

### Files

Download a storage file using an OID from task results (for example, `latestRunResults.oid`):

```sh
loa files download <oid> --output generated.glb
```

The OID must be 64 lowercase hexadecimal characters. `--output` (`-o`) defaults to the OID in the current directory. Downloads stream to disk, refuse to overwrite existing files, and remove incomplete output if downloading fails. Parent directories must already exist.

This uses the configured host (`LOA_HOST` or `loa config set --host`) and the existing anonymous `/files/:oid` endpoint. Anyone who knows an OID can download that file; login and project permissions are not checked by that endpoint. Stored credentials are not sent by this command.

## Positional asset references

Asset-targeting commands accept either one positional `asset[@version]` or explicit `--asset` / `--version` options. Never combine the two forms, even when values agree. `--asset` always takes a bare name.

```sh
loa config set --org acme --project library
loa assets thumbnail MyChair
loa assets thumbnail MyChair@2.1.3
loa assets thumbnail --asset MyChair --version 2.1.3
loa assets download MyChair@2.1 --format glb
loa assets get MyChair@latest
loa assets upload MyChair@2.2.0 --file chair.glb
loa assets create NewChair@1.0.0 --file chair.glb --visibility PRIVATE
loa assets versions MyChair
loa assets update MyChair --description "Updated description"
loa assets delete MyChair
loa comments list MyChair
loa comments edit 123 MyChair --text "Updated comment"
```

Org and project use the existing configured defaults; explicit `--org` and `--project` override them. Reads (`get`, `download`, `thumbnail`) accept selectors. Publications (`create`, `upload`) require exact `major.minor.patch` versions when provided. `create` still infers a name from the file when neither form specifies one. Whole-asset commands (`update`, `delete`, `versions`, and comments) accept only bare names and reject versions.

`loa install`, `loa pull`, and `loa remove` also prune obsolete local files, aliases, and directories from `assets/`. Scanning and cleanup reuse the installation task queue and its `--parallel` cap. Native aliases target the global cache directly; pruning local links leaves cached bytes untouched. The global cache, declared live inputs, and local override files are retained. Keep unreferenced source files outside the managed `assets/` output.
