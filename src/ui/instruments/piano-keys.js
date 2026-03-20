/**
 * @fileoverview Piano keyboard SVG chord diagram (one octave, C4–B4).
 * @module ui/instruments/piano-keys
 */

import { BaseInstrument } from './base-instrument.js';
import { NOTES } from '../../core/chord-templates.js';

// Pitch-class indices for each chord quality
const CHORD_INTERVALS = /** @type {Record<string,number[]>} */ ({
  '':     [0, 4, 7],         // major
  'm':    [0, 3, 7],         // minor
  '7':    [0, 4, 7, 10],     // dominant 7
  'maj7': [0, 4, 7, 11],     // major 7
  'm7':   [0, 3, 7, 10],     // minor 7
  'dim':  [0, 3, 6],
  'aug':  [0, 4, 8],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
});

// White keys C D E F G A B → pitch class indices
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];
// Black key positions (as fraction between two white keys): C# D# F# G# A#
const BLACK_KEY_MAP = /** @type {Record<number,number>} */ ({ 1:0, 3:1, 6:3, 8:4, 10:5 });

export class PianoKeys extends BaseInstrument {
  /** @param {string} chord @returns {number[]|null} chord tone pitch classes */
  getFingering(chord) {
    const m = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!m) { return null; }
    const [, root, suffix] = m;
    const rootIdx = NOTES.indexOf(root.replace('b', '').replace(/[♭♯]/g, ''));
    if (rootIdx === -1) { return null; }
    const intervals = CHORD_INTERVALS[suffix] ?? CHORD_INTERVALS[''];
    return intervals.map(i => (rootIdx + i) % 12);
  }

  _renderDiagram(chord, notes) {
    const W = 140, H = 70;
    const svg = this._svg(W, H, `${chord} piano chord`);

    const KEY_W = 16, KEY_H = 44;
    const BK_W = 10, BK_H = 28;
    const x0 = 8;

    // White keys
    WHITE_KEYS.forEach((pc, i) => {
      const rect = this._el('rect');
      const x = x0 + i * KEY_W;
      rect.setAttribute('x', String(x)); rect.setAttribute('y', '10');
      rect.setAttribute('width', String(KEY_W - 1)); rect.setAttribute('height', String(KEY_H));
      rect.setAttribute('fill', notes.includes(pc) ? '#1db954' : '#eee');
      rect.setAttribute('stroke', '#555'); rect.setAttribute('stroke-width', '0.5');
      svg.appendChild(rect);
    });

    // Black keys
    for (const [pcStr, wIdx] of Object.entries(BLACK_KEY_MAP)) {
      const pc = parseInt(pcStr);
      const rect = this._el('rect');
      const x = x0 + wIdx * KEY_W + KEY_W - BK_W / 2;
      rect.setAttribute('x', String(x)); rect.setAttribute('y', '10');
      rect.setAttribute('width', String(BK_W)); rect.setAttribute('height', String(BK_H));
      rect.setAttribute('fill', notes.includes(pc) ? '#1db954' : '#222');
      rect.setAttribute('stroke', 'none');
      svg.appendChild(rect);
    }

    // Chord label
    const label = this._el('text');
    label.setAttribute('x', String(W / 2)); label.setAttribute('y', String(H - 4));
    label.setAttribute('font-size', '11'); label.setAttribute('fill', '#888'); label.setAttribute('text-anchor', 'middle');
    label.textContent = chord;
    svg.appendChild(label);

    return svg;
  }
}
