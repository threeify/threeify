import * as z from 'zod';
import { assetVersionSelectorSchema } from './semver.js';
import { Enums } from './enums.js';

export const descriptionSchema = z.string().max(10_240).describe('The description of the entity');
export const shortDescriptionSchema = z.string().max(1024).describe('The short description of the entity');
export const nullableDescriptionSchema = z.string().nullable().describe('The nullable description of the entity');

export const visibilitySchema = z.enum(Enums.Visibility).describe('The visibility of the entity');
export const assetVisibilitySchema = z.enum(Enums.AssetVisibility).describe('The visibility of the asset');

export const commentTextSchema = z.string().min(1).max(10_240).describe('The text of the comment');

export const jwtSchema = z
  .string()
  .max(1024 * 10)
  .describe('The JWT token');

/**
 * Accepts either a boolean or a stringbool (e.g. "true"/"false", "1"/"0") for use in params and query schemas.
 * Use consistently so callers can pass either from query strings or programmatically.
 */
export const booleanPropSchema = z.union([z.boolean(), z.stringbool()]);

export const coreEntityNameRegex = '[a-zA-Z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*';
export const entityNameRegex = new RegExp(`^${coreEntityNameRegex}$`);

export const entityNameSchema = (description: string) =>
  z
    .string()
    .min(1, 'Name is required')
    .max(30, 'Name must be at most 30 characters')
    .regex(
      entityNameRegex,
      'Name must start with a letter and can only contain letters, numbers, and dashes (-). No consecutive or trailing dashes (-) allowed.',
    )
    .describe(description);

export const orgNameSchema = entityNameSchema('The name of the organization');

export const orgParamsSchema = z.strictObject({
  orgName: orgNameSchema,
});
export type OrgParams = z.infer<typeof orgParamsSchema>;

export const projectNameSchema = entityNameSchema('The name of the project');

export const projectParamsSchema = z.strictObject({
  orgName: orgNameSchema,
  projectName: projectNameSchema,
});
export type ProjectParams = z.infer<typeof projectParamsSchema>;

export const assetNameSchema = entityNameSchema('The name of the asset');

export const assetParamsSchema = z.strictObject({
  orgName: orgNameSchema,
  projectName: projectNameSchema,
  assetName: assetNameSchema,
});
export type AssetParams = z.infer<typeof assetParamsSchema>;

export const assetReferenceSchema = z.string().refine((value) => {
  const [name, selector, extra] = value.split('@');
  return (
    extra === undefined &&
    assetNameSchema.safeParse(name).success &&
    (selector === undefined || assetVersionSelectorSchema.safeParse(selector).success)
  );
}, 'Expected an asset name with an optional @version selector');
export const assetReferenceParamsSchema = assetParamsSchema.extend({ assetName: assetReferenceSchema });
export function parseAssetReference(value: string): { assetName: string; version?: string } {
  assetReferenceSchema.parse(value);
  const [assetName, version] = value.split('@');
  return { assetName: assetName!, ...(version === undefined ? {} : { version }) };
}
export function formatAssetReference(assetName: string, version?: string): string {
  assetNameSchema.parse(assetName);
  return version === undefined ? assetName : `${assetName}@${assetVersionSelectorSchema.parse(version)}`;
}

export const coreProductCodeRegex = '[a-zA-Z0-9][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*';
export const productCodeRegex = new RegExp(`^${coreProductCodeRegex}$`);
export const productCodeSchema = z
  .string()
  .min(1, 'Code is required')
  .max(100, 'Code must be at most 100 characters')
  .regex(
    productCodeRegex,
    'Code must start with a letter or number and can only contain letters, numbers, and dashes (-). No consecutive or trailing dashes (-) allowed.',
  )
  .describe('The code of the product (unique within project)');

export const productParamsSchema = z.strictObject({
  orgName: orgNameSchema,
  projectName: projectNameSchema,
  productCode: productCodeSchema,
});
export type ProductParams = z.infer<typeof productParamsSchema>;

export const commentParamsSchema = assetParamsSchema.extend({
  commentId: z.coerce.number().int().describe('The ID of the comment'),
});
export type CommentParams = z.infer<typeof commentParamsSchema>;

export const userNameSchema = entityNameSchema('The name of the user');

export const userNameParamsSchema = z.strictObject({
  userName: userNameSchema,
});
export type UserNameParams = z.infer<typeof userNameParamsSchema>;

export const standardUserNameSchema = entityNameSchema('The name of the user');
export const serviceAccountNameSchema = entityNameSchema('The name of the service account').regex(
  /^sa-/,
  'Service account users must start with "sa-"',
);

export const apiTokenNameSchema = entityNameSchema('The name of the API token');
