import { AppError } from '../middleware/errorHandler.js';

/**
 * Normalized error for any upstream media provider failure.
 * Extends AppError so the existing centralized error handler formats it.
 */
export class ProviderError extends AppError {
  constructor(provider, kind, { retryAfterSeconds = null, upstreamStatus = null } = {}) {
    const def = PROVIDER_ERROR_KINDS[kind] || PROVIDER_ERROR_KINDS.UNAVAILABLE;
    super(def.message(provider, retryAfterSeconds), def.status, def.code, {
      provider,
      ...(retryAfterSeconds != null ? { retryAfterSeconds } : {}),
      ...(upstreamStatus != null ? { upstreamStatus } : {})
    });
    this.name = 'ProviderError';
    this.provider = provider;
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const PROVIDER_ERROR_KINDS = {
  NOT_CONFIGURED: {
    status: 503,
    code: 'PROVIDER_NOT_CONFIGURED',
    message: (p) => `${p} is not configured on the server. Ask the site owner to add its API credentials.`
  },
  AUTH: {
    status: 502,
    code: 'PROVIDER_AUTH_ERROR',
    message: (p) => `${p} rejected the server's credentials. The API token may be invalid or revoked.`
  },
  NOT_FOUND: {
    status: 404,
    code: 'MEDIA_NOT_FOUND',
    message: (p) => `That title was not found on ${p}.`
  },
  RATE_LIMITED: {
    status: 429,
    code: 'PROVIDER_RATE_LIMITED',
    message: (p, retry) =>
      `${p} is rate limiting requests right now.${retry ? ` Please try again in about ${retry} seconds.` : ' Please try again shortly.'}`
  },
  TIMEOUT: {
    status: 504,
    code: 'PROVIDER_TIMEOUT',
    message: (p) => `${p} took too long to respond. Please try again.`
  },
  NETWORK: {
    status: 502,
    code: 'PROVIDER_UNREACHABLE',
    message: (p) => `Could not reach ${p}. Please try again later.`
  },
  UNAVAILABLE: {
    status: 502,
    code: 'PROVIDER_UNAVAILABLE',
    message: (p) => `${p} is having problems right now. Please try again later.`
  },
  BAD_REQUEST: {
    status: 502,
    code: 'PROVIDER_BAD_REQUEST',
    message: (p) => `${p} could not process the request.`
  }
};

/** Shared fetch wrapper: timeout + network error mapping. Reads globalThis.fetch at call time (mockable). */
export async function fetchWithTimeout(provider, url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await globalThis.fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new ProviderError(provider, 'TIMEOUT');
    throw new ProviderError(provider, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a Retry-After header (seconds or HTTP date) into whole seconds, or null. */
export function parseRetryAfter(value) {
  if (value == null || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  return null;
}

export default ProviderError;
