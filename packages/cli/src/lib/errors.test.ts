import { expect, it } from 'vitest';
import { formatError } from './errors.js';

const refreshError = (status?: number, trace?: string) => ({
  isAxiosError: true,
  config: { url: 'https://example.test/auth/refresh-access-token', data: { refreshToken: 'ut_secret' } },
  message: 'sensitive upstream diagnostic ut_secret',
  response: status
    ? { status, data: '<html>ut_secret</html>', headers: { 'x-cloud-trace-context': trace } }
    : undefined,
});

it('identifies exhausted refresh failures and includes a safe Cloud Run trace ID', () => {
  expect(formatError(refreshError(500, '0123456789abcdef0123456789abcdef/123;o=1'))).toBe(
    'Token refresh failed (HTTP 500). Trace ID: 0123456789abcdef0123456789abcdef. Please try again later.',
  );
});

it('omits untrusted diagnostics and malformed trace headers', () => {
  expect(formatError(refreshError(503, 'ut_secret'))).toBe('Token refresh failed (HTTP 503). Please try again later.');
  expect(formatError(refreshError())).toBe('Token refresh failed. Please try again later.');
});

it('keeps authentication guidance for rejected refresh credentials', () => {
  expect(formatError(refreshError(401))).toBe(
    'Token refresh failed (HTTP 401). Please run "threeify auth login" to authenticate.',
  );
});

it('preserves existing asset failure messages', () => {
  expect(
    formatError({
      isAxiosError: true,
      config: { url: '/assets/org/project' },
      response: { status: 500 },
      message: 'error',
    }),
  ).toBe('Internal server error. Please try again later.');
});
