import { describe, expect, it } from 'vitest';
import { createAnonymousClient } from '../client.js';
import {
  HdrImageFormat,
  MediaFormat,
  getMediaOriginalUrl,
  getMediaUrl,
  mediaTaskAcceptedSchema,
  mediaParamsSchema,
  type StartMediaTaskProps,
} from './media.js';

const host = 'https://api.example.com';
const client = createAnonymousClient({ host });
const params = { orgName: 'my-org', projectName: 'my-project', assetName: 'my-asset' };

describe('Media API URL builders', () => {
  it('builds a versioned IES source download URL', () => {
    const url = getMediaOriginalUrl(client, {
      extension: '.ies',
      params: { ...params, assetName: 'spotlight', version: '1.2.3' },
      query: { download: true },
    });
    expect(url.pathname).toBe('/media/my-org/my-project/spotlight@1.2.3.ies');
    expect(url.searchParams.get('original')).toBe('true');
    expect(url.searchParams.get('download')).toBe('true');
  });

  it('getMediaOriginalUrl builds path /media/$orgName/$projectName/$assetName.glb', () => {
    const url = getMediaOriginalUrl(client, { extension: '.glb', params });
    expect(url.href).toBe(`${host}/media/my-org/my-project/my-asset.glb?original=true`);
  });

  it('getMediaOriginalUrl appends download query when provided', () => {
    const url = getMediaOriginalUrl(client, { extension: '.glb', params, query: { download: true } });
    expect(url.searchParams.get('download')).toBe('true');
  });

  describe('getMediaUrl (unified)', () => {
    it('builds image route for webp', () => {
      const url = getMediaUrl(client, { params, format: 'webp', query: { width: 512, height: 512 } });
      expect(url.href).toBe(`${host}/media/my-org/my-project/my-asset.webp?width=512&height=512`);
    });

    it('builds a versioned EXR conversion download URL', () => {
      const url = getMediaUrl(client, {
        params: { ...params, version: '1.2.3' },
        format: 'exr',
        query: { download: true, cache: false },
      });
      expect(url.pathname).toBe('/media/my-org/my-project/my-asset@1.2.3.exr');
      expect(url.searchParams.get('download')).toBe('true');
      expect(url.searchParams.get('cache')).toBe('false');
    });

    it('rejects removed JPEG XL conversion requests from JavaScript callers', () => {
      expect(HdrImageFormat.safeParse('jxl').success).toBe(false);
      expect(MediaFormat.safeParse('jxl').success).toBe(false);
      expect(() =>
        getMediaUrl(client, {
          params,
          // @ts-expect-error JPEG XL is no longer a supported media format.
          format: 'jxl',
        }),
      ).toThrow();
    });

    it('builds envmap route for hdr', () => {
      const url = getMediaUrl(client, { params, format: 'hdr', query: { download: true } });
      expect(url.href).toBe(`${host}/media/my-org/my-project/my-asset.hdr?download=true`);
    });

    it('builds envmap route for ultrahdr', () => {
      const url = getMediaUrl(client, { params, format: 'ultrahdr', query: { download: true } });
      expect(url.href).toBe(`${host}/media/my-org/my-project/my-asset.ultrahdr.jpg?download=true`);
    });

    it('builds model route for glb', () => {
      const url = getMediaUrl(client, { params, format: 'glb', query: { meshCompress: 'draco' } });
      expect(url.href).toBe(`${host}/media/my-org/my-project/my-asset.glb?meshCompress=draco`);
    });

    it('builds model route for usdz, blend, and fbx', () => {
      const usdz = getMediaUrl(client, { params, format: 'usdz', query: { download: true } });
      const blend = getMediaUrl(client, { params, format: 'blend', query: { download: true } });
      const fbx = getMediaUrl(client, { params, format: 'fbx', query: { download: true } });
      expect(usdz.href).toBe(`${host}/media/my-org/my-project/my-asset.usdz?download=true`);
      expect(blend.href).toBe(`${host}/media/my-org/my-project/my-asset.blend?download=true`);
      expect(fbx.href).toBe(`${host}/media/my-org/my-project/my-asset.fbx?download=true`);
    });

    it('builds cad route for fcstd, iges, and step', () => {
      const fcstd = getMediaUrl(client, { params, format: 'fcstd', query: { download: true } });
      const iges = getMediaUrl(client, { params, format: 'iges', query: { download: true } });
      const step = getMediaUrl(client, { params, format: 'step', query: { download: true } });
      expect(fcstd.href).toBe(`${host}/media/my-org/my-project/my-asset.fcstd?download=true`);
      expect(iges.href).toBe(`${host}/media/my-org/my-project/my-asset.iges?download=true`);
      expect(step.href).toBe(`${host}/media/my-org/my-project/my-asset.step?download=true`);
    });
  });

  describe('typed format/query constraints', () => {
    it('accepts valid discriminated union pairs', () => {
      const webpProps = {
        params,
        format: 'webp',
        query: { width: 256, height: 256, cache: false },
      } satisfies StartMediaTaskProps;

      const glbProps = {
        params,
        format: 'glb',
        query: { meshCompress: 'draco', textureCompress: 'ktx2' },
      } satisfies StartMediaTaskProps;

      const cadProps = {
        params,
        format: 'fcstd',
        query: { cache: false },
      } satisfies StartMediaTaskProps;

      expect(webpProps.format).toBe('webp');
      expect(glbProps.format).toBe('glb');
      expect(cadProps.format).toBe('fcstd');
    });

    it('rejects invalid discriminated union pairs at compile time', () => {
      // @ts-expect-error width is not allowed for glb query
      const badGlb: StartMediaTaskProps = { params, format: 'glb', query: { width: 256 } };
      // @ts-expect-error meshCompress is not allowed for webp query
      const badWebp: StartMediaTaskProps = { params, format: 'webp', query: { meshCompress: 'draco' } };
      expect(badGlb).toBeDefined();
      expect(badWebp).toBeDefined();
    });
  });
});

describe('mediaTaskAcceptedSchema', () => {
  it('parses valid 202 response body with QUEUED status', () => {
    const body = {
      status: 'QUEUED',
      taskId: 42,
      taskUrl: 'https://api.example.com/tasks/org/proj/42',
      eventsUrl: 'https://api.example.com/tasks/org/proj/42/events',
    };
    const parsed = mediaTaskAcceptedSchema.parse(body);
    expect(parsed.status).toBe('QUEUED');
    expect(parsed.taskId).toBe(42);
    expect(parsed.taskUrl).toBe(body.taskUrl);
    expect(parsed.eventsUrl).toBe(body.eventsUrl);
  });

  it('accepts RUNNING status', () => {
    const body = {
      status: 'RUNNING',
      taskId: 1,
      taskUrl: 'https://api.example.com/tasks/o/p/1',
      eventsUrl: 'https://api.example.com/tasks/o/p/1/events',
    };
    const parsed = mediaTaskAcceptedSchema.parse(body);
    expect(parsed.status).toBe('RUNNING');
  });

  it('accepts SUCCESS status', () => {
    const body = {
      status: 'SUCCESS',
      taskId: 1,
      taskUrl: 'https://api.example.com/tasks/o/p/1',
      eventsUrl: 'https://api.example.com/tasks/o/p/1/events',
    };
    const parsed = mediaTaskAcceptedSchema.parse(body);
    expect(parsed.status).toBe('SUCCESS');
  });

  it('accepts SUCCESS status without task metadata', () => {
    const body = {
      status: 'SUCCESS',
    };
    const parsed = mediaTaskAcceptedSchema.parse(body);
    expect(parsed.status).toBe('SUCCESS');
    expect(parsed.taskId).toBeUndefined();
    expect(parsed.taskUrl).toBeUndefined();
    expect(parsed.eventsUrl).toBeUndefined();
  });

  it('accepts FAILED status', () => {
    const body = {
      status: 'FAILED',
      taskId: 1,
      taskUrl: 'https://api.example.com/tasks/o/p/1',
      eventsUrl: 'https://api.example.com/tasks/o/p/1/events',
    };
    const parsed = mediaTaskAcceptedSchema.parse(body);
    expect(parsed.status).toBe('FAILED');
  });

  it('rejects unknown status', () => {
    const body = {
      status: 'UNKNOWN',
      taskId: 1,
      taskUrl: 'https://api.example.com/tasks/o/p/1',
      eventsUrl: 'https://api.example.com/tasks/o/p/1/events',
    };
    expect(() => mediaTaskAcceptedSchema.parse(body)).toThrow();
  });
});

describe('versioned media references', () => {
  it('carries exact and automatic references through all media formats', () => {
    for (const selector of ['1.2.3', '1.2', '1', 'latest']) {
      const selected = { ...params, version: selector };
      expect(
        decodeURIComponent(getMediaOriginalUrl(client, { extension: '.glb', params: selected }).pathname),
      ).toContain(`my-asset@${selector}.glb`);
      for (const format of [
        'webp',
        'glb',
        'usdz',
        'blend',
        'fbx',
        'fcstd',
        'iges',
        'step',
        'hdr',
        'exr',
        'ultrahdr',
      ] as const) {
        expect(decodeURIComponent(getMediaUrl(client, { params: selected, format }).pathname)).toContain(
          `my-asset@${selector}.`,
        );
      }
    }
  });
  it('rejects manual tags and malformed versions', () => {
    for (const name of ['chair@custom', 'chair@01.2', 'chair@1.0.0-beta']) {
      expect(() =>
        getMediaOriginalUrl(client, { extension: '.glb', params: { ...params, assetName: name } }),
      ).toThrow();
      expect(() => getMediaUrl(client, { params: { ...params, assetName: name }, format: 'glb' })).toThrow();
    }
  });
});

it('builds the canonical media URL spellings', () => {
  for (const version of ['1.0.0', undefined, 'latest']) {
    const url = getMediaUrl(client, {
      params: { orgName: 'orgName', projectName: 'projectName', assetName: 'media', version },
      format: 'glb',
    });
    expect(url.toString()).toBe(`${host}/media/orgName/projectName/media${version ? `@${version}` : ''}.glb`);
  }
});

describe('separate media version parameters', () => {
  it.each(['1', '1.2', '1.2.3', 'latest', 'draft', '1.2.3-beta.1+build'])('builds URLs for selector %s', (version) => {
    const selected = { ...params, version };
    expect(getMediaUrl(client, { params: selected, format: 'webp', query: { width: 512 } }).href).toBe(
      `${host}/media/my-org/my-project/my-asset@${encodeURIComponent(version)}.webp?width=512`,
    );
    expect(getMediaOriginalUrl(client, { params: selected, extension: '.mtlx.zip' }).pathname).toBe(
      `/media/my-org/my-project/my-asset@${encodeURIComponent(version)}.mtlx.zip`,
    );
  });
  it.each([undefined, '1.2.3', '2.0.0'])('rejects embedded asset versions even with version %s', (version) => {
    expect(() =>
      getMediaUrl(client, { params: { ...params, assetName: 'my-asset@1.2.3', version }, format: 'glb' }),
    ).toThrow();
  });
  it.each(['', '@latest', '../draft', 'draft/next', 'draft?width=1', 'draft#part'])(
    'rejects invalid version token %s',
    (version) => {
      expect(mediaParamsSchema.safeParse({ ...params, version }).success).toBe(false);
    },
  );
});
