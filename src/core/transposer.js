/**
 * @fileoverview Pitch transposition — pure functions, no side effects.
 * @module core/transposer
 */

import { NOTES, FLAT_MAP } from './chord-templates.js';

/**
 * Get the chromatic index (0–11) of a note name.
 * Handles sharps (#/♯) and flats (b/♭).
 * @param {string} note
 * @returns {number} -1 if unrecognized
 */
export function noteToIndex(note) {
  const normalized = note.toUpperCase()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
  // Convert flat to sharp for lookup
  const sharpEquiv = Object.entries(FLAT_MAP).find(([, flat]) => flat.toUpperCase() === normalized)?.[0];
  return NOTES.indexOf(sharpEquiv ?? normalized);
}

/**
 * Transpose a single note name by `semitones`.
 * Preserves flat notation if the input used flats.
 * @param {string} note
 * @param {number} semitones
 * @returns {string}
 */
export function transposeNote(note, semitones) {
  if (semitones === 0) { return note; }
  const usesFlat = /[b♭]/.test(note.slice(1));
  const idx = noteToIndex(note);
  if (idx === -1) { return note; }
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  const newNote = NOTES[newIdx];
  return usesFlat ? (FLAT_MAP[newNote] ?? newNote) : newNote;
}

/**
 * Transpose a chord name by `semitones`.
 * Preserves the chord suffix (quality, extensions) unchanged.
 * @param {string} chord
 * @param {number} semitones
 * @returns {string}
 */
export function transpose(chord, semitones) {
  if (!chord || semitones === 0) { return chord; }
  const m = chord.match(/^([A-G][#b♯♭]?)(.*)$/);
  if (!m) { return chord; }
  const [, root, suffix] = m;
  return transposeNote(root, semitones) + suffix;
}

/**
 * Transpose an entire chord progression.
 * @param {string[]} chords
 * @param {number} semitones
 * @returns {string[]}
 */
export function transposeProgression(chords, semitones) {
  return chords.map(c => transpose(c, semitones));
}

/**
 * Clamp a transpose value to ±maxSemitones.
 * @param {number} value
 * @param {number} [max]
 * @returns {number}
 */
export function clampTranspose(value, max = 6) {
  return Math.max(-max, Math.min(max, value));
}
