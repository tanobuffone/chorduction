/**
 * @fileoverview Lazy TF.js model loader with IndexedDB caching.
 * The model is downloaded once, cached in IndexedDB, and reused on subsequent loads.
 * @module ml/model-loader
 */

const MODEL_URL       = 'https://cdn.chorduction.app/models/v7/model.json';
const INDEXEDDB_KEY   = 'indexeddb://chorduction-model-v7';
const MAX_AGE_MS      = 7 * 24 * 60 * 60 * 1000; // 7 days
const MODEL_TS_KEY    = 'chorduction-model-ts-v7';

export class ModelLoader {
  /** @param {{ logger?: import('../utils/logger.js').Logger }} [opts] */
  constructor({ logger } = {}) {
    this.logger  = logger ?? null;
    /** @type {any} */
    this._model  = null;
    this._loading = false;
    /** @type {Promise<boolean>|null} */
    this._promise = null;
  }

  /** @returns {boolean} */
  get isLoaded() { return this._model !== null; }

  /**
   * Load the model. Safe to call multiple times — returns the same promise.
   * @returns {Promise<boolean>}
   */
  load() {
    if (this._model) { return Promise.resolve(true); }
    if (this._promise) { return this._promise; }
    this._promise = this._doLoad();
    return this._promise;
  }

  /**
   * @param {Float32Array} input - Flat [12 * 16] tensor values
   * @returns {Promise<{ chord: string, confidence: number }|null>}
   */
  async predict(input) {
    if (!this._model) { return null; }
    try {
      const tf     = /** @type {any} */ (window.tf);
      const tensor = tf.tensor4d(Array.from(input), [1, 12, 16, 1]);
      const pred   = this._model.predict(tensor);
      const probs  = await pred.data();
      tensor.dispose();
      pred.dispose();

      const CHORD_CLASSES = _buildChordClasses();
      let   bestIdx = 0, bestProb = 0;
      for (let i = 0; i < probs.length; i++) {
        if (probs[i] > bestProb) { bestProb = probs[i]; bestIdx = i; }
      }

      return { chord: CHORD_CLASSES[bestIdx] ?? 'C', confidence: bestProb };
    } catch (e) {
      this.logger?.warn('[ModelLoader] Prediction error:', e.message);
      return null;
    }
  }

  async _doLoad() {
    try {
      const tf = /** @type {any} */ (window.tf);
      if (!tf) { this.logger?.warn('[ModelLoader] TF.js not available'); return false; }

      // Check if cached model is fresh
      const ts = parseInt(localStorage.getItem(MODEL_TS_KEY) ?? '0');
      if (Date.now() - ts < MAX_AGE_MS) {
        try {
          this._model = await tf.loadLayersModel(INDEXEDDB_KEY);
          this.logger?.info('[ModelLoader] Loaded from IndexedDB cache');
          return true;
        } catch { /* cache miss or corrupt — fall through to download */ }
      }

      this.logger?.info('[ModelLoader] Downloading model from CDN…');
      this._model = await tf.loadLayersModel(MODEL_URL);
      await this._model.save(INDEXEDDB_KEY);
      localStorage.setItem(MODEL_TS_KEY, String(Date.now()));
      this.logger?.info('[ModelLoader] Model downloaded and cached');
      return true;

    } catch (e) {
      this.logger?.warn('[ModelLoader] Failed to load model:', e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      this._loading = false;
    }
  }
}

// 73 chord classes: 12 roots × 5 qualities + 12 sus2 + N.C.
function _buildChordClasses() {
  const notes     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const qualities = ['', 'm', '7', 'maj7', 'm7'];
  const classes   = [];
  for (const n of notes) { for (const q of qualities) { classes.push(n + q); } }
  for (const n of notes) { classes.push(n + 'sus2'); }
  classes.push('N.C.');
  return classes; // 73 total
}
