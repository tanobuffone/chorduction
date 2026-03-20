/**
 * @fileoverview Key detection using the Krumhansl-Schmuckler algorithm.
 * Pure function — no I/O, no side effects.
 * @module core/key-detector
 */

import { NOTES, KEY_PROFILES } from './chord-templates.js';
import { pearsonCorrelation } from '../utils/math.js';

/**
 * Detect the musical key from an aggregate chroma vector.
 * Tests all 24 keys (12 major + 12 minor) via Pearson correlation
 * with Krumhansl-Schmuckler profiles.
 *
 * @param {number[]} chromaVector - Aggregate 12-element chroma vector
 * @returns {{ key: string, confidence: number }}
 *   key: e.g. "C", "F#m"
 *   confidence: normalized [0..1] — how strongly the best key dominated
 */
export function detectKey(chromaVector) {
  let bestKey = 'C';
  let bestScore = -Infinity;
  let secondBest = -Infinity;

  for (let i = 0; i < 12; i++) {
    // Rotate profile to align key i with C position
    const majorProfile = KEY_PROFILES.major.map((_, j) => KEY_PROFILES.major[(j - i + 12) % 12]);
    const minorProfile = KEY_PROFILES.minor.map((_, j) => KEY_PROFILES.minor[(j - i + 12) % 12]);

    const majorScore = pearsonCorrelation(chromaVector, majorProfile);
    const minorScore = pearsonCorrelation(chromaVector, minorProfile);

    if (majorScore > bestScore) {
      secondBest = bestScore;
      bestScore = majorScore;
      bestKey = NOTES[i];
    } else if (majorScore > secondBest) {
      secondBest = majorScore;
    }

    if (minorScore > bestScore) {
      secondBest = bestScore;
      bestScore = minorScore;
      bestKey = NOTES[i] + 'm';
    } else if (minorScore > secondBest) {
      secondBest = minorScore;
    }
  }

  // Confidence = margin over second best, normalized to [0..1]
  const margin = bestScore - secondBest;
  const confidence = Math.min(1, Math.max(0, margin / 0.5));

  return { key: bestKey, confidence };
}

/**
 * Build an aggregate chroma vector from an array of segments.
 * Uses the first `maxSegments` segments (typically the first ~30s).
 *
 * @param {Array<{pitches: number[]}>} segments
 * @param {number} [maxSegments]
 * @returns {number[]} 12-element averaged chroma vector
 */
export function buildAggregateChroma(segments, maxSegments = 50) {
  const chroma = new Array(12).fill(0);
  const slice = segments.slice(0, maxSegments).filter(s => s.pitches?.length === 12);
  if (!slice.length) { return chroma; }
  for (const seg of slice) {
    for (let i = 0; i < 12; i++) { chroma[i] += seg.pitches[i] ?? 0; }
  }
  for (let i = 0; i < 12; i++) { chroma[i] /= slice.length; }
  return chroma;
}
