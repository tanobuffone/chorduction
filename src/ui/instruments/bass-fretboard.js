/**
 * @fileoverview Bass guitar fretboard — shows root note position on E and A strings.
 * @module ui/instruments/bass-fretboard
 */

import { BaseInstrument } from './base-instrument.js';
import { NOTES } from '../../core/chord-templates.js';

// Root positions on bass: lowest comfortable fret on each string
// [string: 'E'|'A', fret: 0-12]
const ROOT_POSITIONS = /** @type {Record<string,{string:'E'|'A', fret:number}>} */ ({
  'E':  { string:'E', fret:0  }, 'F':  { string:'E', fret:1  },
  'F#': { string:'E', fret:2  }, 'G':  { string:'E', fret:3  },
  'G#': { string:'E', fret:4  }, 'A':  { string:'A', fret:0  },
  'A#': { string:'A', fret:1  }, 'B':  { string:'A', fret:2  },
  'C':  { string:'A', fret:3  }, 'C#': { string:'A', fret:4  },
  'D':  { string:'A', fret:5  }, 'D#': { string:'A', fret:6  },
});

export class BassFretboard extends BaseInstrument {
  /** @param {string} chord @returns {{string:'E'|'A', fret:number, root:string}|null} */
  getFingering(chord) {
    const m = chord.match(/^([A-G][#b]?)/);
    if (!m) { return null; }
    const root = m[1].replace('b', () => {
      const enharmonic = /** @type {Record<string,string>} */ ({ 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#' });
      return '';
    });
    const normalized = chord.match(/^([A-G][#b]?)/)?.[1] ?? '';
    const sharp = (() => {
      const flats = /** @type {Record<string,string>} */ ({ 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#' });
      return flats[normalized] ?? normalized;
    })();
    const pos = ROOT_POSITIONS[sharp] ?? ROOT_POSITIONS[normalized];
    if (!pos) { return null; }
    return { ...pos, root: normalized };
  }

  _renderDiagram(chord, fingering) {
    const W = 120, H = 80;
    const svg = this._svg(W, H, `${chord} bass root position`);
    const { string: str, fret, root } = fingering;

    const STRINGS = 4, FRETS = 5;
    const x0 = 18, y0 = 10, xs = 20, ys = 14;
    const stringLabels = ['G','D','A','E'];

    // Frets
    for (let f = 0; f <= FRETS; f++) {
      const l = this._el('line');
      l.setAttribute('x1', String(x0)); l.setAttribute('y1', String(y0 + f * ys));
      l.setAttribute('x2', String(x0 + (STRINGS - 1) * xs)); l.setAttribute('y2', String(y0 + f * ys));
      l.setAttribute('stroke', f === 0 ? '#ccc' : '#555'); l.setAttribute('stroke-width', f === 0 ? '2.5' : '1');
      svg.appendChild(l);
    }
    // Strings + labels
    for (let s = 0; s < STRINGS; s++) {
      const x = x0 + s * xs;
      const l = this._el('line');
      l.setAttribute('x1', String(x)); l.setAttribute('y1', String(y0));
      l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y0 + FRETS * ys));
      l.setAttribute('stroke', '#555'); l.setAttribute('stroke-width', '1');
      svg.appendChild(l);
      const t = this._el('text');
      t.setAttribute('x', String(x)); t.setAttribute('y', String(y0 + FRETS * ys + 12));
      t.setAttribute('font-size', '9'); t.setAttribute('fill', '#888'); t.setAttribute('text-anchor', 'middle');
      t.textContent = stringLabels[s]; svg.appendChild(t);
    }

    // Root dot
    const strIdx = stringLabels.indexOf(str === 'E' ? 'E' : 'A');
    if (strIdx !== -1 && fret >= 0) {
      const cx = x0 + strIdx * xs;
      const cy = fret === 0 ? y0 - 8 : y0 + (fret - 0.5) * ys;
      const c = this._el('circle');
      c.setAttribute('cx', String(cx)); c.setAttribute('cy', String(cy));
      c.setAttribute('r', fret === 0 ? '5' : '7'); c.setAttribute('fill', '#1db954');
      svg.appendChild(c);
      const rt = this._el('text');
      rt.setAttribute('x', String(cx)); rt.setAttribute('y', String(cy + 4));
      rt.setAttribute('font-size', '8'); rt.setAttribute('fill', '#000'); rt.setAttribute('text-anchor', 'middle');
      rt.textContent = root; svg.appendChild(rt);
    }

    // Chord label
    const label = this._el('text');
    label.setAttribute('x', String(W / 2)); label.setAttribute('y', String(H - 1));
    label.setAttribute('font-size', '11'); label.setAttribute('fill', '#888'); label.setAttribute('text-anchor', 'middle');
    label.textContent = chord; svg.appendChild(label);

    return svg;
  }
}
