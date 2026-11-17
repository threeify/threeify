/** Git-tracked selections. Paths are relative to the manifest declaring them. */
export type Manifest = {
  name: string;
  assets: Record<string, string>;
  workspaces?: string[];
};

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
};
export type UrlAsset = { kind: 'url'; specifier: string; url: string; extension: string };
export type FileAsset = { kind: 'file'; specifier: string; path: string };
export type LockedAsset = NativeAsset | UrlAsset | FileAsset;
export type Lockfile = {
  lockfileVersion: 1;
  importers: Record<string, { name: string; assets: Record<string, LockedAsset> }>;
};
export type Resolution = Record<string, string>;
export type ResolveMode = 'auto' | 'remote' | 'local';
