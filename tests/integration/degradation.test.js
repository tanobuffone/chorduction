/**
 * @jest-environment node
 * Integration test: Graceful degradation — error handling and fallback scenarios (v7)
 */
import { ChordDetector }   from '../../src/core/chord-detector.js';
import { SectionDetector } from '../../src/core/section-detector.js';
import { SmartCache }      from '../../src/cache/smart-cache.js';
import { blendResults }    from '../../src/ml/blend-strategy.js';
import { toTxt }           from '../../src/export/formatters/txt-formatter.js';
import { toJson }          from '../../src/export/formatters/json-formatter.js';

// ── Chord detection degradation ───────────────────────────────────────────────
describe('Degradation — chord detector', () => {
  let detector;
  beforeEach(() => { detector = new ChordDetector({ smoothingBeats: 1 }); });

  test('handles all-zero chroma without throwing', () => {
    expect(() => detector.detectChord(new Array(12).fill(0))).not.toThrow();
  });

  test('all-zero chroma returns chord object', () => {
    const r = detector.detectChord(new Array(12).fill(0));
    expect(r).toHaveProperty('chord');
    expect(r).toHaveProperty('confidence');
  });

  test('null analysis returns empty chords array', () => {
    const result = detector.processAnalysis(null, 0, 'standard');
    expect(Array.isArray(result.chords)).toBe(true);
    expect(result.chords).toHaveLength(0);
  });

  test('analysis without segments returns empty chords', () => {
    const result = detector.processAnalysis({ track: { tempo: 120 } }, 0, 'standard');
    expect(result.chords).toHaveLength(0);
  });

  test('analysis with empty beats returns empty chords', () => {
    const result = detector.processAnalysis(
      { beats: [], segments: [{ start: 0, duration: 2, pitches: new Array(12).fill(0.5) }] },
      0, 'standard'
    );
    expect(result.chords).toHaveLength(0);
  });
});

// ── Section detector degradation ──────────────────────────────────────────────
describe('Degradation — section detector', () => {
  const detector = new SectionDetector();

  test('handles empty input', () => {
    expect(detector.detect([])).toEqual([]);
  });

  test('fewer than 16 valid segments returns empty', () => {
    const segs = Array.from({ length: 8 }, (_, i) => ({
      start: i * 2, duration: 2,
      pitches: new Array(12).fill(0.1),
    }));
    expect(detector.detect(segs)).toEqual([]);
  });

  test('segments with null pitches are filtered (not crash)', () => {
    const base = Array.from({ length: 20 }, (_, i) => ({
      start: i * 2, duration: 2,
      pitches: new Array(12).fill(0.1),
    }));
    base[5] = { start: 10, duration: 2, pitches: null };
    expect(() => detector.detect(base)).not.toThrow();
  });
});

// ── Cache degradation ──────────────────────────────────────────────────────────
describe('Degradation — SmartCache', () => {
  test('getting missing key returns null', () => {
    const cache = new SmartCache({ capacity: 5, ttl: 1000 });
    expect(cache.get('any')).toBeNull();
  });

  test('clearing empty cache does not throw', () => {
    const cache = new SmartCache({ capacity: 5, ttl: 1000 });
    expect(() => cache.clear()).not.toThrow();
  });

  test('deleting missing key does not throw', () => {
    const cache = new SmartCache({ capacity: 5, ttl: 1000 });
    expect(() => cache.delete('ghost')).not.toThrow();
  });

  test('expired entries are cleaned up via has()', async () => {
    const cache = new SmartCache({ capacity: 5, ttl: 30 });
    cache.set('k', 'v');
    await new Promise(r => setTimeout(r, 60));
    expect(cache.has('k')).toBe(false);
    expect(cache.size).toBe(0);
  });
});

// ── ML blend degradation ──────────────────────────────────────────────────────
describe('Degradation — ML blend strategy', () => {
  const chroma = (chord, conf) => ({ chord, confidence: conf, source: 'chroma' });
  const ml     = (chord, conf) => ({ chord, confidence: conf, source: 'ml' });

  test('null mlResult falls back to chroma', () => {
    const result = blendResults(chroma('G', 0.8), null);
    expect(result.chord).toBe('G');
  });

  test('null chromaResult with high ML returns ML', () => {
    const result = blendResults(null, ml('Am', 0.9));
    expect(result.chord).toBe('Am');
  });

  test('both null does not throw', () => {
    expect(() => blendResults(null, null)).not.toThrow();
  });
});

// ── Export degradation ────────────────────────────────────────────────────────
describe('Degradation — export formatters', () => {
  const minimalData = {
    meta:     { title: 'Untitled', artist: 'Unknown', key: '?', tempo: 0, version: '7.0.0' },
    chords:   [],
    sections: [],
    lyrics:   [],
  };

  test('toTxt with empty chords returns a string', () => {
    expect(typeof toTxt(minimalData)).toBe('string');
  });

  test('toJson with empty chords returns valid JSON', () => {
    expect(() => JSON.parse(toJson(minimalData))).not.toThrow();
  });

  test('toJson chords array is empty', () => {
    expect(JSON.parse(toJson(minimalData)).chords).toEqual([]);
  });

  test('toTxt with zero-confidence chords still outputs chord name', () => {
    const data = {
      ...minimalData,
      chords: [{ startMs: 0, endMs: 2000, chord: 'C', rawChord: 'C', confidence: 0, source: 'chroma' }],
    };
    expect(toTxt(data)).toContain('C');
  });
});
