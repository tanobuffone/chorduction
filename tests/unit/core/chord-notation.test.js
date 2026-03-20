/**
 * @jest-environment node
 */
import { convert, convertProgression, availableNotations } from '../../../src/core/chord-notation.js';

// ── availableNotations ────────────────────────────────────────────────────────
describe('availableNotations', () => {
  test('returns an array', () => {
    expect(Array.isArray(availableNotations())).toBe(true);
  });

  test('includes standard notation', () => {
    expect(availableNotations()).toContain('standard');
  });

  test('includes at least 3 notation systems', () => {
    expect(availableNotations().length).toBeGreaterThanOrEqual(3);
  });
});

// ── convert — standard notation (no-op) ──────────────────────────────────────
describe('convert — standard', () => {
  const chords = ['C', 'Am', 'F', 'G', 'Dm7', 'Cmaj7', 'Bb', 'Eb', 'F#m'];

  test.each(chords)('standard(%s) returns unchanged', chord => {
    expect(convert(chord, 'standard')).toBe(chord);
  });
});

// ── convert — Nashville notation ──────────────────────────────────────────────
describe('convert — Nashville (key=C)', () => {
  test('C → 1',  () => expect(convert('C',  'nashville', 'C')).toBe('1'));
  test('F → 4',  () => expect(convert('F',  'nashville', 'C')).toBe('4'));
  test('G → 5',  () => expect(convert('G',  'nashville', 'C')).toBe('5'));
  test('Am → 6m', () => expect(convert('Am', 'nashville', 'C')).toBe('6m'));
  test('Dm → 2m', () => expect(convert('Dm', 'nashville', 'C')).toBe('2m'));
  test('Em → 3m', () => expect(convert('Em', 'nashville', 'C')).toBe('3m'));

  test('G in key of G → 1', () => expect(convert('G', 'nashville', 'G')).toBe('1'));
  test('C in key of G → 4', () => expect(convert('C', 'nashville', 'G')).toBe('4'));
  test('D in key of G → 5', () => expect(convert('D', 'nashville', 'G')).toBe('5'));
});

// ── convert — Roman numeral notation ─────────────────────────────────────────
describe('convert — Roman numeral (key=C)', () => {
  test('C → I',   () => expect(convert('C',  'roman', 'C')).toBe('I'));
  test('F → IV',  () => expect(convert('F',  'roman', 'C')).toBe('IV'));
  test('G → V',   () => expect(convert('G',  'roman', 'C')).toBe('V'));
  test('Am → vim', () => expect(convert('Am', 'roman', 'C')).toBe('vim'));
  test('Dm → iim', () => expect(convert('Dm', 'roman', 'C')).toBe('iim'));
});

// ── convert — Solfège ─────────────────────────────────────────────────────────
describe('convert — solfege', () => {
  test('C → Do',  () => expect(convert('C', 'solfege')).toMatch(/^Do/i));
  test('D → Re',  () => expect(convert('D', 'solfege')).toMatch(/^Re/i));
  test('E → Mi',  () => expect(convert('E', 'solfege')).toMatch(/^Mi/i));
  test('F → Fa',  () => expect(convert('F', 'solfege')).toMatch(/^Fa/i));
  test('G → Sol', () => expect(convert('G', 'solfege')).toMatch(/^Sol/i));
  test('A → La',  () => expect(convert('A', 'solfege')).toMatch(/^La/i));
  test('B → Ti',  () => expect(convert('B', 'solfege')).toMatch(/^Ti/i));
});

// ── convert — unknown notation falls back ────────────────────────────────────
describe('convert — fallback', () => {
  test('unknown notation returns original chord', () => {
    expect(convert('C', 'INVALID')).toBe('C');
  });

  test('empty chord string returns empty or does not throw', () => {
    expect(() => convert('', 'standard')).not.toThrow();
  });
});

// ── convertProgression — operates on string[] ─────────────────────────────────
describe('convertProgression', () => {
  const progression = ['C', 'Am', 'F', 'G'];

  test('converts all chords in Nashville (key=C)', () => {
    const result = convertProgression(progression, 'nashville', 'C');
    expect(result[0]).toBe('1');
    expect(result[1]).toBe('6m');
    expect(result[2]).toBe('4');
    expect(result[3]).toBe('5');
  });

  test('returns array of same length', () => {
    expect(convertProgression(progression, 'roman', 'C')).toHaveLength(4);
  });

  test('does not mutate original', () => {
    const copy = [...progression];
    convertProgression(progression, 'nashville', 'C');
    expect(progression).toEqual(copy);
  });

  test('handles empty array', () => {
    expect(convertProgression([], 'roman', 'C')).toEqual([]);
  });

  test('standard notation returns same strings', () => {
    expect(convertProgression(progression, 'standard', 'C')).toEqual(progression);
  });
});
