/**
 * @fileoverview Chord progression display component.
 * @module ui/chord-display
 */

import { Component } from './component.js';
import { t } from '../utils/i18n.js';

export class ChordDisplay extends Component {
  /**
   * @param {Element} container
   * @param {{ lang?: string, showConfidence?: boolean, showLyrics?: boolean }} [opts]
   */
  constructor(container, opts = {}) {
    super(container);
    this._lang           = opts.lang            ?? 'en';
    this._showConfidence = opts.showConfidence   ?? true;
    this._showLyrics     = opts.showLyrics       ?? true;
    this._onManualEdit   = /** @type {Function|null} */ (null);
    this._renderInstrument = /** @type {Function|null} */ (null);
  }

  /** @param {Function} fn - fn(chord: ChordResult) */
  onManualEdit(fn) { this._onManualEdit = fn; }

  /** @param {Function} fn - fn(chordName: string) => HTMLElement|null */
  onRenderInstrument(fn) { this._renderInstrument = fn; }

  template(state) {
    const { chords, loading, error } = state;
    if (loading) {
      return `<div style="color:#888;padding:20px;text-align:center">${t('analyzing', this._lang)}</div>`;
    }
    if (error) {
      return `<div style="padding:20px;text-align:center">
        <div style="color:#ff6b6b;font-size:14px;margin-bottom:8px">${t('audioUnavailable', this._lang)}</div>
        <div style="color:#888;font-size:12px;margin-bottom:20px">${t('audioUnavailableHint', this._lang)}</div>
        <button data-action="manual" style="padding:10px 20px;border-radius:20px;border:none;background:#1db954;color:#fff;cursor:pointer;font-size:14px">
          ${t('addChordsManually', this._lang)}
        </button>
      </div>`;
    }
    if (!chords?.length) {
      return `<div style="color:#888;padding:20px;text-align:center">${t('noData', this._lang)}</div>`;
    }

    // Group by section if sections provided
    const sections = state.sections ?? [];
    let html = '';
    let lastSectionIdx = -1;

    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i];

      // Section header
      if (sections.length) {
        const sIdx = sections.findIndex(/** @param {any} s */ s =>
          chord.startMs >= s.startTime * 1000 && chord.startMs < s.endTime * 1000
        );
        if (sIdx !== -1 && sIdx !== lastSectionIdx) {
          const sec   = sections[sIdx];
          const label = t(`section_${sec.type}`, this._lang);
          const rep   = sec.repetitionIndex > 1 ? ` ${sec.repetitionIndex}` : '';
          html += `<div style="font-size:11px;font-weight:bold;color:#888;letter-spacing:1px;margin:12px 0 4px;border-bottom:1px solid #333;padding-bottom:4px">
            ${label}${rep}
          </div>`;
          lastSectionIdx = sIdx;
        }
      }

      const conf    = Math.round((chord.confidence ?? 0) * 100);
      const confBg  = conf < 30 ? '#ff6b6b' : conf < 50 ? '#ffd93d' : '#6bcb77';
      const isActive = state.activeChordIdx === i;

      html += `<div data-chord-idx="${i}" style="
        display:flex;align-items:center;gap:10px;padding:8px 10px;
        background:${isActive ? '#1a3a1a' : '#2a2a2a'};
        border:1px solid ${isActive ? '#1db954' : 'transparent'};
        border-radius:6px;margin:3px 0;transition:background 0.15s;
      ">
        <span style="font-size:20px;font-weight:bold;min-width:64px;color:${isActive ? '#1db954' : '#fff'}">${chord.chord}</span>`;

      if (this._showConfidence) {
        html += `<span style="font-size:11px;padding:2px 6px;border-radius:3px;background:${confBg};color:#000">${conf}%</span>`;
      }

      if (this._showLyrics && chord.lyric) {
        html += `<span style="flex:1;color:#ccc;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${chord.lyric}</span>`;
      }

      html += `<button data-edit="${i}" aria-label="Edit chord" style="
        padding:3px 8px;font-size:11px;border-radius:3px;border:none;
        background:#444;color:#fff;cursor:pointer;margin-left:auto;flex-shrink:0
      ">${t('manualOverride', this._lang)}</button>`;

      html += `</div>`;
    }

    return `<div style="opacity:${state.loading ? 0.4 : 1};transition:opacity 0.2s">${html}</div>`;
  }

  bindEvents() {
    this.container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(/** @type {HTMLElement} */ (e.currentTarget).dataset['edit'] ?? '0');
        if (this._onManualEdit) { this._onManualEdit(idx); }
      });
    });

    const manualBtn = this.container.querySelector('[data-action="manual"]');
    if (manualBtn && this._onManualEdit) {
      manualBtn.addEventListener('click', () => this._onManualEdit?.(-1));
    }

    // Inject instrument diagrams
    if (this._renderInstrument) {
      this.container.querySelectorAll('[data-chord-idx]').forEach(el => {
        const idx   = parseInt(/** @type {HTMLElement} */ (el).dataset['chordIdx'] ?? '0');
        const chord = this.state.chords?.[idx];
        if (chord) {
          const diagram = this._renderInstrument?.(chord.chord);
          if (diagram) { el.appendChild(diagram); }
        }
      });
    }
  }
}
