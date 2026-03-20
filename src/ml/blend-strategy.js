/**
 * @fileoverview Blend chroma-based and ML-based chord detection results.
 * Pure function — no I/O.
 * @module ml/blend-strategy
 */

const ML_HIGH_THRESHOLD    = 0.70;  // ML confidence above this → use ML directly
const BLEND_LOW_THRESHOLD  = 0.50;  // ML below this → use chroma
const AGREEMENT_BOOST      = 0.10;  // Confidence bonus when both methods agree

/**
 * @param {import('../types.js').ChordResult} chromaResult
 * @param {{ chord: string, confidence: number }|null} mlResult
 * @returns {import('../types.js').ChordResult}
 */
export function blendResults(chromaResult, mlResult) {
  if (!mlResult) { return chromaResult; }

  const mlConf     = mlResult.confidence;
  const chromaConf = chromaResult.confidence;

  if (mlConf >= ML_HIGH_THRESHOLD) {
    return { ...chromaResult, chord: mlResult.chord, confidence: mlConf, source: 'ml' };
  }

  if (mlConf < BLEND_LOW_THRESHOLD) {
    return { ...chromaResult, source: 'chroma' };
  }

  // Blend zone [0.50 .. 0.70]
  if (mlResult.chord === chromaResult.chord) {
    // Agreement → boost confidence
    const blended = Math.min(1, (mlConf + chromaConf) / 2 + AGREEMENT_BOOST);
    return { ...chromaResult, confidence: blended, source: 'blend' };
  }

  // Disagreement → choose the more confident, apply uncertainty penalty
  if (mlConf > chromaConf) {
    return { ...chromaResult, chord: mlResult.chord, confidence: mlConf * 0.9, source: 'ml-uncertain' };
  }
  return { ...chromaResult, confidence: chromaConf * 0.9, source: 'chroma-uncertain' };
}
