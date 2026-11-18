/**
 * Check if an error is an AxiosError by checking for the isAxiosError property
 * or by checking if it has a response property with a status field.
 */
function isAxiosError(error: unknown): error is {
  isAxiosError: boolean;
  response?: { status: number; data?: unknown; headers?: Record<string, unknown> };
  config?: { url?: string };
  message: string;
} {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (
    'isAxiosError' in error ||
    ('response' in error && typeof (error as { response?: { status?: unknown } }).response?.status === 'number')
  );
}

/**
 * Format an error into a user-friendly string message.
 * Handles both Error instances and other thrown values.
 * Specifically handles AxiosError to extract meaningful status codes and messages.
 *
 * @param error - The error to format
 * @returns A string representation of the error
 */
export function formatError(error: unknown): string {
  // Handle AxiosError specifically
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    // Refresh can fail before the command's asset request is sent. Identify that
    // stage without printing the Axios config/body, which contains credentials.
    if (error.config?.url?.endsWith('/auth/refresh-access-token')) {
      const headers = error.response?.headers;
      const trace = headers?.['x-cloud-trace-context'];
      const traceId =
        typeof trace === 'string' && /^[a-f0-9]{32}(?:\/\d+)?(?:;o=[01])?$/.test(trace)
          ? trace.split('/')[0]?.split(';')[0]
          : undefined;
      return `Token refresh failed${status ? ` (HTTP ${status})` : ''}.${traceId ? ` Trace ID: ${traceId}.` : ''} ${status === 401 ? 'Please run "threeify auth login" to authenticate.' : 'Please try again later.'}`;
    }

    // Extract error message from response data if available
    let errorMessage: string | undefined;
    if (responseData && typeof responseData === 'object' && 'error' in responseData) {
      errorMessage = String(responseData.error);
    }

    // Provide user-friendly messages for common HTTP status codes
    if (status === 401) {
      if (errorMessage) {
        return `${errorMessage}. Please run "threeify auth login" to authenticate.`;
      }
      return 'Authentication required. Please run "threeify auth login" to authenticate.';
    }
    if (status === 403) {
      return errorMessage || 'Access forbidden. You do not have permission to perform this action.';
    }
    if (status === 404) {
      return errorMessage || 'Resource not found.';
    }
    if (status === 429) {
      return errorMessage || 'Rate limit exceeded. Please try again later.';
    }
    if (status === 500) {
      return errorMessage || 'Internal server error. Please try again later.';
    }

    // For other status codes, include the status and message if available
    if (status) {
      return errorMessage ? `HTTP ${status}: ${errorMessage}` : `HTTP ${status}: ${error.message}`;
    }

    // Fallback to the error message if no response
    return error.message;
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle other types
  return String(error);
}
