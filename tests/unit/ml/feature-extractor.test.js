/**
 * @jest-environment node
 */
import { buildChromaMatrix, matrixToFloat32 } from '../../../src/ml/feature-extractor.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeSegment(start, pitchClass) {
  const v = new Array(12).fill(0);
  v[pitchClass] = 1.0;
  return { start, duration: 0.5, pitches: v };
}

function makeSegments(count, pitchClass = 0) {
  return Array.from({ length: count }, (_, i) => makeSegment(i * 0.5, pitchClass));
}

// ── buildChromaMatrix ─────────────────────────────────────────────────────────
describe('buildChromaMatrix', () => {
  test('returns a 12×16 matrix', () => {
    const segs   = makeSegments(32, 0);
    const matrix = buildChromaMatrix(segs, 16);
    expect(matrix).toHaveLength(12);
    for (const row of matrix) { expect(row).toHaveLength(16); }
  });

  test('all values are in [0, 1] after L2 normalisation', () => {
    const segs   = makeSegments(32, 4);
    const matrix = buildChromaMatrix(segs, 16);
    for (const row of matrix) {
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1 + 1e-10);
      }
    }
  });

  test('dominant pitch class has higher energy than silent ones', () => {
    // Only pitch class 0 active
    const segs   = makeSegments(32, 0);
    const matrix = buildChromaMatrix(segs, 16);
    const rowSum = i => matrix[i].reduce((a, b) => a + b, 0);
    expect(rowSum(0)).toBeGreaterThan(rowSum(6));
  });

  test('handles fewer segments than window size', () => {
    const segs = makeSegments(4, 0);
    expect(() => buildChromaMatrix(segs, 16)).not.toThrow();
    const matrix = buildChromaMatrix(segs, 16);
    expect(matrix).toHaveLength(12);
    expect(matrix[0]).toHaveLength(16);
  });

  test('handles empty segments array', () => {
    expect(() => buildChromaMatrix([], 0)).not.toThrow();
    const matrix = buildChromaMatrix([], 0);
    expect(matrix).toHaveLength(12);
  });

  test('centerIdx is respected (segments are centred)', () => {
    const segs   = makeSegments(64, 0);
    const m1 = buildChromaMatrix(segs, 16);
    const m2 = buildChromaMatrix(segs, 48);
    // Different center → different slices → at least one row differs
    expect(JSON.stringify(m1)).not.toBe(JSON.stringify(m2));
  });

  test('segments with null pitches are handled gracefully', () => {
    const segs = makeSegments(20, 0);
    segs[5] = { start: 2.5, duration: 0.5, pitches: null };
    expect(() => buildChromaMatrix(segs, 10)).not.toThrow();
  });
});

// ── matrixToFloat32 ───────────────────────────────────────────────────────────
describe('matrixToFloat32', () => {
  test('returns a Float32Array', () => {
    const matrix = Array.from({ length: 12 }, () => new Array(16).fill(0.5));
    const result = matrixToFloat32(matrix);
    expect(result).toBeInstanceOf(Float32Array);
  });

  test('returned array has length 12×16 = 192', () => {
    const matrix = Array.from({ length: 12 }, () => new Array(16).fill(0.0));
    expect(matrixToFloat32(matrix)).toHaveLength(192);
  });

  test('values are preserved with float32 precision', () => {
    const matrix = Array.from({ length: 12 }, (_, r) =>
      Array.from({ length: 16 }, (_, c) => (r * 16 + c) / 192)
    );
    const f32 = matrixToFloat32(matrix);
    // Check first and last values
    expect(f32[0]).toBeCloseTo(matrix[0][0], 5);
    expect(f32[191]).toBeCloseTo(matrix[11][15], 5);
  });

  test('handles all-zero matrix', () => {
    const matrix = Array.from({ length: 12 }, () => new Array(16).fill(0));
    const f32 = matrixToFloat32(matrix);
    expect(f32.every(v => v === 0)).toBe(true);
  });

  test('handles all-one matrix', () => {
    const matrix = Array.from({ length: 12 }, () => new Array(16).fill(1));
    const f32 = matrixToFloat32(matrix);
    expect(f32.every(v => Math.abs(v - 1) < 1e-5)).toBe(true);
  });
});
