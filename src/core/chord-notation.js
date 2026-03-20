/**
 * @fileoverview Four chord notation systems: standard, Nashville, solfège, Roman numerals.
 * Pure functions — no I/O.
 * @module core/chord-notation
 */

import { NOTES } from './chord-templates.js';

/** @type {Record<string, string[]>} */
const KEY_MAPS = {
  standard: NOTES.slice(),
  nashville: ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'],
  solfege:   ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Ti'],
  roman:     ['I',  'I#',  'II', 'II#', 'III','IV', 'IV#', 'V',  'V#',  'VI', 'VI#', 'VII'],
};

/**
 * Convert a single chord to the target notation, relative to `key`.
 * @param {string} chord    - e.g. "Am", "G7", "Cmaj7"
 * @param {string} notation - 'standard' | 'nashville' | 'solfege' | 'roman'
 * @param {string} [key]    - Detected key root (e.g. "C", "F#"). Default "C".
 * @returns {string}
 */
export function convert(chord, notation, key = 'C') {
  if (!chord || notation === 'standard') { return chord; }
  const m = chord.match(/^([A-G][#b♭]?)(.*)$/);
  if (!m) { return chord; }
  const [, root, suffix] = m;

  const rootIdx = NOTES.indexOf(root.replace(/[b♭]/g, match => {
    const entry = Object.entries({ 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#' })
      .find(([flat]) => flat === root);
    return entry ? entry[1] : match;
  }).replace('b', '').toUpperCase());

  // Normalize root with flats
  const stdRoot = root.toUpperCase().replace(/♯/g, '#');
  const flatToSharp = /** @type {Record<string,string>} */ ({
    'DB':'C#','EB':'D#','GB':'F#','AB':'G#','BB':'A#',
  });
  const normalizedRoot = flatToSharp[stdRoot] ?? stdRoot;
  const rIdx = NOTES.indexOf(normalizedRoot);
  if (rIdx === -1) { return chord; }

  const keyNorm = key.replace(/m$/, '').toUpperCase();
  const kIdx = NOTES.indexOf(keyNorm);
  if (kIdx === -1) { return chord; }

  const relIdx = ((rIdx - kIdx) + 12) % 12;
  const maps = KEY_MAPS[notation];
  if (!maps) { return chord; }

  let notationRoot = maps[relIdx];

  // Roman numerals: lowercase for minor/diminished
  if (notation === 'roman') {
    const isMinor = /^m(?!aj)/i.test(suffix) || /dim|°/i.test(suffix);
    notationRoot = isMinor ? notationRoot.toLowerCase() : notationRoot;
  }

  return notationRoot + suffix;
}

/**
 * Convert an array of chord names.
 * @param {string[]} chords
 * @param {string} notation
 * @param {string} [key]
 * @returns {string[]}
 */
export function convertProgression(chords, notation, key = 'C') {
  return chords.map(c => convert(c, notation, key));
}

/** @returns {string[]} */
export function availableNotations() {
  return ['standard', 'nashville', 'solfege', 'roman'];
}
