/**
 * @jest-environment node
 */
import { SmartCache } from '../../../src/cache/smart-cache.js';

// ── Basic get/set ─────────────────────────────────────────────────────────────
describe('SmartCache — basic operations', () => {
  let cache;
  beforeEach(() => { cache = new SmartCache({ capacity: 5, ttl: 10_000 }); });

  test('set and get a value', () => {
    cache.set('k1', 'hello');
    expect(cache.get('k1')).toBe('hello');
  });

  test('returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('overwrites existing key', () => {
    cache.set('k1', 'v1');
    cache.set('k1', 'v2');
    expect(cache.get('k1')).toBe('v2');
  });

  test('stores objects by reference', () => {
    const obj = { a: 1, b: [2, 3] };
    cache.set('obj', obj);
    expect(cache.get('obj')).toBe(obj);
  });

  test('stores null values', () => {
    cache.set('null', null);
    expect(cache.get('null')).toBeNull();
  });

  test('has() returns true for existing key', () => {
    cache.set('k', 1);
    expect(cache.has('k')).toBe(true);
  });

  test('has() returns false for missing key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  test('delete() removes a key', () => {
    cache.set('del', 42);
    cache.delete('del');
    expect(cache.has('del')).toBe(false);
  });

  test('delete() on non-existent key does not throw', () => {
    expect(() => cache.delete('ghost')).not.toThrow();
  });

  test('clear() removes all entries', () => {
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  test('size reflects current entry count', () => {
    cache.set('x', 1); cache.set('y', 2);
    expect(cache.size).toBe(2);
    cache.delete('x');
    expect(cache.size).toBe(1);
  });
});

// ── TTL expiry ────────────────────────────────────────────────────────────────
describe('SmartCache — TTL expiry', () => {
  test('entry is available before TTL expires', async () => {
    const cache = new SmartCache({ capacity: 5, ttl: 200 });
    cache.set('k', 'alive');
    await new Promise(r => setTimeout(r, 50));
    expect(cache.get('k')).toBe('alive');
  });

  test('entry expires after TTL', async () => {
    const cache = new SmartCache({ capacity: 5, ttl: 50 });
    cache.set('k', 'expired');
    await new Promise(r => setTimeout(r, 100));
    expect(cache.get('k')).toBeNull();
  });

  test('has() returns false for expired entry', async () => {
    const cache = new SmartCache({ capacity: 5, ttl: 50 });
    cache.set('k', 'expired');
    await new Promise(r => setTimeout(r, 100));
    expect(cache.has('k')).toBe(false);
  });

  test('refreshing a key resets TTL', async () => {
    const cache = new SmartCache({ capacity: 5, ttl: 150 });
    cache.set('k', 'v');
    await new Promise(r => setTimeout(r, 80));
    cache.set('k', 'refreshed'); // reset TTL
    await new Promise(r => setTimeout(r, 100));
    expect(cache.get('k')).toBe('refreshed');
  });
});

// ── Capacity + eviction ───────────────────────────────────────────────────────
describe('SmartCache — capacity enforcement', () => {
  test('does not exceed capacity limit', () => {
    const cache = new SmartCache({ capacity: 3, ttl: 60_000 });
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    cache.set('d', 4);
    expect(cache.size).toBeLessThanOrEqual(3);
  });

  test('evicts least-used entry', () => {
    const cache = new SmartCache({ capacity: 3, ttl: 60_000 });
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    // Access 'b' and 'c' to increase their usage
    cache.get('b'); cache.get('b');
    cache.get('c');
    cache.set('d', 4); // 'a' should be evicted (lowest usage/frequency)
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  test('capacity of 1 keeps only most recent entry', () => {
    const cache = new SmartCache({ capacity: 1, ttl: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(1);
    expect(cache.has('b')).toBe(true);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────
describe('SmartCache — edge cases', () => {
  test('capacity=0 does not crash', () => {
    expect(() => new SmartCache({ capacity: 0, ttl: 1000 })).not.toThrow();
  });

  test('large capacity stores many entries without issue', () => {
    const cache = new SmartCache({ capacity: 10_000, ttl: 60_000 });
    for (let i = 0; i < 50; i++) { cache.set(`k${i}`, i); }
    expect(cache.size).toBe(50);
  });

  test('numeric keys work', () => {
    const cache = new SmartCache({ capacity: 5, ttl: 60_000 });
    cache.set(42, 'numeric');
    expect(cache.get(42)).toBe('numeric');
  });
});
