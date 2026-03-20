/**
 * @jest-environment node
 */
import { ChordDetector } from '../../../src/core/chord-detector.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function chromaFor(...pitchClasses) {
  const v = new Array(12).fill(0);
  for (const pc of pitchClasses) { v[pc] = 1.0; }
  return v;
}

const C_MAJOR_CHROMA = chromaFor(0, 4, 7);
const A_MINOR_CHROMA = chromaFor(9, 0, 4);
const G_MAJOR_CHROMA = chromaFor(7, 11, 2);
const FLAT_CHROMA    = new Array(12).fill(1 / 12);

// ── Constructor ───────────────────────────────────────────────────────────────
describe('ChordDetector — constructor', () => {
  test('creates instance with defaults', () => {
    expect(() => new ChordDetector()).not.toThrow();
  });

  test('accepts all recognised options', () => {
    expect(() => new ChordDetector({
      smoothingBeats: 3,
      minConfidence: 0.2,
      chordSimplification: 2,
    })).not.toThrow();
  });
});

// ── detectChord ───────────────────────────────────────────────────────────────
describe('ChordDetector#detectChord', () => {
  let detector;
  beforeEach(() => { detector = new ChordDetector({ smoothingBeats: 1 }); });

  test('returns object with chord and confidence', () => {
    const result = detector.detectChord(C_MAJOR_CHROMA);
    expect(result).toHaveProperty('chord');
    expect(result).toHaveProperty('confidence');
  });

  test('detects C major', () => {
    const { chord } = detector.detectChord(C_MAJOR_CHROMA);
    expect(chord).toMatch(/^C(maj|M|major)?$/i);
  });

  test('detects A minor', () => {
    const { chord } = detector.detectChord(A_MINOR_CHROMA);
    expect(chord).toMatch(/^Am?(in|inor)?$/i);
  });

  test('detects G major', () => {
    const { chord } = detector.detectChord(G_MAJOR_CHROMA);
    expect(chord).toMatch(/^G(maj|M|major)?$/i);
  });

  test('confidence in [0,1]', () => {
    const { confidence } = detector.detectChord(C_MAJOR_CHROMA);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  test('flat chroma has lower confidence than chord chroma', () => {
    const { confidence: flat }  = detector.detectChord(FLAT_CHROMA);
    const { confidence: chord } = detector.detectChord(C_MAJOR_CHROMA);
    expect(chord).toBeGreaterThan(flat);
  });

  test('handles all-zero chroma without throwing', () => {
    expect(() => detector.detectChord(new Array(12).fill(0))).not.toThrow();
  });

  test('handles short array without throwing', () => {
    expect(() => detector.detectChord(new Array(6).fill(0.5))).not.toThrow();
  });
});

// ── Smoothing ─────────────────────────────────────────────────────────────────
describe('ChordDetector — smoothing', () => {
  test('repeated calls with same chroma stabilise', () => {
    const detector = new ChordDetector({ smoothingBeats: 4 });
    for (let i = 0; i < 8; i++) { detector.detectChord(C_MAJOR_CHROMA); }
    const { chord } = detector.detectChord(C_MAJOR_CHROMA);
    expect(chord).toMatch(/^C/);
  });

  test('smoothingBeats=1 gives direct result', () => {
    const fast = new ChordDetector({ smoothingBeats: 1 });
    expect(fast.detectChord(G_MAJOR_CHROMA).chord).toMatch(/^G/);
  });
});

// ── processAnalysis ───────────────────────────────────────────────────────────
describe('ChordDetector#processAnalysis', () => {
  let detector;
  beforeEach(() => { detector = new ChordDetector({ smoothingBeats: 1 }); });

  const fakeAnalysis = {
    track: { tempo: 120 },
    beats: [
      { start: 0, duration: 2 }, { start: 2, duration: 2 },
      { start: 4, duration: 2 }, { start: 6, duration: 2 },
    ],
    segments: [
      { start: 0, duration: 2, pitches: C_MAJOR_CHROMA },
      { start: 2, duration: 2, pitches: A_MINOR_CHROMA },
      { start: 4, duration: 2, pitches: G_MAJOR_CHROMA },
      { start: 6, duration: 2, pitches: C_MAJOR_CHROMA },
    ],
  };

  test('returns object with chords array', () => {
    const result = detector.processAnalysis(fakeAnalysis, 0, 'standard');
    expect(result).toHaveProperty('chords');
    expect(Array.isArray(result.chords)).toBe(true);
  });

  test('returns key and keyConfidence', () => {
    const result = detector.processAnalysis(fakeAnalysis, 0, 'standard');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyConfidence');
    expect(typeof result.key).toBe('string');
  });

  test('each chords entry has startMs, chord, confidence', () => {
    const { chords } = detector.processAnalysis(fakeAnalysis, 0, 'standard');
    for (const entry of chords) {
      expect(entry).toHaveProperty('startMs');
      expect(entry).toHaveProperty('chord');
      expect(entry).toHaveProperty('confidence');
    }
  });

  test('transposing changes chord names', () => {
    const normal     = detector.processAnalysis(fakeAnalysis, 0, 'standard');
    const transposed = detector.processAnalysis(fakeAnalysis, 2, 'standard');
    expect(JSON.stringify(normal.chords)).not.toBe(JSON.stringify(transposed.chords));
  });

  test('empty segments returns empty chords', () => {
    const result = detector.processAnalysis({ beats: [], segments: [] }, 0, 'standard');
    expect(result.chords).toHaveLength(0);
  });

  test('null analysis returns empty chords', () => {
    const result = detector.processAnalysis(null, 0, 'standard');
    expect(result.chords).toHaveLength(0);
  });
});

// ── chordSimplification ───────────────────────────────────────────────────────
describe('ChordDetector — chordSimplification', () => {
  test('simplification=1 (triads) strips 7th extensions from output', () => {
    const detector = new ChordDetector({ smoothingBeats: 1, chordSimplification: 1 });
    const result   = detector.detectChord(chromaFor(0, 4, 7, 10)); // C7-ish
    if (result.chord !== 'N') {
      expect(result.chord).not.toMatch(/7/);
    }
  });

  test('simplification=3 (full) does not throw', () => {
    const detector = new ChordDetector({ smoothingBeats: 1, chordSimplification: 3 });
    expect(() => detector.detectChord(C_MAJOR_CHROMA)).not.toThrow();
  });
});
