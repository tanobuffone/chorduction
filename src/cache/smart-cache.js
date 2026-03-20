/**
 * @fileoverview Generic LRU cache with TTL and access-frequency-scored eviction.
 * @module cache/smart-cache
 */

/**
 * @template K, V
 */
export class SmartCache {
  /**
   * @param {{ name?: string, ttl?: number, capacity?: number }} [options]
   */
  constructor({ name = 'cache', ttl = 600_000, capacity = 20 } = {}) {
    this.name     = name;
    this.ttl      = ttl;
    this.capacity = capacity;
    /** @type {Map<K, { value: V, createdAt: number, lastAccess: number, accessCount: number }>} */
    this._store   = new Map();
  }

  /**
   * @param {K} key
   * @returns {V|null}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) { return null; }
    if (Date.now() - entry.createdAt > this.ttl) {
      this._store.delete(key);
      return null;
    }
    entry.lastAccess = Date.now();
    entry.accessCount++;
    return entry.value;
  }

  /**
   * @param {K} key
   * @param {V} value
   */
  set(key, value) {
    const now = Date.now();
    this._store.set(key, { value, createdAt: now, lastAccess: now, accessCount: 1 });
    this._evict();
  }

  /**
   * @param {K} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this._store.get(key);
    if (!entry) { return false; }
    if (Date.now() - entry.createdAt > this.ttl) { this._store.delete(key); return false; }
    return true;
  }

  /**
   * @param {K} key
   */
  delete(key) { this._store.delete(key); }

  /** Remove all entries. */
  clear() { this._store.clear(); }

  /** @returns {number} */
  get size() { return this._store.size; }

  _evict() {
    if (this._store.size <= this.capacity) { return; }
    // Score: higher = keep. score = accessCount / age_ms
    const entries = Array.from(this._store.entries()).map(([k, e]) => ({
      key: k,
      score: e.accessCount / (Date.now() - e.createdAt + 1),
    }));
    entries.sort((a, b) => a.score - b.score);
    const toRemove = entries.slice(0, this._store.size - this.capacity);
    for (const { key } of toRemove) { this._store.delete(key); }
  }
}
