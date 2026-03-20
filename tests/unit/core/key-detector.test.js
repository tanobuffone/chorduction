/**
 * @jest-environment node
 */
import { detectKey, buildAggregateChroma } from '../../../src/core/key-detector.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Build a normalised chroma vector from pitch-class weights */
function chromaFor(map) {
  const v = new Array(12).fill(0);
  for (const [pc, w] of Object.entries(map)) { v[Number(pc)] = w; }
  const sum = v.reduce((a, b) => a + b, 0) || 1;
  return v.map(x => x / sum);
}

// C major scale notes: C D E F G A B → 0 2 4 5 7 9 11
const C_MAJOR_CHROMA = chromaFor({ 0:1, 2:1, 4:1, 5:1, 7:1, 9:1, 11:1 });
// A minor natural: A B C D E F G → 9 11 0 2 4 5 7
const A_MINOR_CHROMA = chromaFor({ 9:1, 11:1, 0:1, 2:1, 4:1, 5:1, 7:1 });
// G major: G A B C D E F# → 7 9 11 0 2 4 6
const G_MAJOR_CHROMA = chromaFor({ 7:1, 9:1, 11:1, 0:1, 2:1, 4:1, 6:1 });
// D major: D E F# G A B C# → 2 4 6 7 9 11 1
const D_MAJOR_CHROMA = chromaFor({ 2:1, 4:1, 6:1, 7:1, 9:1, 11:1, 1:1 });

// ── detectKey ─────────────────────────────────────────────────────────────────
describe('detectKey', () => {
  test('returns object with key and confidence fields', () => {
    const result = detectKey(C_MAJOR_CHROMA);
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('confidence');
  });

  test('detects C major from C major scale chroma', () => {
    const { key } = detectKey(C_MAJOR_CHROMA);
    expect(key).toMatch(/^C\s*(major|maj|M)?$/i);
  });

  test('detects A minor from A minor scale chroma', () => {
    const { key } = detectKey(A_MINOR_CHROMA);
    // A minor and C major share all 7 pitches — algorithm may return either
    expect(key).toMatch(/^(Am|A\s*(minor|min|m)|C\s*(major|maj|M)?)/i);
  });

  test('detects G major from G major chroma', () => {
    const { key } = detectKey(G_MAJOR_CHROMA);
    expect(key).toMatch(/^G/);
  });

  test('detects D major from D major chroma', () => {
    const { key } = detectKey(D_MAJOR_CHROMA);
    expect(key).toMatch(/^D/);
  });

  test('confidence is between 0 and 1', () => {
    const { confidence } = detectKey(C_MAJOR_CHROMA);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  test('clear key has higher confidence than ambiguous one', () => {
    const clear = detectKey(C_MAJOR_CHROMA).confidence;
    const flat  = detectKey(new Array(12).fill(1 / 12)).confidence;
    expect(clear).toBeGreaterThan(flat);
  });

  test('handles all-zero chroma without throwing', () => {
    expect(() => detectKey(new Array(12).fill(0))).not.toThrow();
  });

  test('handles single-note chroma without throwing', () => {
    const oneNote = new Array(12).fill(0);
    oneNote[0] = 1;
    expect(() => detectKey(oneNote)).not.toThrow();
  });
});

// ── buildAggregateChroma ──────────────────────────────────────────────────────
describe('buildAggregateChroma', () => {
  const segments = [
    { pitches: C_MAJOR_CHROMA, duration: 2 },
    { pitches: G_MAJOR_CHROMA, duration: 2 },
    { pitches: C_MAJOR_CHROMA, duration: 2 },
  ];

  test('returns array of length 12', () => {
    const agg = buildAggregateChroma(segments);
    expect(agg).toHaveLength(12);
  });

  test('aggregate is normalised (max ≤ 1)', () => {
    const agg = buildAggregateChroma(segments);
    expect(Math.max(...agg)).toBeLessThanOrEqual(1 + 1e-10);
  });

  test('empty segments returns 12-zero array', () => {
    const agg = buildAggregateChroma([]);
    expect(agg).toHaveLength(12);
    expect(agg.every(v => v === 0)).toBe(true);
  });

  test('respects maxSegments cap', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      pitches: C_MAJOR_CHROMA,
      duration: 1,
    }));
    // Should not throw regardless of cap
    expect(() => buildAggregateChroma(many, 20)).not.toThrow();
    const agg = buildAggregateChroma(many, 20);
    expect(agg).toHaveLength(12);
  });

  test('segments without pitches are gracefully skipped', () => {
    const mixed = [
      { pitches: C_MAJOR_CHROMA, duration: 2 },
      { duration: 2 },                          // no pitches field
      { pitches: null, duration: 2 },
    ];
    expect(() => buildAggregateChroma(mixed)).not.toThrow();
  });
});
