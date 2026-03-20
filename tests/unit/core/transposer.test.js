/**
 * @jest-environment node
 */
import {
  noteToIndex,
  transposeNote,
  transpose,
  transposeProgression,
  clampTranspose,
} from '../../../src/core/transposer.js';

// ── noteToIndex ───────────────────────────────────────────────────────────────
describe('noteToIndex', () => {
  const cases = [
    ['C', 0], ['C#', 1], ['Db', 1], ['D', 2], ['D#', 3], ['Eb', 3],
    ['E', 4], ['F', 5], ['F#', 6], ['Gb', 6], ['G', 7], ['G#', 8],
    ['Ab', 8], ['A', 9], ['A#', 10], ['Bb', 10], ['B', 11],
  ];

  test.each(cases)('noteToIndex(%s) === %i', (note, expected) => {
    expect(noteToIndex(note)).toBe(expected);
  });

  test('returns -1 for unknown note', () => {
    expect(noteToIndex('X')).toBe(-1);
  });
});

// ── transposeNote ─────────────────────────────────────────────────────────────
describe('transposeNote', () => {
  test('C + 0 = C', () => expect(transposeNote('C', 0)).toBe('C'));
  test('C + 12 = C', () => expect(transposeNote('C', 12)).toBe('C'));
  test('C + -1 = B', () => expect(transposeNote('C', -1)).toBe('B'));
  test('G + 5 = C', () => expect(transposeNote('G', 5)).toBe('C'));
  test('A + 3 = C', () => expect(transposeNote('A', 3)).toBe('C'));

  test('C + 1 is C# or Db', () => {
    expect(['C#', 'Db']).toContain(transposeNote('C', 1));
  });

  test('handles negative semitones', () => {
    expect(transposeNote('C', -12)).toBe('C');
    expect(transposeNote('E', -2)).toBe('D');
  });
});

// ── transpose (full chord) ────────────────────────────────────────────────────
describe('transpose', () => {
  test('transposes C major by 7 → G', () => {
    expect(transpose('C', 7)).toBe('G');
  });

  test('preserves minor suffix', () => {
    expect(transpose('Am', 3)).toBe('Cm');
  });

  test('preserves maj7 suffix', () => {
    expect(transpose('Cmaj7', 4)).toMatch(/^Emaj7$/);
  });

  test('0 semitones = no change', () => {
    const chords = ['C', 'Am', 'F', 'G7', 'Dm7', 'Bb', 'Ebmaj7'];
    for (const chord of chords) {
      expect(transpose(chord, 0)).toBe(chord);
    }
  });

  test('+12 = octave wrap (no-op)', () => {
    expect(transpose('D', 12)).toBe('D');
    expect(transpose('Bm', 12)).toBe('Bm');
  });

  test('handles slash chords', () => {
    const result = transpose('G/B', 2);
    expect(result).toMatch(/^A/);
    expect(result).toContain('/');
  });

  test('negative semitones', () => {
    expect(transpose('G', -7)).toBe('C');
  });

  test('null/empty returns unchanged', () => {
    expect(transpose('', 5)).toBe('');
    expect(transpose(null, 5)).toBe(null);
  });
});

// ── transposeProgression ──────────────────────────────────────────────────────
describe('transposeProgression', () => {
  const chords = ['C', 'Am', 'F', 'G'];

  test('transposes all chords by 7', () => {
    const result = transposeProgression(chords, 7);
    expect(result[0]).toBe('G');
    expect(result[1]).toBe('Em');
    expect(result[2]).toBe('C');
    expect(result[3]).toBe('D');
  });

  test('by 0 returns identical array', () => {
    const result = transposeProgression(chords, 0);
    expect(result).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('does not mutate the original array', () => {
    const original = [...chords];
    transposeProgression(chords, 3);
    expect(chords).toEqual(original);
  });

  test('handles empty array', () => {
    expect(transposeProgression([], 5)).toEqual([]);
  });

  test('+12 and -12 cancel out', () => {
    const up   = transposeProgression(chords, 12);
    const down = transposeProgression(up, -12);
    expect(down).toEqual(chords);
  });
});

// ── clampTranspose ────────────────────────────────────────────────────────────
describe('clampTranspose', () => {
  test('0 stays 0',   () => expect(clampTranspose(0)).toBe(0));
  test('6 stays 6',   () => expect(clampTranspose(6)).toBe(6));
  test('-6 stays -6', () => expect(clampTranspose(-6)).toBe(-6));
  test('12 → 6',      () => expect(clampTranspose(12)).toBe(6));
  test('-12 → -6',    () => expect(clampTranspose(-12)).toBe(-6));
  test('100 → 6',     () => expect(clampTranspose(100)).toBe(6));
  test('-100 → -6',   () => expect(clampTranspose(-100)).toBe(-6));
});
