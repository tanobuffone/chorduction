/**
 * @fileoverview Abstract base class for instrument chord diagrams.
 * @module ui/instruments/base-instrument
 */

export class BaseInstrument {
  /**
   * Render an SVG chord diagram for `chord`. Returns null if unknown.
   * @param {string} chord
   * @returns {HTMLElement|null}
   */
  render(chord) {
    const fingering = this.getFingering(chord);
    if (!fingering) { return this._renderUnknown(chord); }
    return this._renderDiagram(chord, fingering);
  }

  /** @param {string} _chord @returns {any|null} */
  getFingering(_chord) { return null; }

  /** @param {string} _chord @param {any} _fingering @returns {HTMLElement} */
  _renderDiagram(_chord, _fingering) { return document.createElement('div'); }

  /** @param {string} chord @returns {HTMLElement|null} */
  _renderUnknown(_chord) { return null; }

  /**
   * Helper: create an SVG element.
   * @param {number} w @param {number} h @param {string} [title]
   * @returns {SVGSVGElement}
   */
  _svg(w, h, title = '') {
    const svg = /** @type {SVGSVGElement} */ (document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.cssText = `width:100%;max-width:${w}px;height:auto;display:block`;
    if (title) { svg.setAttribute('aria-label', title); svg.setAttribute('role', 'img'); }
    return svg;
  }

  /** @param {string} tag @returns {SVGElement} */
  _el(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }
}
