/**
 * @fileoverview Leveled logger with optional DOM overlay.
 * @module utils/logger
 */

export const LOG_LEVELS = /** @type {const} */ (['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF']);

/** @param {string} s @returns {string} */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] ?? m));
}

/** @param {unknown} obj @returns {string} */
function safeStr(obj) {
  try { return typeof obj === 'string' ? obj : JSON.stringify(obj); } catch { return String(obj); }
}

export class Logger {
  /**
   * @param {string} name
   * @param {string} [level]
   * @param {boolean} [overlay]
   */
  constructor(name, level = 'INFO', overlay = false) {
    this.name = name;
    this.levelIdx = LOG_LEVELS.indexOf(/** @type {any} */ (level));
    this.buffer = /** @type {string[]} */ ([]);
    this.maxBuffer = 500;
    this.consoleEl = /** @type {HTMLElement|null} */ (null);
    this.overlayEnabled = overlay;
    this._timers = new Map();
    this._depth = 0;
    if (overlay) { this._ensureOverlay(); }
  }

  /** @param {string} level */
  setLevel(level) {
    const idx = LOG_LEVELS.indexOf(/** @type {any} */ (level));
    if (idx !== -1) { this.levelIdx = idx; }
    this._render();
  }

  toggleOverlay() {
    this.overlayEnabled = !this.overlayEnabled;
    if (this.overlayEnabled) { this._ensureOverlay(); }
    if (this.consoleEl) { this.consoleEl.style.display = this.overlayEnabled ? 'block' : 'none'; }
  }

  _ensureOverlay() {
    if (this.consoleEl || typeof document === 'undefined') { return; }
    const el = document.createElement('div');
    el.id = 'chorduction-debug-console';
    Object.assign(el.style, {
      position: 'fixed', right: '10px', bottom: '10px', width: '520px',
      maxHeight: '40vh', overflow: 'auto', background: 'rgba(10,10,10,0.95)',
      color: '#ddd', font: '12px/1.35 monospace', border: '1px solid #444',
      borderRadius: '8px', zIndex: '999999', padding: '8px',
    });
    el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
    document.body.appendChild(el);
    this.consoleEl = el;
    this._render();
  }

  /** @param {string} label */
  time(label) { this._timers.set(label, performance.now()); }

  /** @param {string} label */
  timeEnd(label) {
    const t = this._timers.get(label);
    if (t != null) {
      this.debug(`⏱ ${label}: ${(performance.now() - t).toFixed(1)}ms`);
      this._timers.delete(label);
    }
  }

  /** @param {string} level @param {...unknown} args */
  log(level, ...args) {
    const idx = LOG_LEVELS.indexOf(/** @type {any} */ (level));
    if (idx < this.levelIdx) { return; }
    const ts = new Date().toISOString().split('T')[1].replace('Z', '');
    const indent = '  '.repeat(this._depth);
    const prefix = `[${ts}] [${this.name}] ${indent}${level}:`;
    const msg = [prefix, ...args].map(safeStr).join(' ');
    this.buffer.push(msg);
    if (this.buffer.length > this.maxBuffer) { this.buffer.shift(); }
    try {
      const fn = level === 'ERROR' || level === 'WARN' ? console.error : console.log;
      fn('%c' + prefix, 'color:#9cf', ...args);
    } catch { /* ignore */ }
    if (this.overlayEnabled) { this._render(); }
  }

  _render() {
    if (!this.consoleEl) { return; }
    const html = this.buffer.slice(-200).map(line => {
      const c = line.includes('ERROR') ? '#ff7b7b' : line.includes('WARN') ? '#ffd57b' : '#ddd';
      return `<div style="color:${c}">${escapeHtml(line)}</div>`;
    }).join('');
    this.consoleEl.innerHTML = `<div style="margin-bottom:6px"><b>Chorduction Debug</b> | Level: ${LOG_LEVELS[this.levelIdx]}</div>${html}`;
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }

  /** @param {...unknown} a */ trace(...a) { this.log('TRACE', ...a); }
  /** @param {...unknown} a */ debug(...a) { this.log('DEBUG', ...a); }
  /** @param {...unknown} a */ info(...a)  { this.log('INFO',  ...a); }
  /** @param {...unknown} a */ warn(...a)  { this.log('WARN',  ...a); }
  /** @param {...unknown} a */ error(...a) { this.log('ERROR', ...a); }
}
