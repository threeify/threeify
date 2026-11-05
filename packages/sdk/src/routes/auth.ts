import axios from 'axios';
import * as z from 'zod';
import type { ApiClient } from '../client.js';
import { buildPath } from '../lib/buildPath.js';

export const refreshAccessTokenBodySchema = z.strictObject({
  refreshToken: z
    .string()
    .describe(
      'The refresh token to use for refreshing the access token (must start with "ut_" for session tokens or "st_" for API tokens)',
    ),
});

export type RefreshAccessTokenBody = z.infer<typeof refreshAccessTokenBodySchema>;

export const authCredentialInfoSchema = z.strictObject({
  username: z.string().describe('The username of the authenticated user or service account'),
  createdAt: z.iso.datetime({ offset: true }).describe('When the session or API token was created'),
  expiresAt: z.iso.datetime({ offset: true }).nullable().describe('Session expiry; null for non-expiring API tokens'),
});

export type AuthCredentialInfo = z.infer<typeof authCredentialInfoSchema>;

export const refreshAccessTokenResultSchema = z.strictObject({
  accessToken: z.string(),
  auth: authCredentialInfoSchema.optional().describe('Credential details, when supported by the server'),
});

export type RefreshAccessTokenResult = z.infer<typeof refreshAccessTokenResultSchema>;

export const refreshAccessTokenPropsSchema = z.object({ body: refreshAccessTokenBodySchema }).strict();
export type RefreshAccessTokenProps = z.infer<typeof refreshAccessTokenPropsSchema>;

/**
 * Refreshes an access token using a refresh token.
 * The token type is automatically inferred from the token prefix:
 * - `ut_` prefix for session tokens
 * - `st_` prefix for API tokens
 *
 * @operationId refresh-access-token
 * @param host - The API host URL
 * @param props - The request properties
 * @param props.body - Request body with refresh token (type is inferred from prefix)
 * @returns Promise resolving to a new access token
 */
export const refreshAccessToken = async (
  host: string,
  props: RefreshAccessTokenProps,
  validateResults = false,
): Promise<RefreshAccessTokenResult> => {
  const { body } = refreshAccessTokenPropsSchema.parse(props);
  const response = await refreshAccessTokenWithRetry(host, body);
  if (validateResults) {
    return refreshAccessTokenResultSchema.parse(response.data);
  }
  return response.data;
};

async function refreshAccessTokenWithRetry(host: string, body: RefreshAccessTokenBody) {
  // Refresh issues another access token without rotating the refresh token. Retrying
  // it is safe even if the response was lost; retrying an asset create is not.
  for (let attempt = 0; ; attempt++) {
    try {
      return await axios.post<RefreshAccessTokenResult>(`${host}/auth/refresh-access-token`, body);
    } catch (error) {
      if (!axios.isAxiosError(error) || attempt >= 2) throw error;
      const status = error.response?.status;
      const retryable =
        status !== undefined
          ? [500, 502, 503, 504].includes(status)
          : ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN', 'ERR_NETWORK'].includes(error.code ?? '');
      if (!retryable) throw error;
      // Bounded exponential backoff with jitter avoids synchronized retries.
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt * (1 + Math.random())));
    }
  }
}

export const oauthTokenRequestBodySchema = z.strictObject({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  client_id: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.url(),
  client_secret: z.string().optional(),
});

export type OAuthTokenRequestBody = z.infer<typeof oauthTokenRequestBodySchema>;

export const oauthTokenResultSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number(),
});

export type OAuthTokenResult = z.infer<typeof oauthTokenResultSchema>;

export const exchangeAuthorizationCodePropsSchema = z.object({ body: oauthTokenRequestBodySchema }).strict();
export type ExchangeAuthorizationCodeProps = z.infer<typeof exchangeAuthorizationCodePropsSchema>;

/**
 * Exchange an authorization code for access and refresh tokens (OAuth 2.0).
 *
 * @operationId oauth-token
 * @param host - The API host URL
 * @param props - The request properties
 * @param props.body - Request body with grant_type, code, client_id, code_verifier, and redirect_uri
 * @returns Promise resolving to access_token, refresh_token, token_type, and expires_in
 */
export const exchangeAuthorizationCode = async (
  host: string,
  props: ExchangeAuthorizationCodeProps,
  validateResults = false,
): Promise<OAuthTokenResult> => {
  const { body } = exchangeAuthorizationCodePropsSchema.parse(props);
  const response = await axios.post<OAuthTokenResult>(`${host}/auth/token`, body, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (validateResults) {
    return oauthTokenResultSchema.parse(response.data);
  }
  return response.data;
};

export const oauthConsentBodySchema = z.strictObject({
  client_id: z.string(),
  redirect_uri: z.url(),
  response_type: z.literal('code'),
  scope: z.string(),
  state: z.string(),
  code_challenge: z.string(),
  code_challenge_method: z.literal('S256'),
  action: z.enum(['APPROVE', 'DENY']),
  session_token: z.string(),
});

export type OAuthConsentBody = z.infer<typeof oauthConsentBodySchema>;

export const deleteRefreshTokenParamsSchema = z.strictObject({
  token: z.string().describe('The refresh token to delete'),
});

export type DeleteRefreshTokenParams = z.infer<typeof deleteRefreshTokenParamsSchema>;

export const deleteRefreshTokenPropsSchema = z.object({ params: deleteRefreshTokenParamsSchema }).strict();
export type DeleteRefreshTokenProps = z.infer<typeof deleteRefreshTokenPropsSchema>;

/**
 * Deletes a refresh token (session) by invalidating it.
 *
 * @operationId delete-refresh-token
 * @param client - The API client instance
 * @param props - The request properties
 * @param props.params - Path parameters (token)
 * @returns Promise that resolves when the refresh token is deleted
 */
export const deleteRefreshToken = async (client: ApiClient, props: DeleteRefreshTokenProps): Promise<void> => {
  const { params } = deleteRefreshTokenPropsSchema.parse(props);
  const path = buildPath('/auth/refresh-token/$token', params);
  await client.axios.delete(path);
};
