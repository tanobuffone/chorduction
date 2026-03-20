/**
 * @fileoverview Captures audio from the YouTube <video> element via Web Audio API.
 * Computes a per-beat chroma vector for chord detection.
 */

export class AudioCapturer {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx       = null;
    /** @type {AnalyserNode|null} */
    this._analyser  = null;
    this._rafId     = 0;
    this._buffer    = /** @type {Float32Array|null} */ (null);
    this._chromaAcc = new Array(12).fill(0);
    this._beatFrames = 0;
    this._onBeat    = /** @type {Function|null} */ (null);
    this._bpm       = 120;
    this._frameCount = 0;
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {{ onBeat: (chroma: number[]) => void, bpm?: number }} opts
   */
  attach(video, { onBeat, bpm = 120 }) {
    this._onBeat = onBeat;
    this._bpm    = bpm;
    this._ctx    = new AudioContext();
    const src    = this._ctx.createMediaElementSource(video);
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 4096;
    src.connect(this._analyser);
    this._analyser.connect(this._ctx.destination);
    this._buffer = new Float32Array(this._analyser.frequencyBinCount);
    this._beatFrames = Math.round(this._ctx.sampleRate / this._analyser.fftSize * (60 / bpm));
    this._loop();
  }

  detach() {
    cancelAnimationFrame(this._rafId);
    this._ctx?.close();
    this._ctx = null;
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => this._loop());
    if (!this._analyser || !this._buffer) { return; }
    this._analyser.getFloatFrequencyData(this._buffer);
    this._accumulate();
    this._frameCount++;
    if (this._frameCount >= this._beatFrames) {
      const chroma = this._chromaAcc.map(v => v / this._beatFrames);
      this._onBeat?.(chroma);
      this._chromaAcc = new Array(12).fill(0);
      this._frameCount = 0;
    }
  }

  _accumulate() {
    if (!this._buffer || !this._ctx) { return; }
    const sr      = this._ctx.sampleRate;
    const binSize = sr / (this._buffer.length * 2);
    // Map FFT bins to 12 pitch classes
    for (let bin = 1; bin < this._buffer.length; bin++) {
      const freq = bin * binSize;
      if (freq < 20 || freq > 8000) { continue; }
      const pitchClass = Math.round(12 * Math.log2(freq / 16.35)) % 12;
      const energy = Math.pow(10, (this._buffer[bin] + 140) / 20); // dB → linear
      this._chromaAcc[((pitchClass % 12) + 12) % 12] += energy;
    }
  }

  /** Flush the accumulation buffer (e.g., on seek). */
  flush() {
    this._chromaAcc = new Array(12).fill(0);
    this._frameCount = 0;
  }
}
