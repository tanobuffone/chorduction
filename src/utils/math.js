/**
 * @fileoverview Pure math utilities — no I/O, no DOM, fully testable.
 * @module utils/math
 */

/**
 * Cosine similarity between two 12-element vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} [0..1]
 */
export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-8 ? 0 : dot / denom;
}

/**
 * Pearson correlation between two equal-length arrays.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {number} [-1..1]
 */
export function pearsonCorrelation(x, y) {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num  += dx * dy;
    dx2  += dx * dx;
    dy2  += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom < 1e-8 ? 0 : num / denom;
}

/**
 * Binary search: find the index whose start time <= targetTime < start+duration.
 * Returns index 0 as fallback.
 * @param {Array<{start:number, duration:number}>} items
 * @param {number} targetTime seconds
 * @returns {number}
 */
export function binarySearchTime(items, targetTime) {
  let lo = 0, hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const item = items[mid];
    if (targetTime >= item.start && targetTime < item.start + item.duration) { return mid; }
    if (targetTime < item.start) { hi = mid - 1; } else { lo = mid + 1; }
  }
  return 0;
}

/**
 * @param {number[]} arr @returns {number}
 */
export function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }

/**
 * @param {number[]} arr @returns {number}
 */
export function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/**
 * L2-normalize a numeric array in place. Returns the array.
 * @param {number[]} arr
 * @returns {number[]}
 */
export function l2Normalize(arr) {
  const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  if (norm > 1e-8) { for (let i = 0; i < arr.length; i++) { arr[i] /= norm; } }
  return arr;
}
