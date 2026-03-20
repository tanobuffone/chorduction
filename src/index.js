/**
 * @fileoverview Chorduction v7 — Entry point.
 * Wires all modules and initializes the Spicetify extension.
 * @module index
 */

import { loadSettings, saveSettings } from './config.js';
import { Logger }                     from './utils/logger.js';
import { initErrorBoundary }          from './utils/error-boundary.js';
import { CleanupManager }             from './utils/cleanup-manager.js';
import { createCaches }               from './cache/cache-manager.js';
import { ChordDetector }              from './core/chord-detector.js';
import { fetchAudioAnalysis, spotifyIdFromUri } from './providers/analysis-provider.js';
import { fetchLyrics }                from './providers/lyrics-provider-chain.js';
import { getTrackMeta, getAccessToken, registerPlayerListeners } from './platforms/spicetify/player-adapter.js';
import { injectButton }               from './platforms/spicetify/button-injector.js';
import { createPanel }                from './platforms/spicetify/panel.js';
import { SectionDetector }            from './core/section-detector.js';
import { MLDetector }                 from './ml/ml-detector.js';
import { blendResults }               from './ml/blend-strategy.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────
const cfg     = loadSettings();
const log     = new Logger('Chorduction', cfg.debugLevel, cfg.debugConsoleEnabled);
const cleanup = new CleanupManager();
const caches  = createCaches({ ttl: cfg.cacheDurationMs });

initErrorBoundary(log);

// ── Modules ────────────────────────────────────────────────────────────────
const detector  = new ChordDetector({
  minConfidence:       cfg.minConfidence,
  smoothingBeats:      cfg.smoothingBeats,
  chordSimplification: cfg.chordSimplification,
});
const sectionDetector = new SectionDetector();
const mlDetector      = new MLDetector({ logger: log });

/** @type {import('./types.js').AnalysisResult|null} */
let currentAnalysis = null;
let analysisInProgress = false;

// ── Panel ──────────────────────────────────────────────────────────────────
const panel = createPanel({
  config: cfg,
  onSaveConfig(patch) {
    Object.assign(cfg, patch);
    saveSettings(cfg);
  },
  onAnalyze: analyzeCurrentTrack,
  getCurrentAnalysis: () => currentAnalysis,
  getTrackMeta,
});

// ── Analysis pipeline ──────────────────────────────────────────────────────
async function analyzeCurrentTrack() {
  if (analysisInProgress) { return; }
  analysisInProgress = true;
  panel.updateDisplay({ loading: true });

  try {
    const meta    = getTrackMeta();
    const trackId = spotifyIdFromUri(meta.uri);
    if (!trackId) { throw new Error('No track playing'); }

    log.info(`Analyzing: ${meta.title} — ${meta.artist}`);
    log.time('analysis');

    // Fetch analysis + lyrics in parallel
    const [analysis, lyrics] = await Promise.all([
      fetchAudioAnalysis(trackId, {
        accessToken: getAccessToken(),
        cache:       caches.analysis,
        timeoutMs:   cfg.requestTimeoutMs,
        logger:      log,
      }),
      fetchLyrics({
        artist: meta.artist, title: meta.title,
        durationMs: meta.durationMs, trackId,
        cosmosGet: Spicetify?.CosmosAsync?.get?.bind(Spicetify.CosmosAsync),
        cache: caches.lyrics, logger: log,
      }),
    ]);

    if (!analysis) {
      panel.updateDisplay({ loading: false, error: true });
      analysisInProgress = false;
      return;
    }

    // Core chord detection
    const { chords, key, keyConfidence, tempo } = detector.processAnalysis(
      analysis, cfg.transposeSemitones, cfg.chordNotation
    );

    // ML blend (if enabled and model loaded)
    let finalChords = chords;
    if (cfg.useMLDetection) {
      finalChords = await mlDetector.blendChords(chords, analysis.segments ?? []);
    }

    // Section detection
    const sections = cfg.showSections
      ? sectionDetector.detect(analysis.segments ?? [], { tempo, duration: analysis.track?.duration })
      : [];

    // Sync lyrics to chords
    const syncedChords = _syncLyrics(finalChords, lyrics);

    currentAnalysis = {
      chords: syncedChords, key, keyConfidence, tempo,
      timeSignature: `${analysis.track?.time_signature ?? 4}/4`,
      sections, lyrics, trackId,
      analyzedAt: Date.now(),
    };

    log.timeEnd('analysis');
    log.info(`Done: ${syncedChords.length} chords, key ${key}, ${sections.length} sections`);

    panel.updateDisplay({ chords: syncedChords, sections, loading: false, error: false });

  } catch (e) {
    log.error('Analysis failed:', e);
    panel.updateDisplay({ loading: false, error: true });
  } finally {
    analysisInProgress = false;
  }
}

/** @param {import('./types.js').ChordResult[]} chords @param {import('./types.js').LyricsLine[]} lyrics */
function _syncLyrics(chords, lyrics) {
  if (!lyrics.length) { return chords; }
  return chords.map(chord => {
    const line = lyrics.find(l => l.startMs >= chord.startMs) ?? lyrics[lyrics.length - 1];
    return { ...chord, lyric: line?.text ?? null };
  });
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
if (cfg.enableKeyboardShortcuts) {
  cleanup.addListener(document, 'keydown', /** @param {KeyboardEvent} e */ (e) => {
    if (e.altKey && e.key === 't') { panel.open(); }
    if (e.altKey && e.key === 'ArrowUp') {
      cfg.transposeSemitones = Math.min(12, cfg.transposeSemitones + 1);
      saveSettings(cfg); analyzeCurrentTrack();
    }
    if (e.altKey && e.key === 'ArrowDown') {
      cfg.transposeSemitones = Math.max(-12, cfg.transposeSemitones - 1);
      saveSettings(cfg); analyzeCurrentTrack();
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  try {
    log.info(`Chorduction v${__VERSION__} initializing…`);
    await _waitForSpicetify();

    // Register in Spicetify Menu / Topbar
    if (Spicetify?.Menu?.register) {
      try { Spicetify.Menu.register('🎸 Chorduction', () => panel.open()); } catch { /* ignore */ }
    }

    // Inject player button
    injectButton(() => panel.open(), cleanup, log);

    // Player event listeners
    registerPlayerListeners(cleanup, {
      onTrackChange: () => { if (cfg.autoAnalyze) { analyzeCurrentTrack(); } },
      onPlayPause:   () => {},
    });

    // Initial analysis
    cleanup.addTimer(setTimeout(analyzeCurrentTrack, 1500));

    // Lazy-load ML model (non-blocking)
    if (cfg.useMLDetection) {
      mlDetector.loadModel().catch(e => log.warn('[ML] Model load failed:', e.message));
    }

    log.info('Chorduction initialized. Press Alt+T to open.');
  } catch (e) {
    log.error('Init failed:', e);
  }
}

async function _waitForSpicetify(timeoutMs = 20000) {
  const start = Date.now();
  while (!(window.Spicetify?.Player && (Spicetify.PopupModal || Spicetify.Platform))) {
    if (Date.now() - start > timeoutMs) { throw new Error('Spicetify not ready'); }
    await new Promise(r => setTimeout(r, 200));
  }
}

// Cleanup on unload
window.addEventListener('unload', () => cleanup.cleanup());

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
