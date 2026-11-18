import { describe, expect, it } from 'vitest';
import {
  createAssetBodySchema,
  updateAssetBodySchema,
  createAssetVersionBodySchema,
  updateAssetVersionBodySchema,
  updateAssetVersionParamsSchema,
  lightInfoSchema,
  listAssetsQuerySchema,
  type LightInfo,
} from './assets.js';

const lightInfo: LightInfo = {
  version: 'LM-63-2002',
  metadata: { MANUFAC: 'Example Lighting', LUMINAIRE: 'Spotlight' },
  photometricType: 1,
  photometricTypeName: 'C',
  photometry: 'absolute',
  manufacturer: 'Example Lighting',
  luminaire: 'Spotlight',
  lightSource: 'LED',
  lampCatalog: 'not specified',
  lampCount: 1,
  lumensPerLamp: -1,
  inputWatts: 12,
  peakCandela: 500,
  verticalAngles: 3,
  horizontalAngles: 1,
  units: 'meters',
  dimensions: { width: 0.1, length: 0.1, height: 0.05 },
  hasTilt: false,
  warnings: [],
};

describe('LIGHT asset contracts', () => {
  it('accepts absolute photometry and preserves manufacturer metadata and warnings', () => {
    const info = { ...lightInfo, warnings: ['Missing optional test metadata'] };
    expect(lightInfoSchema.parse(info)).toEqual(info);
  });

  it('rejects invalid photometric types and non-finite intensity values', () => {
    expect(lightInfoSchema.safeParse({ ...lightInfo, photometricType: 4 }).success).toBe(false);
    expect(lightInfoSchema.safeParse({ ...lightInfo, peakCandela: Infinity }).success).toBe(false);
  });

  it('accepts creating and filtering light assets', () => {
    expect(
      createAssetBodySchema.parse({
        name: 'spotlight',
        type: 'LIGHT',
        uploadToken: 'upload-token',
        visibility: 'PUBLIC',
        shareLicense: 'CC_BY',
      }).type,
    ).toBe('LIGHT');
    expect(listAssetsQuerySchema.parse({ type: 'LIGHT' }).type).toBe('LIGHT');
  });
});

describe('asset version descriptions', () => {
  const description = 'Release **notes**\n\n- Fixed geometry\n- Updated materials';
  it('preserves multiline Markdown in create and update requests', () => {
    expect(createAssetVersionBodySchema.parse({ uploadToken: 'token', description }).description).toBe(description);
    expect(updateAssetVersionBodySchema.parse({ description }).description).toBe(description);
    expect(updateAssetVersionBodySchema.parse({ description: '' }).description).toBe('');
  });
  it('limits descriptions to 10,240 characters', () => {
    expect(updateAssetVersionBodySchema.safeParse({ description: 'a'.repeat(10_240) }).success).toBe(true);
    expect(updateAssetVersionBodySchema.safeParse({ description: 'a'.repeat(10_241) }).success).toBe(false);
    expect(
      createAssetVersionBodySchema.safeParse({ uploadToken: 'token', description: 'a'.repeat(10_241) }).success,
    ).toBe(false);
  });
  it('requires an exact version for description edits', () => {
    const params = { orgName: 'org', projectName: 'project', assetName: 'asset' };
    expect(updateAssetVersionParamsSchema.safeParse({ ...params, version: '1.2.3' }).success).toBe(true);
    for (const version of ['latest', '1', '1.2']) {
      expect(updateAssetVersionParamsSchema.safeParse({ ...params, version }).success).toBe(false);
    }
  });
});

describe('asset metadata', () => {
  const createBody = {
    name: 'test-asset',
    type: 'MODEL',
    uploadToken: 'test-upload-token',
    visibility: 'PUBLIC',
    shareLicense: 'NONE',
  };

  it('creates assets without AI Usage and rejects the removed field', () => {
    expect(createAssetBodySchema.safeParse(createBody).success).toBe(true);
    const result = createAssetBodySchema.safeParse({ ...createBody, aiUsage: 'AI_USED' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ code: 'unrecognized_keys', keys: ['aiUsage'] }),
      );
    }
  });

  it('updates metadata without AI Usage and rejects the removed field', () => {
    const body = { description: 'Updated description' };
    expect(updateAssetBodySchema.safeParse(body).success).toBe(true);
    const result = updateAssetBodySchema.safeParse({ ...body, aiUsage: 'AI_USED' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ code: 'unrecognized_keys', keys: ['aiUsage'] }),
      );
    }
  });
});
