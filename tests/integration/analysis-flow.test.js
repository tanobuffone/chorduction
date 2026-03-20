/**
 * @jest-environment node
 * Integration test: Analysis pipeline (v7)
 * Imports real src/ modules; no inline reimplementations.
 */
import { ChordDetector }   from '../../src/core/chord-detector.js';
import { SectionDetector } from '../../src/core/section-detector.js';
import { detectKey }       from '../../src/core/key-detector.js';
import { transposeProgression } from '../../src/core/transposer.js';
import { convertProgression }  from '../../src/core/chord-notation.js';
import { toTxt }           from '../../src/export/formatters/txt-formatter.js';
import { toJson }          from '../../src/export/formatters/json-formatter.js';
import { toChordPro }      from '../../src/export/formatters/chordpro-formatter.js';
import { ANALYSIS_FIXTURES, TRACK_FIXTURES } from '../e2e/setup/spicetify-mock.js';

let chordDetector;
let sectionDetector;
let analysis;
let track;

beforeAll(() => {
  chordDetector   = new ChordDetector({ smoothingBeats: 1 });
  sectionDetector = new SectionDetector();
  analysis        = ANALYSIS_FIXTURES.cMajorSong;
  track           = TRACK_FIXTURES.cMajorSong;
});

// ── Step 1: processAnalysis → { chords, key, ... } ────────────────────────────
describe('Pipeline — chord detection', () => {
  let result;
  beforeAll(() => { result = chordDetector.processAnalysis(analysis, 0, 'standard'); });

  test('returns object with chords array', () => {
    expect(result).toHaveProperty('chords');
    expect(Array.isArray(result.chords)).toBe(true);
  });

  test('returns key string', () => {
    expect(typeof result.key).toBe('string');
    expect(result.key.length).toBeGreaterThan(0);
  });

  test('chords array is non-empty', () => {
    expect(result.chords.length).toBeGreaterThan(0);
  });

  test('chords ordered by startMs', () => {
    for (let i = 1; i < result.chords.length; i++) {
      expect(result.chords[i].startMs).toBeGreaterThanOrEqual(result.chords[i - 1].startMs);
    }
  });

  test('chord names are non-empty strings', () => {
    for (const c of result.chords) {
      expect(typeof c.chord).toBe('string');
      expect(c.chord.length).toBeGreaterThan(0);
    }
  });

  test('all confidence values in [0,1]', () => {
    for (const c of result.chords) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ── Step 2: Key detection ─────────────────────────────────────────────────────
describe('Pipeline — key detection', () => {
  test('detects a valid key from C major fixture', () => {
    const { key, confidence } = detectKey(analysis.segments[0].pitches);
    expect(typeof key).toBe('string');
    expect(confidence).toBeGreaterThanOrEqual(0);
  });

  test('detected key contains C or A for C major scale', () => {
    const agg = analysis.segments[0].pitches.map(
      (v, i) => (v + analysis.segments[1].pitches[i]) / 2
    );
    const { key } = detectKey(agg);
    expect(key).toMatch(/[CcAa]/);
  });
});

// ── Step 3: Section detection ─────────────────────────────────────────────────
describe('Pipeline — section detection', () => {
  let sections;
  beforeAll(() => { sections = sectionDetector.detect(analysis.segments); });

  test('returns an array', () => {
    expect(Array.isArray(sections)).toBe(true);
  });

  test('each section has type, startTime, endTime, repetitionIndex', () => {
    for (const s of sections) {
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('startTime');
      expect(s).toHaveProperty('endTime');
      expect(s).toHaveProperty('repetitionIndex');
    }
  });
});

// ── Step 4: Transposition on chord string arrays ──────────────────────────────
describe('Pipeline — transposition', () => {
  let chordNames;
  beforeAll(() => {
    const result = chordDetector.processAnalysis(analysis, 0, 'standard');
    chordNames = result.chords.map(c => c.chord);
  });

  test('+12 and -12 cancel out', () => {
    const up   = transposeProgression(chordNames, 12);
    const down = transposeProgression(up, -12);
    expect(down).toEqual(chordNames);
  });

  test('+7 changes at least some chord names', () => {
    const shifted = transposeProgression(chordNames, 7);
    expect(shifted.join()).not.toBe(chordNames.join());
  });
});

// ── Step 5: Notation conversion on chord string arrays ───────────────────────
describe('Pipeline — notation conversion', () => {
  let chordNames;
  beforeAll(() => {
    const result = chordDetector.processAnalysis(analysis, 0, 'standard');
    chordNames = result.chords.map(c => c.chord);
  });

  test('Nashville returns numeric strings', () => {
    const converted = convertProgression(chordNames, 'nashville', 'C');
    for (const c of converted) { expect(c).toMatch(/^\d/); }
  });

  test('Roman returns roman-numeral strings', () => {
    const converted = convertProgression(chordNames, 'roman', 'C');
    for (const c of converted) { expect(c).toMatch(/^[IVXixi]/); }
  });
});

// ── Step 6: Export ────────────────────────────────────────────────────────────
describe('Pipeline — export', () => {
  let exportData;

  beforeAll(() => {
    const result   = chordDetector.processAnalysis(analysis, 0, 'standard');
    const sections = sectionDetector.detect(analysis.segments);
    exportData = {
      meta: {
        title:   track.name,
        artist:  track.artist,
        key:     result.key,
        tempo:   analysis.track.tempo,
        version: '7.0.0',
      },
      chords:   result.chords,
      sections,
      lyrics:   [],
    };
  });

  test('toTxt contains track title', () => {
    expect(toTxt(exportData)).toContain(track.name);
  });

  test('toJson has correct schemaVersion', () => {
    const obj = JSON.parse(toJson(exportData));
    expect(obj.meta.schemaVersion).toBe('2.0');
    expect(obj.meta.title).toBe(track.name);
  });

  test('toJson chords array matches length', () => {
    const obj = JSON.parse(toJson(exportData));
    expect(obj.chords).toHaveLength(exportData.chords.length);
  });

  test('toChordPro includes chord brackets', () => {
    expect(toChordPro(exportData)).toMatch(/\[.+\]/);
  });

  test('all three formats produce distinct output', () => {
    const txt      = toTxt(exportData);
    const json     = toJson(exportData);
    const chordpro = toChordPro(exportData);
    expect(txt).not.toBe(json);
    expect(json).not.toBe(chordpro);
  });
});

// ── Step 7: Cache simulation ──────────────────────────────────────────────────
describe('Pipeline — cache simulation', () => {
  test('map-based cache stores and retrieves analysis', () => {
    const cache = new Map();
    const key   = track.uri;
    cache.set(key, analysis);
    expect(cache.get(key)).toBe(analysis);
  });
});
