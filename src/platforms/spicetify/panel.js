/**
 * @fileoverview Builds the main Chorduction panel DOM and wires all UI components.
 * @module platforms/spicetify/panel
 */

import { ChordDisplay }  from '../../ui/chord-display.js';
import { showModal }     from '../../ui/modal.js';
import { t }             from '../../utils/i18n.js';
import { exportFile }    from '../../export/file-exporter.js';
import { clampTranspose } from '../../core/transposer.js';
import { availableNotations } from '../../core/chord-notation.js';
import { GuitarFretboard }   from '../../ui/instruments/guitar-fretboard.js';
import { UkuleleFretboard }  from '../../ui/instruments/ukulele-fretboard.js';
import { PianoKeys }         from '../../ui/instruments/piano-keys.js';
import { BassFretboard }     from '../../ui/instruments/bass-fretboard.js';

/** @param {string} inst @returns {{ render(chord:string): HTMLElement|null }} */
function getInstrument(inst) {
  const map = { guitar: GuitarFretboard, ukulele: UkuleleFretboard, piano: PianoKeys, bass: BassFretboard };
  const Cls = map[inst] ?? GuitarFretboard;
  return new Cls();
}

/**
 * @param {{
 *   config: import('../../config.js').ChorductionSettings,
 *   onSaveConfig: (patch: Partial<import('../../config.js').ChorductionSettings>) => void,
 *   onAnalyze: () => void,
 *   getCurrentAnalysis: () => import('../../types.js').AnalysisResult|null,
 *   getTrackMeta: () => { title:string, artist:string },
 * }} opts
 * @returns {{ open: () => void, updateDisplay: (state: object) => void }}
 */
export function createPanel({ config, onSaveConfig, onAnalyze, getCurrentAnalysis, getTrackMeta }) {
  let display   = /** @type {ChordDisplay|null} */ (null);
  let transposeVal = config.transposeSemitones;
  let cfg = { ...config };

  function buildContent() {
    const lang = cfg.language;
    const container = document.createElement('div');
    container.id = 'chorduction-panel';

    // ── Header ──────────────────────────────────────────────
    container.innerHTML = `
      <h2 style="margin:0 0 12px;display:flex;align-items:center;gap:10px">
        ${t('title', lang)} <span style="font-size:12px;color:#888">v${__VERSION__}</span>
      </h2>`;

    // ── Controls row ─────────────────────────────────────────
    const ctrlRow = document.createElement('div');
    ctrlRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:center';
    ctrlRow.innerHTML = `
      <div style="display:flex;gap:4px;align-items:center">
        <button id="cd-t-dn" style="${_btnStyle()}" aria-label="Transpose down">−</button>
        <span id="cd-t-val" style="min-width:32px;text-align:center;font-size:13px;color:#ccc">${transposeVal > 0 ? '+' + transposeVal : transposeVal}</span>
        <button id="cd-t-up" style="${_btnStyle()}" aria-label="Transpose up">+</button>
      </div>
      <select id="cd-notation" style="${_selectStyle()}" aria-label="${t('notation', lang)}">
        ${availableNotations().map(n => `<option value="${n}" ${cfg.chordNotation === n ? 'selected' : ''}>${n[0].toUpperCase()+n.slice(1)}</option>`).join('')}
      </select>
      <select id="cd-instrument" style="${_selectStyle()}" aria-label="${t('instrument', lang)}">
        ${['guitar','ukulele','piano','bass'].map(i => `<option value="${i}" ${cfg.instrument === i ? 'selected' : ''}>${t(i, lang)}</option>`).join('')}
      </select>
      <button id="cd-analyze" style="${_btnStyle('primary')}" aria-label="Re-analyze">↺ Analyze</button>
    `;
    container.appendChild(ctrlRow);

    // ── Chord display area ───────────────────────────────────
    const displayEl = document.createElement('div');
    displayEl.id = 'cd-chord-area';
    displayEl.style.cssText = 'min-height:120px;padding:12px;background:#1a1a1a;border-radius:8px;margin-bottom:12px';
    container.appendChild(displayEl);

    display = new ChordDisplay(displayEl, { lang, showConfidence: cfg.showConfidence, showLyrics: cfg.showLyrics });
    display.setState({ loading: true });

    const instr = getInstrument(cfg.instrument);
    display.onRenderInstrument(chord => cfg.showFretboard ? instr.render(chord) : null);
    display.onManualEdit(idx => {
      if (idx === -1) { _showManualEntry(); return; }
      const analysis = getCurrentAnalysis();
      const chord = analysis?.chords?.[idx];
      if (!chord) { return; }
      const newChord = prompt('Enter chord:', chord.chord);
      if (newChord) {
        chord.chord    = newChord;
        chord.rawChord = newChord;
        chord.source   = 'manual';
        display?.setState({ chords: analysis.chords });
      }
    });

    // ── Export row ───────────────────────────────────────────
    const exportRow = document.createElement('div');
    exportRow.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px';
    exportRow.innerHTML = `
      <span style="font-size:11px;color:#888">${t('exportAs', lang)}</span>
      <button data-fmt="txt"      style="${_btnStyle()}" aria-label="Export TXT">TXT</button>
      <button data-fmt="json"     style="${_btnStyle()}" aria-label="Export JSON">JSON</button>
      <button data-fmt="chordpro" style="${_btnStyle()}" aria-label="Export ChordPro">ChordPro</button>
    `;
    exportRow.querySelectorAll('[data-fmt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fmt = /** @type {string} */ (/** @type {HTMLElement} */ (btn).dataset['fmt']);
        const analysis = getCurrentAnalysis();
        const meta = getTrackMeta();
        if (analysis) {
          exportFile({ ...analysis, meta: { ...meta, key: analysis.key, tempo: analysis.tempo, version: __VERSION__ } }, /** @type {any} */ (fmt));
          Spicetify?.showNotification?.('Exported!');
        }
      });
    });
    container.appendChild(exportRow);

    // ── Settings ─────────────────────────────────────────────
    const settings = document.createElement('details');
    settings.innerHTML = `
      <summary style="cursor:pointer;padding:8px;background:#333;border-radius:4px;user-select:none">${t('settingsTitle', lang)}</summary>
      <div style="padding:14px;display:flex;flex-direction:column;gap:10px">
        ${_checkbox('cd-lyrics',    t('showLyrics', lang),           cfg.showLyrics)}
        ${_checkbox('cd-fretboard', t('showFretboard', lang),        cfg.showFretboard)}
        ${_checkbox('cd-auto',      t('autoAnalyze', lang),          cfg.autoAnalyze)}
        ${_checkbox('cd-sections',  t('showSections', lang),         cfg.showSections)}
        ${_checkbox('cd-ml',        t('useML', lang),                cfg.useMLDetection)}
      </div>`;
    container.appendChild(settings);

    // Wire events
    _wire(container, ctrlRow, settings, onSaveConfig, onAnalyze, () => {
      transposeVal = cfg.transposeSemitones;
      cfg = { ...cfg, ...config }; // pick up any external updates
    });

    return container;
  }

  function open() {
    showModal(buildContent(), cfg.language);
    onAnalyze();
  }

  /** @param {object} state */
  function updateDisplay(state) {
    display?.setState(state);
  }

  return { open, updateDisplay };
}

function _wire(container, ctrlRow, settings, onSaveConfig, onAnalyze, _refresh) {
  ctrlRow.querySelector('#cd-t-dn')?.addEventListener('click', () => {
    const v = clampTranspose((parseInt(ctrlRow.querySelector('#cd-t-val')?.textContent ?? '0') || 0) - 1);
    /** @type {HTMLElement|null} */ (ctrlRow.querySelector('#cd-t-val')).textContent = v > 0 ? `+${v}` : String(v);
    onSaveConfig({ transposeSemitones: v });
    onAnalyze();
  });
  ctrlRow.querySelector('#cd-t-up')?.addEventListener('click', () => {
    const v = clampTranspose((parseInt(ctrlRow.querySelector('#cd-t-val')?.textContent ?? '0') || 0) + 1);
    /** @type {HTMLElement|null} */ (ctrlRow.querySelector('#cd-t-val')).textContent = v > 0 ? `+${v}` : String(v);
    onSaveConfig({ transposeSemitones: v });
    onAnalyze();
  });
  ctrlRow.querySelector('#cd-notation')?.addEventListener('change', e => {
    onSaveConfig({ chordNotation: /** @type {HTMLSelectElement} */ (e.target).value });
    onAnalyze();
  });
  ctrlRow.querySelector('#cd-instrument')?.addEventListener('change', e => {
    onSaveConfig({ instrument: /** @type {HTMLSelectElement} */ (e.target).value });
  });
  ctrlRow.querySelector('#cd-analyze')?.addEventListener('click', onAnalyze);

  [
    ['#cd-lyrics',    'showLyrics'],
    ['#cd-fretboard', 'showFretboard'],
    ['#cd-auto',      'autoAnalyze'],
    ['#cd-sections',  'showSections'],
    ['#cd-ml',        'useMLDetection'],
  ].forEach(([sel, key]) => {
    settings.querySelector(sel)?.addEventListener('change', e => {
      onSaveConfig({ [key]: /** @type {HTMLInputElement} */ (e.target).checked });
    });
  });
}

function _showManualEntry() {
  const numStr = prompt('How many chords?', '4');
  if (!numStr) { return; }
  const n = parseInt(numStr);
  const chords = [];
  for (let i = 0; i < n; i++) {
    const c = prompt(`Chord ${i + 1}:`, 'C');
    if (c) { chords.push({ chord: c, rawChord: c, startMs: i * 4000, endMs: (i + 1) * 4000, confidence: 1, source: 'manual' }); }
  }
  return chords;
}

/** @param {string} [variant] @returns {string} */
function _btnStyle(variant = '') {
  const bg = variant === 'primary' ? '#1db954' : '#444';
  return `padding:4px 10px;border-radius:4px;border:none;background:${bg};color:#fff;cursor:pointer;font-size:12px`;
}
/** @returns {string} */
function _selectStyle() {
  return 'padding:4px 8px;border-radius:4px;border:none;background:#333;color:#fff;font-size:12px';
}
/** @param {string} id @param {string} label @param {boolean} checked @returns {string} */
function _checkbox(id, label, checked) {
  return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}> ${label}
  </label>`;
}
