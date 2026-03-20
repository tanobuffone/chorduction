/**
 * @fileoverview Ukulele chord diagram (4 strings: G C E A).
 * @module ui/instruments/ukulele-fretboard
 */

import { BaseInstrument } from './base-instrument.js';

// [G C E A] — string index 0 = G (4th), 3 = A (1st)
// -1 = muted (rare on uke), 0 = open, N = fret N
const FINGERINGS = /** @type {Record<string,{frets:number[],baseFret:number}>} */ ({
  'C':    { frets:[0,0,0,3], baseFret:1 }, 'Cm':   { frets:[0,3,3,3], baseFret:1 },
  'C7':   { frets:[0,0,0,1], baseFret:1 }, 'Cmaj7':{ frets:[0,0,0,2], baseFret:1 },
  'C#':   { frets:[1,1,1,4], baseFret:1 }, 'C#m':  { frets:[1,4,4,4], baseFret:1 },
  'D':    { frets:[2,2,2,0], baseFret:1 }, 'Dm':   { frets:[2,2,1,0], baseFret:1 },
  'D7':   { frets:[2,2,2,3], baseFret:1 }, 'Dmaj7':{ frets:[2,2,2,4], baseFret:1 },
  'D#':   { frets:[3,3,3,1], baseFret:1 },
  'E':    { frets:[4,4,4,2], baseFret:1 }, 'Em':   { frets:[0,4,3,2], baseFret:1 },
  'E7':   { frets:[1,2,0,2], baseFret:1 },
  'F':    { frets:[2,0,1,0], baseFret:1 }, 'Fm':   { frets:[1,0,1,3], baseFret:1 },
  'F7':   { frets:[2,3,1,3], baseFret:1 },
  'F#':   { frets:[3,1,2,1], baseFret:1 }, 'F#m':  { frets:[2,1,2,0], baseFret:1 },
  'G':    { frets:[0,2,3,2], baseFret:1 }, 'Gm':   { frets:[0,2,3,1], baseFret:1 },
  'G7':   { frets:[0,2,1,2], baseFret:1 }, 'Gmaj7':{ frets:[0,2,2,2], baseFret:1 },
  'G#':   { frets:[1,3,4,3], baseFret:1 },
  'A':    { frets:[2,1,0,0], baseFret:1 }, 'Am':   { frets:[2,0,0,0], baseFret:1 },
  'A7':   { frets:[0,1,0,0], baseFret:1 }, 'Amaj7':{ frets:[1,1,0,0], baseFret:1 },
  'A#':   { frets:[3,2,1,1], baseFret:1 },
  'B':    { frets:[4,3,2,2], baseFret:1 }, 'Bm':   { frets:[4,2,2,2], baseFret:1 },
  'B7':   { frets:[2,3,2,2], baseFret:1 },
});

export class UkuleleFretboard extends BaseInstrument {
  getFingering(chord) { return FINGERINGS[chord] ?? null; }

  _renderDiagram(chord, fingering) {
    const W = 90, H = 110;
    const svg = this._svg(W, H, `${chord} ukulele chord`);
    const { frets, baseFret } = fingering;
    const STRINGS = 4, FRETS = 5;
    const x0 = 16, y0 = 18, xs = 20, ys = 16;

    for (let f = 0; f <= FRETS; f++) {
      const l = this._el('line');
      l.setAttribute('x1', String(x0)); l.setAttribute('y1', String(y0 + f * ys));
      l.setAttribute('x2', String(x0 + (STRINGS - 1) * xs)); l.setAttribute('y2', String(y0 + f * ys));
      l.setAttribute('stroke', f === 0 ? '#ccc' : '#555'); l.setAttribute('stroke-width', f === 0 ? '3' : '1');
      svg.appendChild(l);
    }
    for (let s = 0; s < STRINGS; s++) {
      const x = x0 + s * xs, l = this._el('line');
      l.setAttribute('x1', String(x)); l.setAttribute('y1', String(y0));
      l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y0 + FRETS * ys));
      l.setAttribute('stroke', '#555'); l.setAttribute('stroke-width', '1');
      svg.appendChild(l);
    }
    if (baseFret > 1) {
      const t = this._el('text');
      t.setAttribute('x', '4'); t.setAttribute('y', String(y0 + ys + 4));
      t.setAttribute('font-size', '9'); t.setAttribute('fill', '#888'); t.setAttribute('text-anchor', 'middle');
      t.textContent = String(baseFret); svg.appendChild(t);
    }
    const label = this._el('text');
    label.setAttribute('x', String(W / 2)); label.setAttribute('y', String(H - 4));
    label.setAttribute('font-size', '11'); label.setAttribute('fill', '#888'); label.setAttribute('text-anchor', 'middle');
    label.textContent = chord; svg.appendChild(label);

    frets.forEach((fret, s) => {
      const x = x0 + s * xs;
      if (fret === 0) {
        const c = this._el('circle');
        c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y0 - 7));
        c.setAttribute('r', '4'); c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#888'); c.setAttribute('stroke-width', '1.5');
        svg.appendChild(c);
      } else {
        const c = this._el('circle');
        c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y0 + (fret - baseFret) * ys + ys / 2));
        c.setAttribute('r', '6'); c.setAttribute('fill', '#1db954'); svg.appendChild(c);
      }
    });
    return svg;
  }
}
