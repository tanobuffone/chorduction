/**
 * @jest-environment node
 */
import { toJson } from '../../../src/export/formatters/json-formatter.js';

// toJson output schema: { meta: { ...fields, schemaVersion: '2.0' }, chords, sections, lyrics }

const sampleData = {
  meta: { title: 'JSON Song', artist: 'Artist', key: 'G', tempo: 100, version: '7.0.0' },
  chords: [
    { startMs: 0,    endMs: 2000, chord: 'G',  confidence: 0.9,  rawChord: 'G',  source: 'chroma' },
    { startMs: 2000, endMs: 4000, chord: 'Em', confidence: 0.8,  rawChord: 'Em', source: 'chroma', lyric: 'Line one' },
    { startMs: 4000, endMs: 6000, chord: 'C',  confidence: 0.85, rawChord: 'C',  source: 'chroma' },
    { startMs: 6000, endMs: 8000, chord: 'D',  confidence: 0.7,  rawChord: 'D',  source: 'chroma' },
  ],
  sections: [
    { type: 'verse',  startTime: 0, endTime: 4, repetitionIndex: 1 },
    { type: 'chorus', startTime: 4, endTime: 8, repetitionIndex: 1 },
  ],
  lyrics: [
    { startMs: 2000, text: 'Line one' },
  ],
};

describe('toJson', () => {
  test('returns a string', () => {
    expect(typeof toJson(sampleData)).toBe('string');
  });

  test('is valid JSON', () => {
    expect(() => JSON.parse(toJson(sampleData))).not.toThrow();
  });

  test('schemaVersion is inside meta object', () => {
    const obj = JSON.parse(toJson(sampleData));
    expect(obj.meta.schemaVersion).toBe('2.0');
  });

  test('meta.title and meta.artist are preserved', () => {
    const obj = JSON.parse(toJson(sampleData));
    expect(obj.meta.title).toBe('JSON Song');
    expect(obj.meta.artist).toBe('Artist');
  });

  test('chords array has correct length', () => {
    const obj = JSON.parse(toJson(sampleData));
    expect(Array.isArray(obj.chords)).toBe(true);
    expect(obj.chords).toHaveLength(4);
  });

  test('each chords entry has startMs, chord, confidence', () => {
    const obj = JSON.parse(toJson(sampleData));
    for (const entry of obj.chords) {
      expect(entry).toHaveProperty('startMs');
      expect(entry).toHaveProperty('chord');
      expect(entry).toHaveProperty('confidence');
    }
  });

  test('sections array is present', () => {
    const obj = JSON.parse(toJson(sampleData));
    expect(Array.isArray(obj.sections)).toBe(true);
    expect(obj.sections).toHaveLength(2);
  });

  test('lyrics array is present', () => {
    const obj = JSON.parse(toJson(sampleData));
    expect(Array.isArray(obj.lyrics)).toBe(true);
  });

  test('handles empty chords', () => {
    const empty = { ...sampleData, chords: [] };
    expect(JSON.parse(toJson(empty)).chords).toEqual([]);
  });

  test('handles missing sections', () => {
    const noSections = { meta: sampleData.meta, chords: sampleData.chords };
    const obj = JSON.parse(toJson(noSections));
    expect(Array.isArray(obj.sections)).toBe(true);
    expect(obj.sections).toHaveLength(0);
  });

  test('output is pretty-printed (contains newlines)', () => {
    expect(toJson(sampleData)).toContain('\n');
  });
});
