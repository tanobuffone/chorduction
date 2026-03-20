/**
 * @jest-environment node
 */
import { toChordPro } from '../../../src/export/formatters/chordpro-formatter.js';

// chordpro-formatter uses:
//   data.chords (ChordResult[]) — for chord markers [X]
//   data.lyrics (LyricsLine[])  — for lyric lines (required for section markers)
//   data.sections (SectionLabel[]) — type/startTime/endTime/repetitionIndex
//
// Section markers: {start_of_chorus}/{end_of_chorus} for chorus sections
//   Other sections emit {comment: SectionName}
// Without lyrics, just chord brackets are output

const sampleChords = [
  { startMs: 0,     endMs: 2000,  chord: 'D',  confidence: 0.9, rawChord: 'D',  source: 'chroma' },
  { startMs: 2000,  endMs: 4000,  chord: 'Bm', confidence: 0.8, rawChord: 'Bm', source: 'chroma' },
  { startMs: 4000,  endMs: 6000,  chord: 'G',  confidence: 0.85, rawChord: 'G',  source: 'chroma' },
  { startMs: 6000,  endMs: 8000,  chord: 'A',  confidence: 0.7,  rawChord: 'A',  source: 'chroma' },
  { startMs: 8000,  endMs: 10000, chord: 'D',  confidence: 0.9,  rawChord: 'D',  source: 'chroma' },
  { startMs: 10000, endMs: 12000, chord: 'G',  confidence: 0.8,  rawChord: 'G',  source: 'chroma' },
];

const sampleLyrics = [
  { startMs: 0,    text: 'First line here' },
  { startMs: 2000, text: 'Second line here' },
  { startMs: 4000, text: 'Third line here' },
  { startMs: 6000, text: 'Fourth line here' },
  { startMs: 8000, text: 'Chorus starts' },
  { startMs: 10000, text: 'Chorus second' },
];

const sampleSections = [
  { type: 'verse',  startTime: 0, endTime: 8,  repetitionIndex: 1 },
  { type: 'chorus', startTime: 8, endTime: 16, repetitionIndex: 1 },
];

const sampleMeta = { title: 'ChordPro Song', artist: 'Band', key: 'D', tempo: 90, version: '7.0.0' };

const fullData = {
  meta:     sampleMeta,
  chords:   sampleChords,
  sections: sampleSections,
  lyrics:   sampleLyrics,
};

describe('toChordPro', () => {
  test('returns a string', () => {
    expect(typeof toChordPro(fullData)).toBe('string');
  });

  test('output is non-empty', () => {
    expect(toChordPro(fullData).trim().length).toBeGreaterThan(0);
  });

  test('includes {title:} directive with song title', () => {
    const out = toChordPro(fullData);
    expect(out).toMatch(/\{title:/);
    expect(out).toContain('ChordPro Song');
  });

  test('includes {artist:} directive', () => {
    expect(toChordPro(fullData)).toMatch(/\{artist:/);
  });

  test('includes {key:} directive', () => {
    expect(toChordPro(fullData)).toMatch(/\{key:/);
  });

  test('chorus section has {start_of_chorus} and {end_of_chorus}', () => {
    const out = toChordPro(fullData);
    expect(out).toContain('{start_of_chorus}');
    expect(out).toContain('{end_of_chorus}');
  });

  test('chord brackets appear in output', () => {
    const out = toChordPro(fullData);
    expect(out).toMatch(/\[D\]|\[G\]|\[A\]|\[Bm\]/);
  });

  test('lyric text appears inline', () => {
    expect(toChordPro(fullData)).toContain('Chorus starts');
  });

  test('no lyrics → just chord brackets per line', () => {
    const noLyrics = { meta: sampleMeta, chords: sampleChords, sections: [], lyrics: [] };
    const out = toChordPro(noLyrics);
    expect(out).toMatch(/\[D\]/);
    // Without lyrics, no section markers should appear
    expect(out).not.toContain('{start_of_chorus}');
  });

  test('empty chords does not throw', () => {
    const empty = { ...fullData, chords: [], lyrics: [] };
    expect(() => toChordPro(empty)).not.toThrow();
  });

  test('complex chord names preserved', () => {
    const complex = {
      meta: sampleMeta,
      chords: [
        { startMs: 0,    endMs: 2000, chord: 'Cmaj7',  confidence: 0.8, rawChord: 'Cmaj7',  source: 'chroma' },
        { startMs: 2000, endMs: 4000, chord: 'Bm7b5',  confidence: 0.75, rawChord: 'Bm7b5', source: 'chroma' },
      ],
      sections: [],
      lyrics:   [],
    };
    const out = toChordPro(complex);
    expect(out).toContain('[Cmaj7]');
    expect(out).toContain('[Bm7b5]');
  });
});
