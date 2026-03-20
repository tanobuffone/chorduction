/**
 * @jest-environment node
 */
import { SectionDetector } from '../../../src/core/section-detector.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeSegment(start, pitches) {
  return { start, duration: 2, pitches };
}

function chromaFor(...pcs) {
  const v = new Array(12).fill(0);
  for (const pc of pcs) { v[pc] = 1.0; }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / norm);
}

const VERSE_CHROMA  = chromaFor(0, 4, 7);
const CHORUS_CHROMA = chromaFor(7, 11, 2, 5);

function makeSyntheticSegments(verseCount = 8, chorusCount = 8) {
  const segs = [];
  for (let i = 0; i < verseCount;  i++) { segs.push(makeSegment(i * 2, VERSE_CHROMA));  }
  for (let i = 0; i < chorusCount; i++) { segs.push(makeSegment((verseCount + i) * 2, CHORUS_CHROMA)); }
  return segs;
}

// ── Constructor ───────────────────────────────────────────────────────────────
describe('SectionDetector — constructor', () => {
  test('creates instance without options', () => {
    expect(() => new SectionDetector()).not.toThrow();
  });

  test('creates instance with custom kernelSize', () => {
    expect(() => new SectionDetector({ kernelSize: 4 })).not.toThrow();
  });
});

// ── detect — return shape ─────────────────────────────────────────────────────
describe('SectionDetector#detect — return shape', () => {
  let detector;
  beforeEach(() => { detector = new SectionDetector(); });

  // Need >= 16 valid segments for detect() to produce output
  const segs = makeSyntheticSegments(10, 10); // 20 segments

  test('returns an array', () => {
    expect(Array.isArray(detector.detect(segs))).toBe(true);
  });

  test('each section has type, startTime, endTime, repetitionIndex', () => {
    const result = detector.detect(segs);
    for (const s of result) {
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('startTime');
      expect(s).toHaveProperty('endTime');
      expect(s).toHaveProperty('repetitionIndex');
    }
  });

  test('sections are ordered by startTime ascending', () => {
    const result = detector.detect(segs);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startTime).toBeGreaterThanOrEqual(result[i - 1].startTime);
    }
  });

  test('startTime and endTime are non-negative seconds', () => {
    const result = detector.detect(segs);
    for (const s of result) {
      expect(s.startTime).toBeGreaterThanOrEqual(0);
      expect(s.endTime).toBeGreaterThanOrEqual(s.startTime);
    }
  });

  test('detects at least 2 sections for 20-segment two-section track', () => {
    expect(detector.detect(segs).length).toBeGreaterThanOrEqual(2);
  });

  test('type is a recognised section label', () => {
    const validTypes = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro', 'unknown'];
    for (const s of detector.detect(segs)) {
      expect(validTypes).toContain(s.type);
    }
  });

  test('repetitionIndex is >= 1', () => {
    for (const s of detector.detect(segs)) {
      expect(s.repetitionIndex).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── detect — edge cases ───────────────────────────────────────────────────────
describe('SectionDetector#detect — edge cases', () => {
  const detector = new SectionDetector();

  test('returns empty array for empty input', () => {
    expect(detector.detect([])).toEqual([]);
  });

  test('returns empty array for fewer than 16 valid segments', () => {
    const few = Array.from({ length: 5 }, (_, i) => makeSegment(i * 2, VERSE_CHROMA));
    expect(detector.detect(few)).toEqual([]);
  });

  test('handles segments with wrong-length pitches (filters them)', () => {
    const mixed = [
      ...makeSyntheticSegments(10, 10),
      { start: 100, duration: 2, pitches: [1, 2, 3] }, // wrong length — filtered
    ];
    expect(() => detector.detect(mixed)).not.toThrow();
  });

  test('handles segments with null pitches (filters them)', () => {
    const mixed = [
      ...makeSyntheticSegments(10, 10),
      { start: 100, duration: 2, pitches: null },
    ];
    expect(() => detector.detect(mixed)).not.toThrow();
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────
describe('SectionDetector — determinism', () => {
  test('same input produces same result', () => {
    const detector = new SectionDetector();
    const segs = makeSyntheticSegments(10, 10);
    const r1 = JSON.stringify(detector.detect(segs));
    const r2 = JSON.stringify(detector.detect(segs));
    expect(r1).toBe(r2);
  });
});
