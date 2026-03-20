/**
 * @fileoverview Tracks DOM elements, event listeners, and timers added by the extension
 * so they can be cleanly removed on unload.
 * @module utils/cleanup-manager
 */

export class CleanupManager {
  constructor() {
    /** @type {Array<{target:EventTarget, event:string, handler:EventListener, options:any}>} */
    this._listeners = [];
    /** @type {Set<number>} */
    this._timers = new Set();
    /** @type {Set<Element>} */
    this._elements = new Set();
  }

  /**
   * @param {EventTarget|null|undefined} target
   * @param {string} event
   * @param {EventListener} handler
   * @param {AddEventListenerOptions} [options]
   */
  addListener(target, event, handler, options) {
    target?.addEventListener(event, handler, options);
    this._listeners.push({ target: /** @type {EventTarget} */ (target), event, handler, options });
  }

  /** @param {number} id @returns {number} */
  addTimer(id) { this._timers.add(id); return id; }

  /** @param {Element} el @returns {Element} */
  addElement(el) { this._elements.add(el); return el; }

  cleanup() {
    for (const l of this._listeners) {
      l.target?.removeEventListener?.(l.event, l.handler, l.options);
    }
    this._listeners.length = 0;
    for (const id of this._timers) { clearTimeout(id); clearInterval(id); }
    this._timers.clear();
    for (const el of this._elements) { el.parentNode?.removeChild(el); }
    this._elements.clear();
  }
}
