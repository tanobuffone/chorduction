/**
 * @fileoverview Guitar fretboard SVG chord diagram.
 * @module ui/instruments/guitar-fretboard
 */

import { BaseInstrument } from './base-instrument.js';

// [e B G D A E] — string index 0 = high-e, 5 = low-E
// Values: -1 = muted, 0 = open, N = fret N
// baseFret: the fret number shown at the top of the diagram
const FINGERINGS = /** @type {Record<string,{frets:number[], baseFret:number}>} */ ({
  'C':    { frets: [0,1,0,2,3,2], baseFret:1 }, 'Cm':   { frets: [3,4,5,5,3,3], baseFret:3 },
  'C7':   { frets: [0,1,3,2,3,2], baseFret:1 }, 'Cmaj7':{ frets: [0,0,0,2,3,2], baseFret:1 },
  'Cm7':  { frets: [3,4,3,5,3,3], baseFret:3 },
  'C#':   { frets: [4,6,5,4,4,4], baseFret:4 }, 'C#m':  { frets: [4,5,6,6,4,4], baseFret:4 },
  'D':    { frets: [2,3,2,0,-1,-1], baseFret:1 }, 'Dm': { frets: [1,3,2,0,-1,-1], baseFret:1 },
  'D7':   { frets: [2,1,2,0,-1,-1], baseFret:1 }, 'Dmaj7':{ frets: [2,2,2,0,-1,-1], baseFret:1 },
  'D#':   { frets: [3,4,3,1,-1,-1], baseFret:1 },
  'E':    { frets: [0,0,1,2,2,0], baseFret:1 }, 'Em':  { frets: [0,0,0,2,2,0], baseFret:1 },
  'E7':   { frets: [0,3,1,2,2,0], baseFret:1 }, 'Emaj7':{ frets: [0,0,1,1,2,0], baseFret:1 },
  'F':    { frets: [1,1,2,3,3,1], baseFret:1 }, 'Fm':  { frets: [1,1,1,3,3,1], baseFret:1 },
  'F7':   { frets: [1,1,2,1,3,1], baseFret:1 },
  'F#':   { frets: [2,2,3,4,4,2], baseFret:2 }, 'F#m': { frets: [2,2,2,4,4,2], baseFret:2 },
  'G':    { frets: [3,0,0,0,2,3], baseFret:1 }, 'Gm':  { frets: [3,3,3,5,5,3], baseFret:3 },
  'G7':   { frets: [1,0,0,0,2,3], baseFret:1 }, 'Gmaj7':{ frets: [2,0,0,0,2,3], baseFret:1 },
  'G#':   { frets: [4,4,5,6,6,4], baseFret:4 },
  'A':    { frets: [0,2,2,2,0,-1], baseFret:1 }, 'Am': { frets: [0,1,2,2,0,-1], baseFret:1 },
  'A7':   { frets: [0,2,0,2,0,-1], baseFret:1 }, 'Amaj7':{ frets: [0,2,1,2,0,-1], baseFret:1 },
  'A#':   { frets: [1,3,3,3,1,1], baseFret:1 },
  'B':    { frets: [2,4,4,4,2,2], baseFret:2 }, 'Bm':  { frets: [2,3,4,4,2,2], baseFret:2 },
  'B7':   { frets: [2,0,2,1,2,2], baseFret:1 },
});

export class GuitarFretboard extends BaseInstrument {
  /** @param {string} chord @returns {{frets:number[],baseFret:number}|null} */
  getFingering(chord) {
    return FINGERINGS[chord] ?? FINGERINGS[chord.replace(/maj$/, '')] ?? null;
  }

  /**
   * @param {string} chord
   * @param {{frets:number[], baseFret:number}} fingering
   * @returns {SVGSVGElement}
   */
  _renderDiagram(chord, fingering) {
    const W = 120, H = 110;
    const svg = this._svg(W, H, `${chord} guitar chord`);
    const { frets, baseFret } = fingering;
    const STRINGS = 6, FRETS = 5;
    const x0 = 16, y0 = 18, xs = 18, ys = 16;

    // Fret lines
    for (let f = 0; f <= FRETS; f++) {
      const l = this._el('line');
      const y = y0 + f * ys;
      Object.assign(l, {}); l.setAttribute('x1', String(x0)); l.setAttribute('y1', String(y));
      l.setAttribute('x2', String(x0 + (STRINGS - 1) * xs)); l.setAttribute('y2', String(y));
      l.setAttribute('stroke', f === 0 ? '#ccc' : '#555'); l.setAttribute('stroke-width', f === 0 ? '3' : '1');
      svg.appendChild(l);
    }
    // String lines
    for (let s = 0; s < STRINGS; s++) {
      const x = x0 + s * xs;
      const l = this._el('line');
      l.setAttribute('x1', String(x)); l.setAttribute('y1', String(y0));
      l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y0 + FRETS * ys));
      l.setAttribute('stroke', '#555'); l.setAttribute('stroke-width', '1');
      svg.appendChild(l);
    }
    // Fret number label
    if (baseFret > 1) {
      const txt = this._el('text');
      txt.setAttribute('x', '4'); txt.setAttribute('y', String(y0 + ys + 4));
      txt.setAttribute('font-size', '9'); txt.setAttribute('fill', '#888'); txt.setAttribute('text-anchor', 'middle');
      txt.textContent = String(baseFret);
      svg.appendChild(txt);
    }
    // Chord name
    const label = this._el('text');
    label.setAttribute('x', String(W / 2)); label.setAttribute('y', String(H - 4));
    label.setAttribute('font-size', '11'); label.setAttribute('fill', '#888'); label.setAttribute('text-anchor', 'middle');
    label.textContent = chord;
    svg.appendChild(label);

    // Dots
    frets.forEach((fret, s) => {
      const x = x0 + s * xs;
      if (fret === -1) {
        const t = this._el('text');
        t.setAttribute('x', String(x)); t.setAttribute('y', String(y0 - 6));
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#666'); t.setAttribute('font-size', '10');
        t.textContent = '✕'; svg.appendChild(t);
      } else if (fret === 0) {
        const c = this._el('circle');
        c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y0 - 7));
        c.setAttribute('r', '4'); c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#888'); c.setAttribute('stroke-width', '1.5');
        svg.appendChild(c);
      } else {
        const c = this._el('circle');
        const y = y0 + (fret - baseFret) * ys + ys / 2;
        c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y));
        c.setAttribute('r', '6'); c.setAttribute('fill', '#1db954');
        svg.appendChild(c);
      }
    });

    return svg;
  }
}
