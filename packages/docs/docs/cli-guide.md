---
title: CLI guide
description: Install the CLI, authenticate, and manage Threeify assets from the terminal.
---

Command-line interface for the [Threeify](https://threeify.com) platform.

## Installation

```bash
npm install -g @threeify/cli
# or
pnpm add -g @threeify/cli
# or
yarn global add @threeify/cli
```

The installed executable is `threeify`. Run `threeify --version` to report the installed package version.

## Quick Start

```bash
# Authenticate with your account
threeify auth login

# List your organizations
threeify orgs list

# List projects in an organization
threeify projects list --org my-org

# List assets in a project
threeify assets list --org my-org --project my-project
```

> **Tip**: Use `threeify <command> --help` or `threeify <category> --help` to see available commands and their descriptions. For example, `threeify auth --help` or `threeify assets --help`.

## Asset manager

`install` is an alias for `pull`: use `threeify install` with the same `--frozen-lockfile`, `--refresh`, and `--parallel` options.

Keep consuming asset selections in Git with `assets.json` and `assets-lock.json`. LoA stores immutable native versions; Git branches and merges the selections alongside your code.

```sh
threeify add acme/furniture/chair@2.3.0 --as chair
threeify add https://example.com/lights/downlight.ies --as downlight
threeify add ../brand/logo.png --as logo
threeify pull
threeify resolve
```

For a static site, run `threeify install` and load `/assets/chair.glb` directly. Assets install at `assets/<manifest-key><extension>`; canonical keys can use bare version values, while short aliases specify full refs. Every native binding links directly to the global cached object, or receives an independent copy when symlinks are unavailable. Different versions can coexist under different keys. No runtime adapter is required. Serve `assets/` at the same URL path, or copy it into your build output, dereferencing symlinks if needed. Commit the manifests and lockfile; CI can use `threeify install --frozen-lockfile`.

Native refs are hash-verified and downloaded into a global store, then linked directly into `assets/` from the read-only global cache, with clone/copy fallback. Direct HTTP(S) URLs skip integrity checks and global caching; `pull` downloads them into project-local `assets/`, and `pull --refresh` fetches them again. `file:` entries load live from their manifest-relative location and are never copied, hashed, or changed by `pull`. Adding any source does not download its bytes.

| Command                                                                | Purpose                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `threeify add <source> [--as alias]`                                   | Add a native ref, direct URL, or local file; update the manifest and lock |
| `threeify remove <alias>`                                              | Remove a declaration and its lock entry                                   |
| `threeify pull [--frozen-lockfile] [--refresh]`                        | Materialize locked assets; frozen mode requires matching declarations     |
| `threeify update [alias] [--latest]`                                   | Re-resolve selectors, or update pins to latest                            |
| `threeify outdated`                                                    | Show native selections with newer versions                                |
| `threeify publish <file> --to <org/project/asset> --version <version>` | Publish an immutable version; server validates self-contained resources   |
| `threeify resolve [--mode auto\|remote\|local]`                        | Write `asset-resolution.json`, preferring locally pulled files by default |
| `threeify store <command>`                                             | Inspect and maintain the native global store                              |

Ignore `assets/` and generated `asset-resolution.json`; commit the manifest and lockfile. Only native assets have reproducible verified bytes. External URLs and live files remain mutable even with `--frozen-lockfile`.

Use `@threeify/runtime` to resolve aliases in an application and `@threeify/runtime/vite` to serve or bundle local assets. The [asset manager overview](./asset-manager.md) covers runtime integration, workspaces, deployment modes, and the source model.

## Commands

### Authentication

`login` and `logout` are also available as top-level shortcuts with the same options.
Both executable names support these shortcuts:

```bash
threeify login            # Same as threeify auth login
threeify logout           # Same as threeify auth logout
threeify login              # Same as threeify auth login
threeify logout             # Same as threeify auth logout
```

```bash
threeify auth login          # Log in to your account (opens browser)
threeify auth logout         # Log out and clear credentials
threeify auth status         # Show current authentication status
```

`threeify auth status` displays the API host, authenticated username, login time,
and session expiry in UTC. It validates the current credential with the server,
including credentials supplied through `LOA_TOKEN`. For API tokens, it also shows
the token creation time and reports that the token never expires; the login time
is when `threeify auth login --token` saved it locally. Login times are unknown for
environment tokens and tokens saved by older CLI versions. Servers that do not
yet provide credential details show unknown identity and expiry values.

### Configuration

```bash
threeify config set --org <org> [--project <project>]   # Set default org and/or project
threeify config get                                    # Get current configuration
threeify config clear [--org] [--project]              # Clear configuration
```

### Organizations

```bash
threeify orgs list                  # List all organizations
threeify orgs get <slug>            # Get organization details
threeify orgs create                # Create a new organization
threeify orgs update <slug>         # Update an organization
threeify orgs delete <slug>         # Delete an organization
```

### Projects

```bash
threeify projects list --org <org>                    # List projects
threeify projects get --org <org> --project <slug>    # Get project details
threeify projects create --org <org>                  # Create a new project
threeify projects update --org <org> --project <slug> # Update a project
threeify projects delete --org <org> --project <slug> # Delete a project
```

### Assets

```bash
threeify assets list --org <org> --project <project>                 # List assets
threeify assets get --org <org> --project <project> --asset <slug>   # Get asset details
threeify assets create --org <org> --project <project>               # Create a new asset
threeify assets update --org <org> --project <project> --asset <slug> # Update an asset
threeify assets delete --org <org> --project <project> --asset <slug> # Delete an asset
threeify assets download --org <org> --project <project> --asset <slug> # Download asset files
threeify assets thumbnail --org <org> --project <project> --asset <slug> # Get asset thumbnail
```

### Members

```bash
threeify members list --org <org> [--project <project>]                # List members
threeify members update <userName> --role <role> --org <org> [--project <project>]  # Update member role
threeify members delete <userName> --org <org> [--project <project>]  # Remove member
```

### Member Invites

```bash
threeify member-invites create <usernameOrEmail> --org <org> [--project <project>]  # Invite a user
threeify member-invites list --org <org> [--project <project>]         # List invites
threeify member-invites delete <memberInviteId>                       # Delete an invite
```

### Webhooks

```bash
threeify webhooks create <url> --org <org> [--project <project>] --events <events>  # Create webhook
threeify webhooks list --org <org> [--project <project>]         # List webhooks
threeify webhooks delete <webhookId> --org <org> [--project <project>]  # Delete webhook
```

### API Tokens

```bash
threeify api-tokens list          # List your API tokens
threeify api-tokens create        # Create a new API token
threeify api-tokens delete <id>   # Delete an API token
```

### Service Accounts

```bash
threeify service-accounts list --org <org>          # List service accounts
threeify service-accounts create --org <org>        # Create a service account
threeify service-accounts delete --org <org> --id <id> # Delete a service account
```

### Comments

```bash
threeify comments list --org <org> --project <project> --asset <asset>     # List comments
threeify comments create --org <org> --project <project> --asset <asset>   # Create comment
threeify comments edit --org <org> --project <project> --asset <asset> --id <id> # Edit comment
threeify comments delete --org <org> --project <project> --asset <asset> --id <id> # Delete comment
```

### Notifications

```bash
threeify notifications list             # List notifications
threeify notifications mark-read <id>   # Mark notification as read
threeify notifications mark-all-read    # Mark all notifications as read
```

### Health Check

```bash
threeify health                 # Check API health status
```

## Configuration

The CLI stores configuration in `~/.config/loa/config.json`. Available settings:

- `host` - API base URL (default: `https://api.threeify.com`, typically doesn't need to be set)
- `output` - Output format: `json`, `yaml`, or `csv` (default: `json`)

### Default Organization and Project

You can set a default organization and/or project to avoid specifying them with each command. This is useful if you're always working with a specific org or org/project combination.

```bash
# Set default organization
threeify config set --org my-org

# Set both default organization and project
threeify config set --org my-org --project my-project
```

Once set, you can omit the `--org` and `--project` flags from commands. For example:

```bash
# Without defaults
threeify assets list --org my-org --project my-project

# With defaults set
threeify assets list
```

To clear defaults, use `threeify config clear --org` or `threeify config clear --project`.

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
threeify assets upload --org acme --project library --asset chair --file chair.glb
# Publish an explicit unused version
threeify assets upload --org acme --project library --asset chair --file chair.glb --version 2.1.0
threeify assets versions --org acme --project library --asset chair --format json
threeify assets get --org acme --project library --asset chair --version 2.1
threeify assets download --org acme --project library --asset chair --version latest --format glb
```

Creation defaults to `1.0.0` and accepts an explicit `--version`. Reads use a separate `--version` option supporting exact, minor, major, and `latest` selectors. Omit it to select latest; `--asset` must contain only the bare name. `latest` means the highest numeric version; uploads may be out of order. Existing versions cannot be overwritten. Each version retains its own thumbnail, uploader, and creation time. `assets update` edits metadata; `assets upload` publishes file versions.

### IES photometric lights

`.ies` files infer the `LIGHT` asset type and `application/ies` MIME type. You can also select
`--type LIGHT` explicitly. Original downloads retain the IES source; omit `--format` when downloading.

```sh
threeify assets create --org acme --project lighting --asset spotlight --file spotlight.ies --visibility PRIVATE
threeify assets list --org acme --project lighting --type LIGHT
threeify assets upload --org acme --project lighting --asset spotlight --file spotlight.ies --version 1.1.0
threeify assets download --org acme --project lighting --asset spotlight@1.1.0 --output spotlight.ies
```

### Tasks

Manage background jobs in a project. Organization and project can also come from `threeify config set` defaults.

```sh
threeify tasks list --org my-org --project my-project --page-size 20 --sort-by createdAt --sort-dir desc
threeify tasks get 123 --org my-org --project my-project
threeify tasks retry 123 --org my-org --project my-project
```

`list` supports `--page-offset` and `--page-size` (1–1000). `get` includes the latest run status and results; a null latest run status means the task has no run yet. `retry` re-queues an existing task and prints `{ "success": true }` when accepted; it does not wait for completion. IDs must be positive integers. All three commands support `--format json|yaml|csv`.

For a personal backend, set `LOA_HOST=http://localhost:3001` and log in to that host before running commands. Tasks use the existing project permissions and authentication.

### Files

Download a storage file using an OID from task results (for example, `latestRunResults.oid`):

```sh
threeify files download <oid> --output generated.glb
```

The OID must be 64 lowercase hexadecimal characters. `--output` (`-o`) defaults to the OID in the current directory. Downloads stream to disk, refuse to overwrite existing files, and remove incomplete output if downloading fails. Parent directories must already exist.

This uses the configured host (`LOA_HOST` or `threeify config set --host`) and the existing anonymous `/files/:oid` endpoint. Anyone who knows an OID can download that file; login and project permissions are not checked by that endpoint. Stored credentials are not sent by this command.

## Positional asset references

Asset-targeting commands accept either one positional `asset[@version]` or explicit `--asset` / `--version` options. Never combine the two forms, even when values agree. `--asset` always takes a bare name.

```sh
threeify config set --org acme --project library
threeify assets thumbnail MyChair
threeify assets thumbnail MyChair@2.1.3
threeify assets thumbnail --asset MyChair --version 2.1.3
threeify assets download MyChair@2.1 --format glb
threeify assets get MyChair@latest
threeify assets upload MyChair@2.2.0 --file chair.glb
threeify assets create NewChair@1.0.0 --file chair.glb --visibility PRIVATE
threeify assets versions MyChair
threeify assets update MyChair --description "Updated description"
threeify assets delete MyChair
threeify comments list MyChair
threeify comments edit 123 MyChair --text "Updated comment"
```

Org and project use the existing configured defaults; explicit `--org` and `--project` override them. Reads (`get`, `download`, `thumbnail`) accept selectors. Publications (`create`, `upload`) require exact `major.minor.patch` versions when provided. `create` still infers a name from the file when neither form specifies one. Whole-asset commands (`update`, `delete`, `versions`, and comments) accept only bare names and reject versions.

`threeify install`, `threeify pull`, and `threeify remove` also prune obsolete local files, aliases, and directories from `assets/`. Scanning and cleanup reuse the installation task queue and its `--parallel` cap. Native aliases target the global cache directly; pruning local links leaves cached bytes untouched. The global cache, declared live inputs, and local override files are retained. Keep unreferenced source files outside the managed `assets/` output.
