export class HttpError extends Error {
  override readonly name = 'HttpError';

  constructor(
    readonly status: number,
    readonly url: string,
    readonly responseBody: string,
  ) {
    super(`HTTP ${status} from ${url}: ${summarize(responseBody)}`);
  }
}

export class ProviderFallbackError extends Error {
  override readonly name = 'ProviderFallbackError';

  constructor(readonly errors: readonly unknown[]) {
    super(errors.map(errorMessage).join('; ') || 'All model providers failed');
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Errors worth trying the next provider for: network failures, missing models,
 * rate limits, and server errors. Auth and request bugs stay on the caller.
 */
export function isFallbackError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (error instanceof HttpError) {
    return (
      error.status === 404 || error.status === 408 || error.status === 429 || error.status >= 500
    );
  }
  return error instanceof TypeError;
}

function summarize(body: string): string {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof json.error === 'string' && json.error) return json.error;
    if (json.error && typeof json.error === 'object' && json.error.message)
      return json.error.message;
    if (typeof json.message === 'string' && json.message) return json.message;
  } catch {
    // Keep the raw body.
  }
  const trimmed = body.trim();
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
