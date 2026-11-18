import { describe, expect, it } from 'vitest';
import { makeUrl, validateUrl } from './url.js';

describe('validateUrl', () => {
  it('should return true for valid URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true);
    expect(validateUrl('http://localhost:8080/callback')).toBe(true);
    expect(validateUrl('https://api.threeify.com')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(validateUrl('')).toBe(false);
    expect(validateUrl('not a url')).toBe(false);
    expect(validateUrl('http://')).toBe(false);
  });
});

describe('makeUrl', () => {
  it('should create URL with path only', () => {
    const url = makeUrl('https://example.com', '/api/users');
    expect(url.toString()).toBe('https://example.com/api/users');
  });

  it('should create URL with path and query parameters', () => {
    const url = makeUrl('https://example.com', '/api/users', {
      page: 1,
      limit: 10,
      active: true,
    });
    expect(url.toString()).toBe('https://example.com/api/users?page=1&limit=10&active=true');
  });

  it('should handle numeric query parameters', () => {
    const url = makeUrl('https://example.com', '/api/search', {
      page: 2,
      size: 20,
    });
    expect(url.toString()).toBe('https://example.com/api/search?page=2&size=20');
  });

  it('should handle boolean query parameters', () => {
    const url = makeUrl('https://example.com', '/api/users', {
      active: true,
      deleted: false,
    });
    expect(url.toString()).toBe('https://example.com/api/users?active=true&deleted=false');
  });

  it('should exclude undefined query parameters', () => {
    const url = makeUrl('https://example.com', '/api/users', {
      page: 1,
      limit: undefined,
      active: true,
    });
    expect(url.toString()).toBe('https://example.com/api/users?page=1&active=true');
  });

  it('should handle empty query object', () => {
    const url = makeUrl('https://example.com', '/api/users', {});
    expect(url.toString()).toBe('https://example.com/api/users');
  });

  it('should handle no query parameter', () => {
    const url = makeUrl('https://example.com', '/api/users');
    expect(url.toString()).toBe('https://example.com/api/users');
  });

  it('should handle relative path', () => {
    const url = makeUrl('https://example.com', 'api/users');
    expect(url.toString()).toBe('https://example.com/api/users');
  });

  it('should handle root path', () => {
    const url = makeUrl('https://example.com', '/');
    expect(url.toString()).toBe('https://example.com/');
  });

  it('should preserve existing query parameters in path', () => {
    const url = makeUrl('https://example.com', '/api/users?existing=value', {
      newParam: 'newValue',
    });
    expect(url.toString()).toBe('https://example.com/api/users?existing=value&newParam=newValue');
  });
});
