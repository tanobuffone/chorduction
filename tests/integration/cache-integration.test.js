/**
 * @jest-environment node
 * Integration test: SmartCache + analysis provider interaction (v7)
 */
import { SmartCache }    from '../../src/cache/smart-cache.js';
import { createCaches }  from '../../src/cache/cache-manager.js';

// ── SmartCache + analysis data ────────────────────────────────────────────────
describe('Cache integration — analysis caching', () => {
  let cache;

  beforeEach(() => {
    cache = new SmartCache({ capacity: 10, ttl: 5_000 });
  });

  test('stores and retrieves a full analysis object', () => {
    const analysis = { track: { tempo: 120 }, segments: [] };
    cache.set('spotify:track:abc', analysis);
    expect(cache.get('spotify:track:abc')).toBe(analysis);
  });

  test('second get() of same key does not evict it', () => {
    cache.set('k1', { a: 1 });
    cache.get('k1');
    cache.get('k1');
    expect(cache.has('k1')).toBe(true);
  });

  test('frequently accessed entry survives eviction pressure', () => {
    const small = new SmartCache({ capacity: 3, ttl: 60_000 });
    small.set('hot', { important: true });
    for (let i = 0; i < 10; i++) { small.get('hot'); }
    small.set('cold1', 1);
    small.set('cold2', 2);
    small.set('cold3', 3);
    expect(small.has('hot')).toBe(true);
  });

  test('cache miss returns null', () => {
    expect(cache.get('spotify:track:unknown')).toBeNull();
  });

  test('expired analysis is not returned', async () => {
    const tiny = new SmartCache({ capacity: 5, ttl: 30 });
    tiny.set('k', { data: 'fresh' });
    await new Promise(r => setTimeout(r, 60));
    expect(tiny.get('k')).toBeNull();
  });
});

// ── createCaches factory ──────────────────────────────────────────────────────
describe('Cache integration — createCaches factory', () => {
  let caches;

  beforeEach(() => {
    caches = createCaches({ ttl: 5_000, capacity: 20 });
  });

  test('returns analysis, lyrics, and timeline caches', () => {
    expect(caches).toHaveProperty('analysis');
    expect(caches).toHaveProperty('lyrics');
    expect(caches).toHaveProperty('timeline');
  });

  test('each cache is an instance of SmartCache', () => {
    expect(caches.analysis).toBeInstanceOf(SmartCache);
    expect(caches.lyrics).toBeInstanceOf(SmartCache);
    expect(caches.timeline).toBeInstanceOf(SmartCache);
  });

  test('analysis and lyrics caches are independent', () => {
    const trackId = 'spotify:track:xyz';
    caches.analysis.set(trackId, { tempo: 120 });
    caches.lyrics.set(trackId, [{ startMs: 0, text: 'Hello' }]);
    expect(caches.analysis.get(trackId)).toEqual({ tempo: 120 });
    expect(caches.lyrics.get(trackId)).toEqual([{ startMs: 0, text: 'Hello' }]);
  });

  test('clearing analysis cache does not affect lyrics cache', () => {
    caches.analysis.set('t1', { a: 1 });
    caches.lyrics.set('t1', [{ startMs: 0, text: 'test' }]);
    caches.analysis.clear();
    expect(caches.analysis.has('t1')).toBe(false);
    expect(caches.lyrics.has('t1')).toBe(true);
  });

  test('timeline cache holds array values', () => {
    const timeline = [
      { startMs: 0,    chord: 'C',  confidence: 0.9 },
      { startMs: 2000, chord: 'Am', confidence: 0.8 },
    ];
    caches.timeline.set('track:t2', timeline);
    expect(caches.timeline.get('track:t2')).toBe(timeline);
  });
});

// ── Multi-track cache interaction ─────────────────────────────────────────────
describe('Cache integration — multi-track eviction', () => {
  test('different track IDs stored independently', () => {
    const cache = new SmartCache({ capacity: 10, ttl: 60_000 });
    cache.set('t1', { data: 'track-1' });
    cache.set('t2', { data: 'track-2' });
    cache.set('t3', { data: 'track-3' });
    expect(cache.get('t1')).toEqual({ data: 'track-1' });
    expect(cache.get('t2')).toEqual({ data: 'track-2' });
    expect(cache.get('t3')).toEqual({ data: 'track-3' });
  });

  test('overwriting same key does not grow cache size', () => {
    const cache = new SmartCache({ capacity: 5, ttl: 60_000 });
    cache.set('same', 'v1');
    cache.set('same', 'v2');
    cache.set('same', 'v3');
    expect(cache.size).toBe(1);
    expect(cache.get('same')).toBe('v3');
  });
});
