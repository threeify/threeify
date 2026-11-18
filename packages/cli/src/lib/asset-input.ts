import { assetNameSchema, assetVersionSchema, mediaVersionSchema } from '@threeify/sdk';
import type { Argv } from 'yargs';

type AssetInput = { assetReference?: string; asset?: string; version?: string };
type Policy = { version?: 'read' | 'exact' | 'none'; required?: boolean };
type ResolvedAsset = { assetName: string; version?: string };
type OptionalAsset = { assetName?: string; version?: string };

export function resolveAssetInput(input: AssetInput, policy: Policy & { required: false }): OptionalAsset;
export function resolveAssetInput(input: AssetInput, policy?: Policy & { required?: true }): ResolvedAsset;
export function resolveAssetInput(input: AssetInput, policy: Policy): OptionalAsset;
export function resolveAssetInput(input: AssetInput, policy: Policy = {}): OptionalAsset {
  const positional = input.assetReference !== undefined;
  if (positional && (input.asset !== undefined || input.version !== undefined)) {
    throw new Error('Use either positional asset[@version] or --asset/--version, never both.');
  }
  const parts = positional ? input.assetReference!.split('@') : [input.asset, input.version];
  if (parts.length > 2) throw new Error('Expected asset[@version] with at most one @ separator.');
  const [assetName, version] = parts;
  if (assetName === undefined) {
    if (policy.required !== false) throw new Error('Specify an asset name positionally or with --asset.');
  } else if (!assetNameSchema.safeParse(assetName).success) {
    throw new Error('Invalid asset name. Use a bare name such as MyChair.');
  }
  if (version !== undefined) {
    if (!policy.version || policy.version === 'none') {
      throw new Error('This command targets the whole asset and does not accept a version.');
    }
    const schema = policy.version === 'exact' ? assetVersionSchema : mediaVersionSchema;
    if (!schema.safeParse(version).success) {
      throw new Error(
        policy.version === 'exact' ? 'Specify a full major.minor.patch version.' : 'Invalid version token.',
      );
    }
  }
  return { assetName, ...(version === undefined ? {} : { version }) };
}

/** Add one optional positional reference and explicit alternatives; org/project defaults stay with args.ts. */
export function withAssetInput<T>(yargs: Argv<T>, policy: Policy = {}) {
  return yargs
    .version(false)
    .positional('assetReference', {
      type: 'string',
      description: policy.version && policy.version !== 'none' ? 'Asset name with optional @version' : 'Asset name',
    })
    .options({
      asset: { type: 'string', description: 'Bare asset name (alternative to positional reference)' },
      version: {
        type: 'string',
        hidden: !policy.version || policy.version === 'none',
        description: policy.version === 'exact' ? 'Exact major.minor.patch version' : 'Version selector or label',
      },
    })
    .check((argv) => {
      resolveAssetInput(argv, policy);
      return true;
    });
}
