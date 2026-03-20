/**
 * @jest-environment node
 */
import { blendResults } from '../../../src/ml/blend-strategy.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function chromaResult(chord, confidence) {
  return { chord, confidence, source: 'chroma' };
}
function mlResult(chord, confidence) {
  return { chord, confidence, source: 'ml' };
}

// ── High ML confidence — ML wins ──────────────────────────────────────────────
describe('blendResults — high ML confidence (≥0.7)', () => {
  test('returns ML chord when ML confidence is 0.9', () => {
    const result = blendResults(
      chromaResult('C', 0.6),
      mlResult('Am', 0.9),
    );
    expect(result.chord).toBe('Am');
  });

  test('returns ML chord when ML confidence is exactly 0.7', () => {
    const result = blendResults(
      chromaResult('F', 0.8),
      mlResult('G', 0.7),
    );
    expect(result.chord).toBe('G');
  });

  test('confidence in result is >= 0.7', () => {
    const result = blendResults(chromaResult('C', 0.5), mlResult('D', 0.85));
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ── Low ML confidence — chroma wins ──────────────────────────────────────────
describe('blendResults — low ML confidence (<0.5)', () => {
  test('returns chroma chord when ML confidence is 0.3', () => {
    const result = blendResults(
      chromaResult('Cmaj7', 0.75),
      mlResult('F', 0.3),
    );
    expect(result.chord).toBe('Cmaj7');
  });

  test('returns chroma chord when ML confidence is 0.0', () => {
    const result = blendResults(
      chromaResult('Em', 0.8),
      mlResult('Bb', 0.0),
    );
    expect(result.chord).toBe('Em');
  });

  test('confidence reflects chroma result when ML is low', () => {
    const chroma = chromaResult('G', 0.9);
    const result = blendResults(chroma, mlResult('X', 0.1));
    expect(result.confidence).toBeCloseTo(chroma.confidence, 1);
  });
});

// ── Middle zone (0.5 ≤ ML < 0.7) — blend ────────────────────────────────────
describe('blendResults — blend zone (0.5–0.7)', () => {
  test('returns a chord (either ML or chroma) for ML confidence 0.6', () => {
    const result = blendResults(
      chromaResult('C', 0.7),
      mlResult('C', 0.6),
    );
    expect(typeof result.chord).toBe('string');
    expect(result.chord.length).toBeGreaterThan(0);
  });

  test('agreement boosts confidence when both predict same chord', () => {
    const agree    = blendResults(chromaResult('Am', 0.6), mlResult('Am', 0.6));
    const disagree = blendResults(chromaResult('Am', 0.6), mlResult('F',  0.6));
    expect(agree.confidence).toBeGreaterThanOrEqual(disagree.confidence);
  });

  test('confidence is in [0, 1] range', () => {
    const result = blendResults(chromaResult('D', 0.65), mlResult('D', 0.55));
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ── Return shape ──────────────────────────────────────────────────────────────
describe('blendResults — return shape', () => {
  test('always returns object with chord and confidence', () => {
    const result = blendResults(chromaResult('C', 0.5), mlResult('C', 0.5));
    expect(result).toHaveProperty('chord');
    expect(result).toHaveProperty('confidence');
  });

  test('chord is a non-empty string', () => {
    const result = blendResults(chromaResult('C', 0.8), mlResult('Am', 0.9));
    expect(typeof result.chord).toBe('string');
    expect(result.chord.length).toBeGreaterThan(0);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────
describe('blendResults — edge cases', () => {
  test('both confidence=0 does not throw', () => {
    expect(() => blendResults(chromaResult('?', 0), mlResult('?', 0))).not.toThrow();
  });

  test('both confidence=1 does not throw', () => {
    expect(() => blendResults(chromaResult('C', 1), mlResult('C', 1))).not.toThrow();
  });

  test('null mlResult falls back to chroma', () => {
    const result = blendResults(chromaResult('G', 0.8), null);
    expect(result.chord).toBe('G');
  });

  test('null chromaResult with high ML returns ML', () => {
    const result = blendResults(null, mlResult('Am', 0.9));
    expect(result.chord).toBe('Am');
  });
});
