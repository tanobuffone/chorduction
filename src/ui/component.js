/**
 * @fileoverview Minimal component base class — no framework, no VDOM.
 * @module ui/component
 */

export class Component {
  /** @param {Element} container */
  constructor(container) {
    this.container = container;
    this.state     = /** @type {Record<string,any>} */ ({});
  }

  /** @param {Record<string,any>} partial */
  setState(partial) {
    const prev = this.state;
    this.state  = { ...this.state, ...partial };
    if (this._changed(prev, this.state)) { this.render(); }
  }

  render() {
    this.container.innerHTML = this.template(this.state);
    this.bindEvents();
  }

  /** @param {Record<string,any>} _state @returns {string} */
  template(_state) { return ''; }

  bindEvents() {}

  /**
   * @param {Record<string,any>} a
   * @param {Record<string,any>} b
   * @returns {boolean}
   */
  _changed(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) { if (a[k] !== b[k]) { return true; } }
    return false;
  }
}
