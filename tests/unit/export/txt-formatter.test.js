/**
 * @jest-environment node
 */
import { toTxt } from '../../../src/export/formatters/txt-formatter.js';

// ── Sample ExportData ─────────────────────────────────────────────────────────
// Sections use type/startTime/endTime (seconds) per SectionLabel typedef
const sampleData = {
  meta: { title: 'Test Song', artist: 'Test Artist', key: 'C', tempo: 120, version: '7.0.0' },
  chords: [
    { startMs: 0,    endMs: 2000,  chord: 'C',  confidence: 0.9, rawChord: 'C',  source: 'chroma', lyric: 'Hello' },
    { startMs: 2000, endMs: 4000,  chord: 'Am', confidence: 0.85, rawChord: 'Am', source: 'chroma' },
    { startMs: 4000, endMs: 6000,  chord: 'F',  confidence: 0.8,  rawChord: 'F',  source: 'chroma', lyric: 'World' },
    { startMs: 6000, endMs: 8000,  chord: 'G',  confidence: 0.75, rawChord: 'G',  source: 'chroma' },
  ],
  sections: [
    { type: 'verse',  startTime: 0, endTime: 4, repetitionIndex: 1 },
    { type: 'chorus', startTime: 4, endTime: 8, repetitionIndex: 1 },
  ],
};

// ── Basic output ──────────────────────────────────────────────────────────────
describe('toTxt', () => {
  test('returns a string', () => {
    expect(typeof toTxt(sampleData)).toBe('string');
  });

  test('output is non-empty', () => {
    expect(toTxt(sampleData).trim().length).toBeGreaterThan(0);
  });

  test('includes song title', () => {
    expect(toTxt(sampleData)).toContain('Test Song');
  });

  test('includes artist name', () => {
    expect(toTxt(sampleData)).toContain('Test Artist');
  });

  test('includes chord names', () => {
    const out = toTxt(sampleData);
    expect(out).toContain('C');
    expect(out).toContain('Am');
    expect(out).toContain('F');
    expect(out).toContain('G');
  });

  test('includes timestamps in m:ss format', () => {
    expect(toTxt(sampleData)).toMatch(/\d+:\d{2}/);
  });

  test('includes section type labels', () => {
    const out = toTxt(sampleData);
    expect(out).toMatch(/VERSE/i);
    expect(out).toMatch(/CHORUS/i);
  });

  test('handles empty sections gracefully', () => {
    const noSections = { ...sampleData, sections: [] };
    expect(() => toTxt(noSections)).not.toThrow();
  });

  test('handles missing sections key gracefully', () => {
    const noSections = { meta: sampleData.meta, chords: sampleData.chords };
    expect(() => toTxt(noSections)).not.toThrow();
  });

  test('handles empty chords array', () => {
    const empty = { ...sampleData, chords: [] };
    expect(typeof toTxt(empty)).toBe('string');
  });

  test('formats 61 000 ms as 1:01', () => {
    const data = {
      meta: sampleData.meta,
      chords: [{ startMs: 61_000, endMs: 63_000, chord: 'C', confidence: 0.9, rawChord: 'C', source: 'chroma' }],
      sections: [],
    };
    expect(toTxt(data)).toContain('1:01');
  });
});
