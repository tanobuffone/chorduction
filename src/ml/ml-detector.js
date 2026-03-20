/**
 * @fileoverview ML chord detection facade — orchestrates model loading, feature extraction, and blending.
 * @module ml/ml-detector
 */

import { ModelLoader }      from './model-loader.js';
import { buildChromaMatrix, matrixToFloat32 } from './feature-extractor.js';
import { blendResults }     from './blend-strategy.js';
import { binarySearchTime } from '../utils/math.js';

export class MLDetector {
  /** @param {{ logger?: import('../utils/logger.js').Logger }} [opts] */
  constructor({ logger } = {}) {
    this._loader = new ModelLoader({ logger });
    this._logger = logger ?? null;
  }

  /** @returns {Promise<boolean>} */
  loadModel() { return this._loader.load(); }

  /** @returns {boolean} */
  get isReady() { return this._loader.isLoaded; }

  /**
   * Apply ML blending to an array of chroma-detected chords.
   * Falls back transparently if the model is not loaded.
   *
   * @param {import('../types.js').ChordResult[]} chromaChords
   * @param {Array<{start:number, duration:number, pitches:number[]}>} segments
   * @returns {Promise<import('../types.js').ChordResult[]>}
   */
  async blendChords(chromaChords, segments) {
    if (!this._loader.isLoaded || !segments.length) { return chromaChords; }

    const result = [];
    for (const chord of chromaChords) {
      const segIdx = binarySearchTime(segments, chord.startMs / 1000);
      const matrix = buildChromaMatrix(segments, segIdx);
      const flat   = matrixToFloat32(matrix);
      const ml     = await this._loader.predict(flat);
      result.push(blendResults(chord, ml));
    }
    return result;
  }
}
