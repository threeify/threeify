import crypto from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import { createSecretTokenInstance, exchangeAuthorizationCode, refreshAccessToken } from '@threeify/sdk';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import open from 'open';
import { type Config, getConfig } from './config.ts';
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

/** Preferred login callback ports: the long-standing default first, then two fallback ranges. */
export const callbackPorts = [
  ...Array.from({ length: 10 }, (_, index) => 8080 + index),
  ...Array.from({ length: 10 }, (_, index) => 18080 + index),
];

/** Listen on the first port that is free, so another local server on 8080 does not block login. */
export async function listenOnFreePort(server: http.Server, ports: number[]): Promise<number> {
  for (const port of ports) {
    const error = await new Promise<NodeJS.ErrnoException | undefined>((done) => {
      server.once('error', done);
      server.listen(port, () => {
        server.off('error', done);
        done(undefined);
      });
    });
    if (!error) return port;
    if (error.code !== 'EADDRINUSE' && error.code !== 'EACCES') throw error;
  }
  throw new Error(
    `Could not start the login callback server: ports ${ports.join(', ')} are all in use. Free one of them, or use \`threeify login --token\`.`,
  );
}

/**
 * Start a local HTTP server to receive the OAuth callback
 */
async function startCallbackServer(
  ports: number[],
): Promise<{ port: number; callback: Promise<{ code: string; state: string }> }> {
  const { promise: callback, resolve, reject } = Promise.withResolvers<{ code: string; state: string }>();
  {
    let timeoutId: NodeJS.Timeout | null = null;
    let isClosing = false;

    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }

      const url = new URL(req.url, 'http://localhost');
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

    const port = await listenOnFreePort(server, ports);

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
    return { port, callback };
  }
}

/**
 * Login using browser-based OAuth 2.0 flow with PKCE
 */
export async function loginWithBrowser(host: string, deps: CliDeps): Promise<void> {
  deps.logger.info(chalk.blue(`Logging in to ${host}...`));

  try {
    // OAuth client configuration
    const clientId = 'land-of-assets-cli';
    const scope = 'api';

    // Start the callback server first: the redirect URI depends on which port was free.
    const { port, callback: callbackPromise } = await startCallbackServer(callbackPorts);
    if (port !== callbackPorts[0])
      deps.logger.info(`Port ${callbackPorts[0]} is in use; receiving the login callback on port ${port}.`);
    const redirectUri = `http://localhost:${port}/callback`;

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
      loggedInAt: new Date().toISOString(),
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
    loggedInAt: new Date().toISOString(),
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
  const config = await getConfig(deps);
  const auth = config.auth;

  if (!auth) {
    deps.logger.info(chalk.yellow('Not authenticated'));
    return;
  }

  deps.logger.info(chalk.blue('Authentication Status:'));
  deps.logger.info(`  Host: ${host}`);
  deps.logger.info(`  Type: ${auth.type}`);

  // Validate the actual credential and get its lifetime, rather than the short-lived access token's expiry.
  const { auth: credential } = await refreshAccessToken(host, { body: { refreshToken: auth.token } }, true);
  deps.logger.info(`  Username: ${credential?.username ?? 'Unknown (server does not provide login details)'}`);
  const loggedInAt = auth.type === 'session' ? (credential?.createdAt ?? auth.loggedInAt) : auth.loggedInAt;
  deps.logger.info(`  Logged in: ${loggedInAt ? new Date(loggedInAt).toISOString() : 'Unknown'}`);
  if (auth.type === 'secretToken' && credential) {
    deps.logger.info(`  Token created: ${new Date(credential.createdAt).toISOString()}`);
  }
  deps.logger.info(
    `  Expires: ${credential ? (credential.expiresAt === null ? 'Never' : new Date(credential.expiresAt).toISOString()) : 'Unknown (server does not provide login details)'}`,
  );

  deps.logger.info(chalk.green('Token is valid'));
}
