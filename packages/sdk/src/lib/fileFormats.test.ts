import { describe, expect, it } from 'vitest';

import {
  ASSET_TYPE_FILE_MAPPINGS,
  FileFormat,
  ENVMAP_ASSET_FILE_FORMATS,
  getAssetTypeFromFileFormat,
  getFileFormatInfoAcceptObject,
  getFileFormatInfoFromFileName,
  getFileFormatInfoFromMimeTypeAndFileName,
  getFileNameExtension,
  LIGHT_ASSET_FILE_FORMATS,
} from './fileFormats.js';

describe('fileFormats', () => {
  it('does not recognize JPEG XL uploads', () => {
    expect(getFileFormatInfoFromFileName('Studio.JXL', FileFormat)).toBeUndefined();
    expect(getFileFormatInfoAcceptObject(ENVMAP_ASSET_FILE_FORMATS)).not.toHaveProperty('image/jxl');
    expect(getFileFormatInfoFromMimeTypeAndFileName('image/jxl', 'studio.jxl', FileFormat)).toBeUndefined();
  });

  it('recognizes IES files as photometric lights', () => {
    expect(getFileFormatInfoFromFileName('Spotlight.IES', FileFormat)).toMatchObject({
      format: 'ies',
      mimeType: 'application/ies',
      extension: '.ies',
    });
    expect(getFileNameExtension('Spotlight.IES')).toBe('.ies');
    expect(getAssetTypeFromFileFormat('ies')).toBe('LIGHT');
    expect(ASSET_TYPE_FILE_MAPPINGS.LIGHT.fileFormats).toEqual(['ies']);
    expect(getFileFormatInfoAcceptObject(LIGHT_ASSET_FILE_FORMATS)).toEqual({ 'application/ies': ['.ies'] });
  });

  it.each(['application/ies', 'text/plain', 'application/octet-stream'])(
    'recognizes IES MIME type %s within light formats',
    (mimeType) => {
      expect(getFileFormatInfoFromMimeTypeAndFileName(mimeType, 'spot.ies', LIGHT_ASSET_FILE_FORMATS)?.format).toBe(
        'ies',
      );
      expect(getFileFormatInfoFromMimeTypeAndFileName(mimeType, 'spot.ies', ['mtlx'])).toBeUndefined();
    },
  );

  it('matches compound extensions before single ones', () => {
    expect(getFileFormatInfoFromFileName('Copper.MTLX.zip', FileFormat)?.format).toBe('mtlx');
    expect(getFileFormatInfoFromFileName('copper.mtlx', FileFormat)?.format).toBe('mtlx');
    expect(getFileFormatInfoFromFileName('archive.zip', FileFormat)?.format).toBe('zip');
    expect(getFileFormatInfoFromFileName('photo.jpeg', FileFormat)?.format).toBe('jpg');
    expect(getFileFormatInfoFromFileName('notes.txt', FileFormat)).toBeUndefined();
  });

  it('returns the registered extension of a file name', () => {
    expect(getFileNameExtension('a.b.mtlx.zip')).toBe('.mtlx.zip');
    expect(getFileNameExtension('a.zip')).toBe('.zip');
    expect(getFileNameExtension('a.TXT')).toBe('.txt');
    expect(getFileNameExtension('noext')).toBe('');
  });

  it('uses the file name to disambiguate shared MIME types', () => {
    expect(getFileFormatInfoFromMimeTypeAndFileName('application/zip', 'm.mtlx.zip', FileFormat)?.format).toBe('mtlx');
    expect(getFileFormatInfoFromMimeTypeAndFileName('application/zip', 'part.FCStd', FileFormat)?.format).toBe('fcstd');
    expect(getFileFormatInfoFromMimeTypeAndFileName('application/zip', undefined, FileFormat)?.format).toBe('fcstd');
    expect(getFileFormatInfoFromMimeTypeAndFileName('application/zip', 'm.mtlx.zip', ['fcstd'])?.format).toBe('fcstd');
    expect(
      getFileFormatInfoFromMimeTypeAndFileName('application/vnd.materialx+zip', undefined, FileFormat)?.format,
    ).toBe('mtlx');
  });
});
