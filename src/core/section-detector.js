/**
 * @fileoverview Automatic song section detection.
 * Algorithm: chroma self-similarity matrix → Foote novelty kernel → boundary detection → labeling.
 * Pure logic — no I/O, no DOM.
 * @module core/section-detector
 */

import { cosineSimilarity, mean, std } from '../utils/math.js';

export class SectionDetector {
  /**
   * @param {{ minSectionDuration?: number, kernelSize?: number }} [options]
   */
  constructor({ minSectionDuration = 8, kernelSize = 8 } = {}) {
    this.minSectionDuration = minSectionDuration; // seconds
    this.kernelSize         = kernelSize;
  }

  /**
   * Detect structural sections from audio segments.
   * @param {Array<{start:number, duration:number, pitches:number[]}>} segments
   * @param {{ tempo?: number, duration?: number }} [meta]
   * @returns {import('../types.js').SectionLabel[]}
   */
  detect(segments, meta = {}) {
    const valid = segments.filter(s => s.pitches?.length === 12);
    if (valid.length < 16) { return []; }

    // Downsample for long songs (> 500 segments)
    const segs = valid.length > 500
      ? valid.filter((_, i) => i % 2 === 0)
      : valid;

    const S          = this._buildSimilarityMatrix(segs);
    const novelty    = this._computeNovelty(S);
    const boundaries = this._findBoundaries(novelty, segs);
    const raw        = this._boundariesToSections(segs, boundaries);
    return this._labelSections(raw, meta);
  }

  /**
   * Build NxN cosine-similarity matrix (compact — upper triangle only).
   * @param {Array<{pitches:number[]}>} segs
   * @returns {{ get(i:number,j:number):number, n:number }}
   */
  _buildSimilarityMatrix(segs) {
    const n    = segs.length;
    const size = Math.floor(n * (n + 1) / 2);
    const flat = new Float32Array(size);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        flat[idx++] = cosineSimilarity(segs[i].pitches, segs[j].pitches);
      }
    }
    return {
      n,
      get(i, j) {
        if (i > j) { [i, j] = [j, i]; }
        return flat[i * n - Math.floor(i * (i - 1) / 2) + (j - i)];
      },
    };
  }

  /**
   * Apply Foote checkerboard kernel to diagonal of S.
   * @param {{ get(i:number,j:number):number, n:number }} S
   * @returns {Float32Array}
   */
  _computeNovelty(S) {
    const n       = S.n;
    const k       = this.kernelSize;
    const novelty = new Float32Array(n);
    for (let i = k; i < n - k; i++) {
      let score = 0;
      for (let di = 0; di < k; di++) {
        for (let dj = 0; dj < k; dj++) {
          const internal = S.get(i - di, i - dj) + S.get(i + di, i + dj);
          const cross    = S.get(i - di, i + dj) + S.get(i + di, i - dj);
          score += internal - cross;
        }
      }
      novelty[i] = Math.max(0, score / (k * k));
    }
    return novelty;
  }

  /**
   * Find peak indices in the novelty curve as section boundaries.
   * @param {Float32Array} novelty
   * @param {Array<{start:number}>} segs
   * @returns {number[]} indices into segs
   */
  _findBoundaries(novelty, segs) {
    const arr       = Array.from(novelty);
    const threshold = mean(arr) + 0.5 * std(arr);
    const minGap    = Math.max(2, Math.ceil(this.minSectionDuration / ((segs[1]?.start ?? 0.5) - (segs[0]?.start ?? 0))));
    const bounds    = [0];

    for (let i = 1; i < novelty.length - 1; i++) {
      const isPeak     = novelty[i] > novelty[i - 1] && novelty[i] > novelty[i + 1];
      const isStrong   = novelty[i] > threshold;
      const isFarEnough = i - bounds[bounds.length - 1] >= minGap;
      if (isPeak && isStrong && isFarEnough) { bounds.push(i); }
    }
    bounds.push(segs.length - 1);
    return bounds;
  }

  /**
   * Convert boundary indices into raw section objects.
   * @param {Array<{start:number,duration:number,pitches:number[]}>} segs
   * @param {number[]} bounds
   * @returns {Array<{startTime:number, endTime:number, chromaCentroid:number[]}>}
   */
  _boundariesToSections(segs, bounds) {
    const sections = [];
    for (let b = 0; b < bounds.length - 1; b++) {
      const from = bounds[b];
      const to   = bounds[b + 1];
      const slice = segs.slice(from, to);
      const centroid = new Array(12).fill(0);
      for (const s of slice) { for (let i = 0; i < 12; i++) { centroid[i] += s.pitches[i]; } }
      for (let i = 0; i < 12; i++) { centroid[i] /= slice.length; }
      sections.push({
        startTime: segs[from].start,
        endTime:   segs[Math.min(to, segs.length - 1)].start + (segs[Math.min(to, segs.length - 1)].duration ?? 0.5),
        chromaCentroid: centroid,
      });
    }
    return sections;
  }

  /**
   * Assign structural labels (intro, verse, chorus, bridge, outro) to sections.
   * @param {Array<{startTime:number, endTime:number, chromaCentroid:number[]}>} raw
   * @param {{ tempo?: number, duration?: number }} meta
   * @returns {import('../types.js').SectionLabel[]}
   */
  _labelSections(raw, meta) {
    if (!raw.length) { return []; }
    const totalDuration = meta.duration ?? (raw[raw.length - 1].endTime);

    // Cluster sections by chroma similarity
    const groups = this._clusterSections(raw);

    // Identify which group is chorus (most repetitions + high energy implied by position)
    // Groups with count >= 2 and appearing in the middle of the song
    const groupCounts = groups.map((g, i) => ({ idx: i, count: g.length }));
    groupCounts.sort((a, b) => b.count - a.count);
    const chorusGroupIdx = groupCounts[0]?.idx ?? 0;

    const labeled = /** @type {import('../types.js').SectionLabel[]} */ ([]);
    const groupRepetitionCount = new Array(groups.length).fill(0);

    for (const sec of raw) {
      const gIdx = groups.findIndex(g => g.includes(sec));
      groupRepetitionCount[gIdx]++;
      const rep = groupRepetitionCount[gIdx];

      let type = /** @type {import('../types.js').SectionLabel['type']} */ ('unknown');

      if (sec.startTime < 16 && rep === 1) {
        type = 'intro';
      } else if (sec.endTime > totalDuration - 20 && rep === groupCounts.find(g => g.idx === gIdx)?.count) {
        type = 'outro';
      } else if (gIdx === chorusGroupIdx) {
        type = 'chorus';
      } else if (groupCounts.findIndex(g => g.idx === gIdx) === 1) {
        type = 'verse';
      } else if (groups[gIdx]?.length === 1) {
        type = 'bridge';
      } else {
        type = 'verse';
      }

      labeled.push({ type, startTime: sec.startTime, endTime: sec.endTime, repetitionIndex: rep });
    }

    return labeled;
  }

  /**
   * Group sections by chroma centroid similarity (threshold = 0.85).
   * @param {Array<{chromaCentroid:number[]}>} sections
   * @returns {Array<Array<{chromaCentroid:number[]}>>}
   */
  _clusterSections(sections) {
    const THRESHOLD = 0.85;
    const groups    = /** @type {Array<Array<{chromaCentroid:number[]}>>} */ ([]);

    for (const sec of sections) {
      let placed = false;
      for (const group of groups) {
        const sim = cosineSimilarity(sec.chromaCentroid, group[0].chromaCentroid);
        if (sim >= THRESHOLD) { group.push(sec); placed = true; break; }
      }
      if (!placed) { groups.push([sec]); }
    }
    return groups;
  }
}
