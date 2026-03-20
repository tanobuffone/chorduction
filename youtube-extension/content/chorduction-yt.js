/**
 * @fileoverview Chorduction YouTube content script — entry point.
 * Injected into youtube.com/watch pages.
 */

// Core logic is bundled inline (from @chorduction/core via esbuild)
// In the build step, this file imports from ../../src/core/ — same modules as Spicetify extension

import { ChordDetector }    from '../../src/core/chord-detector.js';
import { SectionDetector }  from '../../src/core/section-detector.js';
import { AudioCapturer }    from './audio-capturer.js';
import { getYouTubeMeta, fetchYouTubeCaptions, fetchLRCLIBFallback } from './caption-provider.js';
import { binarySearchTime } from '../../src/utils/math.js';

const detector       = new ChordDetector({ smoothingBeats: 5 }); // slower, more stable for live
const sectionDetector = new SectionDetector();

let capturer   = /** @type {AudioCapturer|null} */ (null);
let overlay    = /** @type {HTMLElement|null} */ (null);
let timeline   = /** @type {Array<{startMs:number, chord:string, lyric?:string}>} */ ([]);
let lyrics     = /** @type {Array<{startMs:number, text:string}>} */ ([]);
let chromaBuffer = /** @type {Array<{start:number, duration:number, pitches:number[]}>} */ ([]);

// ── Wait for video element ──────────────────────────────────────────────────
function init() {
  const video = /** @type {HTMLVideoElement|null} */ (document.querySelector('video'));
  if (!video) { setTimeout(init, 500); return; }

  createOverlay();
  attachAudio(video);
  loadLyrics(video);

  video.addEventListener('seeking', () => { chromaBuffer = []; timeline = []; capturer?.flush(); });
  video.addEventListener('timeupdate', () => { syncOverlay(video.currentTime * 1000); });
}

// ── Overlay UI ─────────────────────────────────────────────────────────────
function createOverlay() {
  overlay?.remove();
  overlay = document.createElement('div');
  overlay.id = 'chorduction-yt-overlay';
  overlay.style.cssText = `
    position:fixed; bottom:80px; right:20px; z-index:9999;
    background:rgba(0,0,0,0.75); color:#fff; padding:10px 16px;
    border-radius:8px; font-family:monospace; font-size:14px;
    pointer-events:none; min-width:120px; text-align:center;
    border:1px solid #1db954;
  `;
  overlay.innerHTML = '<div style="color:#888;font-size:11px">🎸 Chorduction</div><div id="cyt-chord">—</div>';
  document.body.appendChild(overlay);
}

function updateOverlayChord(chord, lyric) {
  const el = document.getElementById('cyt-chord');
  if (el) {
    el.style.cssText = 'font-size:22px;font-weight:bold;color:#1db954';
    el.textContent   = chord;
  }
  const lyricEl = overlay?.querySelector('#cyt-lyric');
  if (lyric && overlay) {
    if (!lyricEl) {
      const d = document.createElement('div');
      d.id = 'cyt-lyric';
      d.style.cssText = 'font-size:11px;color:#ccc;margin-top:4px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      overlay.appendChild(d);
    }
    /** @type {HTMLElement} */ (overlay.querySelector('#cyt-lyric')).textContent = lyric;
  }
}

function syncOverlay(currentMs) {
  if (!timeline.length) { return; }
  const idx   = binarySearchTime(timeline.map(t => ({ start: t.startMs / 1000, duration: 4 })), currentMs / 1000);
  const entry = timeline[idx];
  if (entry) { updateOverlayChord(entry.chord, entry.lyric ?? ''); }
}

// ── Audio capture + chord detection ───────────────────────────────────────
function attachAudio(video) {
  capturer = new AudioCapturer();
  capturer.attach(video, {
    bpm: 120, // will be refined once we have analysis
    onBeat(chroma) {
      const video2 = /** @type {HTMLVideoElement} */ (document.querySelector('video'));
      const tSec   = video2?.currentTime ?? 0;
      // Accumulate segments for section detection
      chromaBuffer.push({ start: tSec, duration: 0.5, pitches: chroma });
      // Detect chord for this beat
      const { chord, confidence } = detector.detectChord(chroma);
      if (confidence > 0.15) {
        const startMs = tSec * 1000;
        // Find matching lyric
        const lyricEntry = lyrics.find(l => l.startMs >= startMs) ?? null;
        timeline.push({ startMs, chord, lyric: lyricEntry?.text });
        if (timeline.length > 2000) { timeline.splice(0, 500); } // cap memory
      }
    },
  });
}

// ── Lyrics ─────────────────────────────────────────────────────────────────
async function loadLyrics(video) {
  const meta = getYouTubeMeta();
  // Try YouTube captions first
  lyrics = await fetchYouTubeCaptions('en');
  if (!lyrics.length) {
    const dur = (video.duration || 0) * 1000;
    lyrics = await fetchLRCLIBFallback(meta.artist, meta.title, dur);
  }
}

// ── Popup messaging ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_CURRENT_CHORD') {
    const video = /** @type {HTMLVideoElement|null} */ (document.querySelector('video'));
    const currentMs = (video?.currentTime ?? 0) * 1000;
    const idx   = timeline.length ? binarySearchTime(timeline.map(t => ({ start: t.startMs / 1000, duration: 4 })), currentMs / 1000) : -1;
    const entry = idx >= 0 ? timeline[idx] : null;
    sendResponse(entry ? { chord: entry.chord, confidence: 0.8, lyric: entry.lyric ?? '' } : null);
  }
  if (msg.type === 'UPDATE_SETTINGS') {
    const { showOverlay, showLyrics } = msg.payload ?? {};
    if (overlay) { overlay.style.display = showOverlay === false ? 'none' : ''; }
    const lyricEl = overlay?.querySelector('#cyt-lyric');
    if (lyricEl) { /** @type {HTMLElement} */ (lyricEl).style.display = showLyrics === false ? 'none' : ''; }
  }
  return false;
});

// ── SPA navigation detection ───────────────────────────────────────────────
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    if (location.pathname === '/watch') {
      timeline = []; chromaBuffer = []; lyrics = [];
      capturer?.detach(); capturer = null;
      setTimeout(init, 800);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// Start
init();
