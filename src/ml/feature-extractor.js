/**
 * @fileoverview Builds the 12×16 chroma matrix input for the CNN model.
 * Pure function — no I/O, no side effects.
 * @module ml/feature-extractor
 */

import { l2Normalize } from '../utils/math.js';

const CONTEXT_BEFORE = 8;
const CONTEXT_AFTER  = 7;
const TOTAL_FRAMES   = CONTEXT_BEFORE + 1 + CONTEXT_AFTER; // 16

/**
 * Build a [12][16] chroma context matrix centered on `centerIdx`.
 * Pads with zeros at song boundaries.
 *
 * @param {Array<{pitches:number[]}>} segments
 * @param {number} centerIdx
 * @returns {number[][]} [12][16] matrix, L2-normalized
 */
export function buildChromaMatrix(segments, centerIdx) {
  /** @type {number[][]} */
  const matrix = [];

  for (let pitch = 0; pitch < 12; pitch++) {
    const row = [];
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const segIdx = centerIdx - CONTEXT_BEFORE + f;
      if (segIdx < 0 || segIdx >= segments.length) {
        row.push(0.0);
      } else {
        row.push(segments[segIdx].pitches[pitch] ?? 0.0);
      }
    }
    matrix.push(row);
  }

  // Flatten, L2-normalize, then reshape back
  const flat = matrix.flat();
  l2Normalize(flat);
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < TOTAL_FRAMES; j++) {
      matrix[i][j] = flat[i * TOTAL_FRAMES + j];
    }
  }

  return matrix;
}

/**
 * Convert a [12][16] matrix to a flat Float32Array for TF.js tensor input.
 * @param {number[][]} matrix
 * @returns {Float32Array}
 */
export function matrixToFloat32(matrix) {
  const arr = new Float32Array(12 * TOTAL_FRAMES);
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < TOTAL_FRAMES; j++) {
      arr[i * TOTAL_FRAMES + j] = matrix[i][j];
    }
  }
  return arr;
}
