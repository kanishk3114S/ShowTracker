/**
 * TMDB health: a small circuit breaker.
 *
 * When TMDB is unreachable (blocked by an ISP, down, very slow) every request would otherwise wait for its
 * timeout before the fallback providers are even tried, so each page load takes many seconds. After a
 * transport failure the circuit OPENS for CIRCUIT_OPEN_MS: during that time callers that have a fallback go
 * straight to it. When the time is up the next call tries TMDB again (a probe); success closes the circuit,
 * another failure re-opens it.
 *
 * Only transport-level failures count (timeout, dropped connection, 5xx). A 404 or 401 means TMDB answered.
 * Disabled in tests (NODE_ENV=test) unless PROVIDER_CIRCUIT_FORCE=true, so unrelated tests never see state
 * left behind by one another.
 */
export const CIRCUIT_OPEN_MS = 90_000;

let openUntil = 0;

const enabled = () => process.env.NODE_ENV !== 'test' || process.env.PROVIDER_CIRCUIT_FORCE === 'true';

export function recordTmdbFailure() {
  if (enabled()) openUntil = Date.now() + CIRCUIT_OPEN_MS;
}

export function recordTmdbSuccess() {
  openUntil = 0;
}

/** True while TMDB is considered unreachable. */
export function tmdbCircuitOpen() {
  return enabled() && Date.now() < openUntil;
}

export function tmdbHealth() {
  const open = tmdbCircuitOpen();
  return { open, retryInSeconds: open ? Math.ceil((openUntil - Date.now()) / 1000) : 0 };
}

export function resetProviderHealth() {
  openUntil = 0;
}
