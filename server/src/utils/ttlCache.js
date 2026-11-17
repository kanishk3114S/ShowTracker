/**
 * Small in-memory TTL cache with a hard size cap.
 *
 * - Bounded: when `maxEntries` is reached the oldest entry is evicted first.
 * - `getOrLoad` also de-duplicates concurrent identical requests, so ten users
 *   searching the same thing trigger one provider call, not ten.
 * - Failed loads are never cached.
 *
 * NOTE: this cache lives inside ONE Node process. It is not shared between
 * multiple backend instances and is cleared on every restart. Redis would be the
 * upgrade path if the API is ever scaled horizontally.
 */
export class TTLCache {
  constructor({ maxEntries = 500 } = {}) {
    this.maxEntries = maxEntries;
    this.store = new Map(); // key -> { value, expiresAt }
    this.inflight = new Map(); // key -> Promise
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      this.store.delete(this.store.keys().next().value);
    }
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.inflight.clear();
  }

  get size() {
    return this.store.size;
  }

  /**
   * Return the cached value, or run `loader` once and cache its result.
   * `refresh: true` skips the cached value (explicit refresh) but still shares in-flight work.
   */
  async getOrLoad(key, ttlMs, loader, { refresh = false } = {}) {
    if (!refresh) {
      const hit = this.get(key);
      if (hit !== undefined) return hit;
    }
    if (this.inflight.has(key)) return this.inflight.get(key);

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }
}

export default TTLCache;
