/** Git-tracked selections. Paths are relative to the manifest declaring them. */
export type Manifest = {
  name: string;
  /** Installed by `threeify install`; resolved locally when installed, remotely otherwise. */
  dependencies: Record<string, string>;
  /** Must be installed; always resolved to the local static path. */
  localDependencies?: Record<string, string>;
  /** Never installed; always resolved to the remote URL. */
  remoteDependencies?: Record<string, string>;
  workspaces?: string[];
};
/** The manifest list pinning a binding to one side. Absent for plain `dependencies`. */
export type DependencyMode = 'local' | 'remote';

export type NativeAsset = {
  kind: 'loa';
  specifier: string;
  host: string;
  ref: string;
  version: string;
  /** SHA-256 integrity in SRI form (base64), for the stored, decoded bytes. */
  hash: string;
  remoteUrl: string;
  extension: string;
  mode?: DependencyMode;
};
export type UrlAsset = { kind: 'url'; specifier: string; url: string; extension: string; mode?: DependencyMode };
export type FileAsset = { kind: 'file'; specifier: string; path: string; mode?: 'local' };
export type LockedAsset = NativeAsset | UrlAsset | FileAsset;
export type Lockfile = {
  lockfileVersion: 2;
  importers: Record<string, { name: string; dependencies: Record<string, LockedAsset> }>;
};
export type Resolution = Record<string, string>;
export type ResolveMode = 'auto' | 'remote' | 'local';
