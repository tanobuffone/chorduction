/**
 * @fileoverview Chord detection engine — chroma cosine similarity + beat smoothing.
 * Pure logic — receives dependencies via constructor (DI).
 * @module core/chord-detector
 */

import { buildChordTemplates } from './chord-templates.js';
import { detectKey, buildAggregateChroma } from './key-detector.js';
import { cosineSimilarity, binarySearchTime } from '../utils/math.js';
import { transpose } from './transposer.js';
import { convert } from './chord-notation.js';

export class ChordDetector {
  /**
   * @param {{
   *   minConfidence?: number,
   *   smoothingBeats?: number,
   *   chordSimplification?: number,
   * }} [options]
   */
  constructor(options = {}) {
    this.minConfidence      = options.minConfidence      ?? 0.1;
    this.smoothingBeats     = options.smoothingBeats     ?? 3;
    this.chordSimplification = options.chordSimplification ?? 1;
    this._templates = buildChordTemplates();
  }

  /**
   * Detect the best-matching chord for a chroma vector.
   * @param {number[]} chroma
   * @returns {{ chord: string, confidence: number, alternatives: Array<{chord:string,similarity:number}> }}
   */
  detectChord(chroma) {
    let bestChord = 'N';
    let bestSim   = 0;
    const all = /** @type {Array<{chord:string,similarity:number}>} */ ([]);

    // Filter templates by simplification level
    for (const [chord, profile] of Object.entries(this._templates)) {
      if (!this._passesSimplification(chord)) { continue; }
      const sim = cosineSimilarity(chroma, profile);
      all.push({ chord, similarity: sim });
      if (sim > bestSim) { bestSim = sim; bestChord = chord; }
    }

    all.sort((a, b) => b.similarity - a.similarity);

    return {
      chord:        bestSim >= this.minConfidence ? bestChord : 'N',
      confidence:   bestSim,
      alternatives: all.slice(0, 3),
    };
  }

  /**
   * Process a full Spotify Audio Analysis response into a chord timeline.
   * @param {Object} analysis - Raw Spotify Audio Analysis response
   * @param {number} [transposeSemitones]
   * @param {string} [notation]
   * @returns {{ chords: import('../types.js').ChordResult[], key: string, keyConfidence: number, tempo: number }}
   */
  processAnalysis(analysis, transposeSemitones = 0, notation = 'standard') {
    if (!analysis?.segments?.length) {
      return { chords: [], key: 'C', keyConfidence: 0, tempo: 0 };
    }

    // Key detection from first ~30 seconds
    const aggChroma = buildAggregateChroma(analysis.segments);
    const { key, confidence: keyConfidence } = detectKey(aggChroma);

    const beats  = analysis.beats ?? analysis.tatums ?? [];
    const tempo  = analysis.track?.tempo ?? 0;
    const chords = this._buildChordTimeline(beats, analysis.segments);

    // Apply transpose + notation
    const finalChords = chords.map(c => {
      const transposed = transpose(c.rawChord, transposeSemitones);
      return {
        ...c,
        chord:    convert(transposed, notation, key.replace(/m$/, '')),
        rawChord: c.rawChord,
      };
    });

    return { chords: finalChords, key, keyConfidence, tempo };
  }

  /**
   * @param {Array<{start:number,duration:number}>} beats
   * @param {Array<{start:number,duration:number,pitches:number[]}>} segments
   * @returns {import('../types.js').ChordResult[]}
   */
  _buildChordTimeline(beats, segments) {
    const results  = /** @type {import('../types.js').ChordResult[]} */ ([]);
    let currentRaw = '';
    let chordStart = 0;
    let beatCount  = 0;
    let lastConf   = 0;

    for (const beat of beats) {
      const segIdx = binarySearchTime(segments, beat.start);
      const seg    = segments[segIdx];
      if (!seg?.pitches?.length) { continue; }

      const { chord: raw, confidence } = this.detectChord(seg.pitches);

      if (raw === currentRaw || beatCount < this.smoothingBeats) {
        if (beatCount >= this.smoothingBeats && confidence > 0.3) { currentRaw = raw; lastConf = confidence; }
      } else {
        if (currentRaw) {
          results.push({
            chord:      currentRaw,
            rawChord:   currentRaw,
            confidence: lastConf,
            startMs:    chordStart * 1000,
            endMs:      beat.start * 1000,
            source:     'chroma',
          });
        }
        currentRaw = raw;
        chordStart = beat.start;
        lastConf   = confidence;
      }
      beatCount++;
    }

    // Flush last chord
    if (currentRaw && beats.length) {
      const last = beats[beats.length - 1];
      results.push({
        chord:      currentRaw,
        rawChord:   currentRaw,
        confidence: lastConf,
        startMs:    chordStart * 1000,
        endMs:      (last.start + last.duration) * 1000,
        source:     'chroma',
      });
    }

    return results;
  }

  /**
   * @param {string} chord
   * @returns {boolean}
   */
  _passesSimplification(chord) {
    const level = this.chordSimplification;
    if (level >= 3) { return true; }
    if (level === 1) { return !chord.includes('7') && !chord.includes('9') && !chord.includes('sus'); }
    // level 2: allow 7ths but not 9ths or suspensions
    return !chord.includes('9') && !chord.includes('sus');
  }
}
