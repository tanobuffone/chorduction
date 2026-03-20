/**
 * @fileoverview Chord template vectors and note/key constants.
 * All data is pure — no imports, no I/O.
 * @module core/chord-templates
 */

/** Chromatic note names (sharps). Index = pitch class. */
export const NOTES = /** @type {const} */ (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']);

/** Enharmonic flat equivalents for display purposes. */
export const FLAT_MAP = /** @type {Record<string,string>} */ ({
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
});

/**
 * Build all chord template vectors.
 * Each template is a 12-element binary array indicating active pitch classes.
 * @returns {Record<string, number[]>}
 */
export function buildChordTemplates() {
  const templates = /** @type {Record<string, number[]>} */ ({});

  const qualities = [
    { suffix: '',      offsets: [0, 4, 7]        },  // major
    { suffix: 'm',     offsets: [0, 3, 7]        },  // minor
    { suffix: '7',     offsets: [0, 4, 7, 10]    },  // dominant 7
    { suffix: 'maj7',  offsets: [0, 4, 7, 11]    },  // major 7
    { suffix: 'm7',    offsets: [0, 3, 7, 10]    },  // minor 7
    { suffix: 'dim',   offsets: [0, 3, 6]        },  // diminished
    { suffix: 'aug',   offsets: [0, 4, 8]        },  // augmented
    { suffix: 'sus2',  offsets: [0, 2, 7]        },  // suspended 2
    { suffix: 'sus4',  offsets: [0, 5, 7]        },  // suspended 4
    { suffix: 'dim7',  offsets: [0, 3, 6, 9]     },  // diminished 7
    { suffix: 'm7b5',  offsets: [0, 3, 6, 10]    },  // half-diminished
    { suffix: '9',     offsets: [0, 4, 7, 10, 2] },  // dominant 9
  ];

  for (let root = 0; root < 12; root++) {
    const note = NOTES[root];
    for (const { suffix, offsets } of qualities) {
      const chroma = new Array(12).fill(0);
      for (const off of offsets) { chroma[(root + off) % 12] = 1; }
      const key = note + suffix;
      templates[key] = chroma;
    }
    // Aliases
    templates[`${note}maj`] = templates[`${note}`];
    templates[`${note}min`] = templates[`${note}m`];
    templates[`${note}°`]   = templates[`${note}dim`];
    templates[`${note}+`]   = templates[`${note}aug`];
  }

  return templates;
}

/**
 * Krumhansl-Schmuckler key profiles (1990).
 * major[i] = weight for scale degree i (in C major, C=0).
 */
export const KEY_PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};
