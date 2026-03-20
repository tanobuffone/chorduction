/**
 * @fileoverview Stores user chord corrections for future ML fine-tuning.
 * @module ml/correction-collector
 */

const STORAGE_KEY    = 'chorduction-corrections-v7';
const MAX_CORRECTIONS = 500;

export class CorrectionCollector {
  /**
   * @param {{ chord: string, rawChord: string }} predictedChord
   * @param {string} correctChord
   * @param {number[][]} chromaMatrix - 12×16 context matrix
   */
  save(predictedChord, correctChord, chromaMatrix) {
    const corrections = this._load();
    corrections.push({
      chroma:    chromaMatrix,
      predicted: predictedChord.rawChord,
      correct:   correctChord,
      timestamp: Date.now(),
    });
    if (corrections.length > MAX_CORRECTIONS) {
      corrections.splice(0, corrections.length - MAX_CORRECTIONS);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections));
    } catch { /* quota exceeded */ }
  }

  /** @returns {Array<{chroma:number[][], predicted:string, correct:string, timestamp:number}>} */
  export() { return this._load(); }

  /** @returns {number} */
  count() { return this._load().length; }

  clear() { localStorage.removeItem(STORAGE_KEY); }

  _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
  }
}
