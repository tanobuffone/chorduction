/**
 * @jest-environment node
 */
import {
  cosineSimilarity,
  pearsonCorrelation,
  binarySearchTime,
  mean,
  std,
  l2Normalize,
} from '../../../src/utils/math.js';

// ── cosineSimilarity ──────────────────────────────────────────────────────────
describe('cosineSimilarity', () => {
  test('identical vectors → 1', () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  test('orthogonal vectors → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  test('opposite vectors → -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  test('result is in [-1, 1]', () => {
    const a = [0.3, 0.7, 0.2, 0.1, 0.9];
    const b = [0.8, 0.1, 0.4, 0.6, 0.2];
    const r = cosineSimilarity(a, b);
    expect(r).toBeGreaterThanOrEqual(-1 - 1e-10);
    expect(r).toBeLessThanOrEqual(1 + 1e-10);
  });

  test('all-zero vector returns 0', () => {
    const result = cosineSimilarity([0, 0, 0], [1, 2, 3]);
    expect(result).toBe(0);
  });

  test('12-element chroma vectors', () => {
    const a = new Array(12).fill(0); a[0] = 1; a[4] = 1; a[7] = 1;
    const b = new Array(12).fill(0); b[0] = 1; b[4] = 1; b[7] = 1;
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });
});

// ── pearsonCorrelation ────────────────────────────────────────────────────────
describe('pearsonCorrelation', () => {
  test('identical arrays → 1', () => {
    const v = [1, 2, 3, 4, 5];
    expect(pearsonCorrelation(v, v)).toBeCloseTo(1, 5);
  });

  test('perfectly negative correlation → -1', () => {
    expect(pearsonCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });

  test('constant arrays return 0 or NaN (no correlation)', () => {
    const r = pearsonCorrelation([2, 2, 2], [1, 2, 3]);
    expect(isNaN(r) || r === 0).toBe(true);
  });

  test('result is in [-1, 1] for typical inputs', () => {
    const a = [0.3, 0.1, 0.8, 0.2, 0.9, 0.4];
    const b = [0.7, 0.5, 0.3, 0.6, 0.1, 0.8];
    const r = pearsonCorrelation(a, b);
    if (!isNaN(r)) {
      expect(r).toBeGreaterThanOrEqual(-1 - 1e-10);
      expect(r).toBeLessThanOrEqual(1 + 1e-10);
    }
  });
});

// ── binarySearchTime ──────────────────────────────────────────────────────────
describe('binarySearchTime', () => {
  // Each entry: { start: seconds, duration: seconds }
  const timeline = [
    { start: 0, duration: 2 },
    { start: 2, duration: 2 },
    { start: 4, duration: 2 },
    { start: 6, duration: 2 },
  ];

  test('returns 0 for time at beginning', () => {
    expect(binarySearchTime(timeline, 0)).toBe(0);
  });

  test('returns correct index for mid-point', () => {
    expect(binarySearchTime(timeline, 1)).toBe(0);
    expect(binarySearchTime(timeline, 3)).toBe(1);
    expect(binarySearchTime(timeline, 5)).toBe(2);
    expect(binarySearchTime(timeline, 7)).toBe(3);
  });

  test('returns last index for time beyond all entries', () => {
    const idx = binarySearchTime(timeline, 999);
    expect(idx).toBe(timeline.length - 1);
  });

  test('returns -1 or 0 for empty timeline', () => {
    const idx = binarySearchTime([], 5);
    expect(idx === -1 || idx === 0).toBe(true);
  });

  test('handles single-entry timeline', () => {
    const single = [{ start: 10, duration: 5 }];
    expect(binarySearchTime(single, 12)).toBe(0);
    expect(binarySearchTime(single, 0)).toBe(0);
  });

  test('exact start time matches that entry', () => {
    expect(binarySearchTime(timeline, 4)).toBe(2);
  });
});

// ── mean ──────────────────────────────────────────────────────────────────────
describe('mean', () => {
  test('[1, 2, 3] → 2', () => expect(mean([1, 2, 3])).toBeCloseTo(2));
  test('[0, 10] → 5', () => expect(mean([0, 10])).toBeCloseTo(5));
  test('[5] → 5', () => expect(mean([5])).toBeCloseTo(5));
  test('empty array → NaN or 0', () => {
    const r = mean([]);
    expect(isNaN(r) || r === 0).toBe(true);
  });
});

// ── std ───────────────────────────────────────────────────────────────────────
describe('std', () => {
  test('[2, 4, 4, 4, 5, 5, 7, 9] population std ≈ 2', () => {
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 1);
  });
  test('[1, 1, 1] → std = 0', () => expect(std([1, 1, 1])).toBeCloseTo(0));
  test('single element → 0', () => expect(std([42])).toBeCloseTo(0));
  test('empty array → NaN or 0', () => {
    const r = std([]);
    expect(isNaN(r) || r === 0).toBe(true);
  });
});

// ── l2Normalize ───────────────────────────────────────────────────────────────
describe('l2Normalize', () => {
  test('unit vector unchanged (within float precision)', () => {
    const v = [1, 0, 0];
    const n = l2Normalize(v);
    expect(n[0]).toBeCloseTo(1, 5);
    expect(n[1]).toBeCloseTo(0, 5);
  });

  test('normalised vector has L2 norm ≈ 1', () => {
    const v = [3, 4];
    const n = l2Normalize(v);
    const norm = Math.sqrt(n.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  test('zero vector returns zeros', () => {
    const v = [0, 0, 0];
    const n = l2Normalize(v);
    expect(n.every(x => x === 0)).toBe(true);
  });

  test('does not mutate the original array', () => {
    const v = [3, 4];
    const copy = [...v];
    l2Normalize(v);
    expect(v).toEqual(copy);
  });

  test('works for 12-element chroma vector', () => {
    const v = new Array(12).fill(0).map((_, i) => i + 1);
    const n = l2Normalize(v);
    const norm = Math.sqrt(n.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});
