/**
 * @jest-environment node
 * Integration test: Export flow — transpose → notation → multi-format export (v7)
 */
import { transposeProgression } from '../../src/core/transposer.js';
import { convertProgression }   from '../../src/core/chord-notation.js';
import { toTxt }                from '../../src/export/formatters/txt-formatter.js';
import { toJson }               from '../../src/export/formatters/json-formatter.js';
import { toChordPro }           from '../../src/export/formatters/chordpro-formatter.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────
// ChordResult objects (as returned by ChordDetector.processAnalysis)
const BASE_CHORDS = [
  { startMs: 0,     endMs: 2000,  chord: 'C',  rawChord: 'C',  confidence: 0.9,  source: 'chroma' },
  { startMs: 2000,  endMs: 4000,  chord: 'Am', rawChord: 'Am', confidence: 0.8,  source: 'chroma' },
  { startMs: 4000,  endMs: 6000,  chord: 'F',  rawChord: 'F',  confidence: 0.85, source: 'chroma' },
  { startMs: 6000,  endMs: 8000,  chord: 'G',  rawChord: 'G',  confidence: 0.7,  source: 'chroma' },
  { startMs: 8000,  endMs: 10000, chord: 'C',  rawChord: 'C',  confidence: 0.9,  source: 'chroma' },
  { startMs: 10000, endMs: 12000, chord: 'F',  rawChord: 'F',  confidence: 0.85, source: 'chroma' },
  { startMs: 12000, endMs: 14000, chord: 'G',  rawChord: 'G',  confidence: 0.8,  source: 'chroma' },
  { startMs: 14000, endMs: 16000, chord: 'C',  rawChord: 'C',  confidence: 0.9,  source: 'chroma' },
];

// SectionLabel objects (type/startTime/endTime in SECONDS/repetitionIndex)
const BASE_SECTIONS = [
  { type: 'verse',  startTime: 0, endTime: 8,  repetitionIndex: 1 },
  { type: 'chorus', startTime: 8, endTime: 16, repetitionIndex: 1 },
];

const BASE_LYRICS = [
  { startMs: 0,    text: 'Hello world' },
  { startMs: 2000, text: 'Second line' },
  { startMs: 8000, text: 'Chorus line' },
];

const BASE_META = { title: 'Flow Test Song', artist: 'Export Artist', key: 'C major', tempo: 120, version: '7.0.0' };

// Helper: get chord name strings from ChordResult array
const chordNames = (arr) => arr.map(c => c.chord);

// Helper: apply transposed string array back to ChordResult objects
const applyTranspose = (chords, semitones) => {
  const transposedNames = transposeProgression(chordNames(chords), semitones);
  return chords.map((c, i) => ({ ...c, chord: transposedNames[i], rawChord: c.rawChord }));
};

// Helper: apply notation conversion to ChordResult objects
const applyNotation = (chords, notation, key) => {
  const converted = convertProgression(chordNames(chords), notation, key);
  return chords.map((c, i) => ({ ...c, chord: converted[i] }));
};

// ── Transpose → export ────────────────────────────────────────────────────────
describe('Export flow — transpose then export', () => {
  test('transpose +5 preserves chord count in JSON', () => {
    const transposed = applyTranspose(BASE_CHORDS, 5);
    const data = { meta: { ...BASE_META, key: 'F major' }, chords: transposed, sections: BASE_SECTIONS, lyrics: [] };
    const obj = JSON.parse(toJson(data));
    expect(obj.chords).toHaveLength(BASE_CHORDS.length);
  });

  test('transpose -5 → ChordPro still has chord brackets', () => {
    const transposed = applyTranspose(BASE_CHORDS, -5);
    const data = { meta: BASE_META, chords: transposed, sections: [], lyrics: [] };
    expect(toChordPro(data)).toMatch(/\[.+\]/);
  });

  test('startMs values preserved through transpose', () => {
    const transposed = applyTranspose(BASE_CHORDS, 3);
    expect(transposed.map(c => c.startMs)).toEqual(BASE_CHORDS.map(c => c.startMs));
  });
});

// ── Notation → export ─────────────────────────────────────────────────────────
describe('Export flow — notation conversion then export', () => {
  test('Nashville → txt contains numeric chord names', () => {
    const converted = applyNotation(BASE_CHORDS, 'nashville', 'C');
    const data = { meta: BASE_META, chords: converted, sections: BASE_SECTIONS, lyrics: [] };
    const out = toTxt(data);
    expect(out).toContain('1');
    expect(out).toContain('4');
    expect(out).toContain('5');
  });

  test('Roman → JSON entries have Roman numeral chords', () => {
    const converted = applyNotation(BASE_CHORDS, 'roman', 'C');
    const data = { meta: BASE_META, chords: converted, sections: [], lyrics: [] };
    const obj = JSON.parse(toJson(data));
    for (const c of obj.chords) { expect(c.chord).toMatch(/^[IVXixi]/); }
  });
});

// ── Full chain ────────────────────────────────────────────────────────────────
describe('Export flow — full chain', () => {
  let exportData;

  beforeAll(() => {
    const transposed = applyTranspose(BASE_CHORDS, 2);
    const converted  = applyNotation(transposed, 'standard', 'D');
    exportData = {
      meta:     { ...BASE_META, key: 'D major' },
      chords:   converted,
      sections: BASE_SECTIONS,
      lyrics:   BASE_LYRICS,
    };
  });

  test('toTxt succeeds and is non-empty', () => {
    const out = toTxt(exportData);
    expect(typeof out).toBe('string');
    expect(out.trim().length).toBeGreaterThan(0);
  });

  test('toJson produces valid JSON with schemaVersion in meta', () => {
    const obj = JSON.parse(toJson(exportData));
    expect(obj.meta.schemaVersion).toBe('2.0');
    expect(obj.chords).toHaveLength(BASE_CHORDS.length);
  });

  test('toChordPro produces chorus markers (has lyrics + sections)', () => {
    const out = toChordPro(exportData);
    expect(out).toContain('{start_of_chorus}');
    expect(out).toContain('{end_of_chorus}');
  });

  test('all formats include song title', () => {
    const title = 'Flow Test Song';
    expect(toTxt(exportData)).toContain(title);
    expect(toJson(exportData)).toContain(title);
    expect(toChordPro(exportData)).toContain(title);
  });

  test('all formats produce distinct output', () => {
    const txt      = toTxt(exportData);
    const json     = toJson(exportData);
    const chordpro = toChordPro(exportData);
    expect(txt).not.toBe(json);
    expect(json).not.toBe(chordpro);
    expect(txt).not.toBe(chordpro);
  });
});
