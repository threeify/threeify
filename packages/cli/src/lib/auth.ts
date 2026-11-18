import crypto from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import { createSecretTokenInstance, createSessionInstance, exchangeAuthorizationCode, listOrgs } from '@threeify/sdk';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import open from 'open';
import type { Config } from './config.ts';
import type { CliDeps } from './deps.ts';

/**
 * Update Sentry user context from config
 */
function updateSentryUserContext(config: Partial<Config>): void {
  if (config.auth?.user) {
    Sentry.setUser({
      id: config.auth.user.id,
      username: config.auth.user.name,
      email: config.auth.user.email,
    });
  } else if (config.auth) {
    // Set basic context if authenticated but user info not yet available
    if (config.auth.type === 'session') {
      Sentry.setUser({ id: 'session', username: 'authenticated' });
    } else if (config.auth.type === 'secretToken') {
      Sentry.setUser({ id: 'service-account', username: 'service-account' });
    }
  } else {
    // Clear user context if not authenticated
    Sentry.setUser(null);
  }
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(64).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Start a local HTTP server to receive the OAuth callback
 */
function startCallbackServer(port: number): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isClosing = false;

    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Helper function to close the server properly
      const closeServer = () => {
        if (isClosing) {
          return Promise.resolve();
        }
        isClosing = true;

        // Clear the timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        server.closeAllConnections();

        // Wait for the server to actually close
        return new Promise<void>((closeResolve) => {
          server.close(() => {
            closeResolve();
          });
        });
      };

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        closeServer()
          .then(() => {
            reject(new Error(`OAuth error: ${error}`));
          })
          .catch((err) => {
            reject(err);
          });
        return;
      }

      if (code && state) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authorization Successful</h1>
              <p>You can close this window and return to the CLI.</p>
            </body>
          </html>
        `);
        closeServer()
          .then(() => {
            resolve({ code, state });
          })
          .catch((err) => {
            reject(err);
          });
      } else {
        res.writeHead(400);
        res.end('Bad Request: Missing code or state');
        closeServer()
          .then(() => {
            reject(new Error('Missing code or state in callback'));
          })
          .catch((err) => {
            reject(err);
          });
      }
    });

    server.listen(port, () => {
      // Server started successfully
    });

    server.on('error', (err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      reject(err);
    });

    // Timeout after 5 minutes
    timeoutId = setTimeout(
      async () => {
        if (isClosing) {
          return;
        }
        isClosing = true;
        const currentTimeoutId = timeoutId;
        if (currentTimeoutId) {
          clearTimeout(currentTimeoutId);
          timeoutId = null;
        }

        // Force close all connections (available in Node.js 18+)
        try {
          const closeAllConnections = (server as { closeAllConnections?: () => void }).closeAllConnections;
          if (typeof closeAllConnections === 'function') {
            closeAllConnections();
          }
        } catch {
          // Ignore if closeAllConnections is not available
        }

        // Wait for the server to actually close
        await new Promise<void>((closeResolve) => {
          server.close(() => {
            closeResolve();
          });
        });

        reject(new Error('Callback server timeout'));
      },
      5 * 60 * 1000,
    );
  });
}

/**
 * Login using browser-based OAuth 2.0 flow with PKCE
 */
export async function loginWithBrowser(host: string, deps: CliDeps): Promise<void> {
  deps.logger.info(chalk.blue(`Logging in to ${host}...`));

  try {
    // OAuth client configuration
    const clientId = 'land-of-assets-cli';
    const redirectUri = 'http://localhost:8080/callback';
    const scope = 'api';

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateState();

    // Build authorization URL
    const apiUrl = new URL(host);
    const authorizeUrl = new URL('/auth/authorize', apiUrl.origin);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', scope);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');

    // Start callback server
    const callbackPort = 8080;
    const callbackPromise = startCallbackServer(callbackPort);

    // Open browser
    await open(authorizeUrl.toString());

    // Wait for callback
    const { code: authCode, state: returnedState } = await callbackPromise;

    // Validate state
    if (returnedState !== state) {
      throw new Error('State parameter mismatch');
    }

    // Exchange authorization code for tokens
    const tokenResult = await exchangeAuthorizationCode(host, {
      body: {
        grant_type: 'authorization_code',
        code: authCode,
        client_id: clientId,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      },
    });

    // Store auth (user info will be retrieved on first API call)
    const globalConfig = await deps.persistentConfig.get();
    globalConfig.auth = {
      type: 'session',
      token: tokenResult.refresh_token,
    };
    globalConfig.host = host;
    await deps.persistentConfig.set(globalConfig);

    // Update Sentry user context
    updateSentryUserContext(globalConfig);

    deps.logger.info(chalk.green('Login successful'));
  } catch (error) {
    deps.logger.error(chalk.red(`Failed to authenticate: ${error instanceof Error ? error.message : String(error)}`));
    throw error;
  }
}

/**
 * Login with a secret token
 */
export async function loginWithToken(host: string, token: string, deps: CliDeps): Promise<void> {
  // Validate token format
  if (!token.startsWith('st_') || token.length !== 39) {
    throw new Error('Invalid token format. Secret tokens must start with "st_" and be 39 characters long.');
  }

  // Create client with token (validation will happen on first use)
  createSecretTokenInstance({
    host,
    secretToken: token,
  });

  // Store token
  const config = await deps.persistentConfig.get();
  config.auth = {
    type: 'secretToken',
    token,
  };
  config.host = host;
  await deps.persistentConfig.set(config);

  // Update Sentry user context
  updateSentryUserContext(config);

  deps.logger.info(chalk.green('✓ Successfully authenticated with API token'));
}

/**
 * Get current authentication status
 */
export async function getAuthStatus(host: string, deps: CliDeps): Promise<void> {
  const config = await deps.persistentConfig.get();
  const auth = config.auth;

  if (!auth) {
    deps.logger.info(chalk.yellow('Not authenticated'));
    return;
  }

  deps.logger.info(chalk.blue('Authentication Status:'));
  deps.logger.info(`  Type: ${auth.type}`);
  if (auth.user) {
    deps.logger.info(`  User: ${auth.user.name} (${auth.user.email})`);
  }

  // Test token validity by making a simple API call
  if (auth.type === 'session') {
    const sessionClient = createSessionInstance({
      host,
      userSessionToken: auth.token,
    });
    // Test with a simple authenticated call - list orgs requires auth
    await listOrgs(sessionClient, { query: { pageSize: 1 } });
  } else if (auth.type === 'secretToken') {
    const secretClient = createSecretTokenInstance({
      host,
      secretToken: auth.token,
    });
    // Test with a simple authenticated call
    await listOrgs(secretClient, { query: { pageSize: 1 } });
  }

  deps.logger.info(chalk.green('Token is valid'));
}
