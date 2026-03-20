/**
 * @fileoverview Default configuration and settings persistence for Chorduction v7.
 * @module config
 */

/** @type {import('./types.js').ChorductionSettings} */
export const DEFAULT_CONFIG = {
  debugLevel:          'INFO',
  debugConsoleEnabled: false,
  smoothingBeats:      3,
  showLyrics:          true,
  minConfidence:       0.1,
  syncOffsetMs:        50,
  chordSimplification: 1,           // 1=basic, 2=7ths, 3=full extensions
  cacheDurationMs:     10 * 60 * 1000,
  requestTimeoutMs:    15000,
  retryAttempts:       2,
  enableKeyboardShortcuts: true,
  language:            'en',
  lyricsProvider:      'lrclib',
  autoAnalyze:         true,
  showFretboard:       true,
  groupByMeasure:      true,
  beatsPerMeasure:     4,
  transposeSemitones:  0,
  maxTranspose:        12,
  chordNotation:       'standard',  // standard | nashville | solfege | roman
  showConfidence:      true,
  confidenceThreshold: 0.3,
  enableManualOverride: true,
  // v7 new
  instrument:          'guitar',    // guitar | ukulele | piano | bass
  showSections:        true,
  useMLDetection:      true,
};

const STORAGE_KEY = 'chorduction-settings-v7';
const LEGACY_KEY  = 'chorduction-settings-v6';

/**
 * Migrate v6 settings keys to v7 format.
 * @param {Object} v6
 * @returns {Partial<import('./types.js').ChorductionSettings>}
 */
function migrateFromV6(v6) {
  return {
    chordNotation:       v6.CHORD_NOTATION        ?? DEFAULT_CONFIG.chordNotation,
    smoothingBeats:      v6.SMOOTHING_BEATS        ?? DEFAULT_CONFIG.smoothingBeats,
    minConfidence:       v6.MIN_CONFIDENCE         ?? DEFAULT_CONFIG.minConfidence,
    transposeSemitones:  v6.TRANSPOSE_SEMITONES    ?? DEFAULT_CONFIG.transposeSemitones,
    showLyrics:          v6.SHOW_LYRICS            ?? DEFAULT_CONFIG.showLyrics,
    showFretboard:       v6.SHOW_FRETBOARD_DIAGRAMS ?? DEFAULT_CONFIG.showFretboard,
    autoAnalyze:         v6.AUTO_REFRESH_ON_SONG_CHANGE ?? DEFAULT_CONFIG.autoAnalyze,
    debugLevel:          v6.DEBUG_LEVEL            ?? DEFAULT_CONFIG.debugLevel,
    language:            v6.LANGUAGE               ?? DEFAULT_CONFIG.language,
    instrument:          'guitar',
    showSections:        true,
    useMLDetection:      true,
  };
}

/**
 * Load settings from localStorage, migrating from v6 if needed.
 * @returns {import('./types.js').ChorductionSettings}
 */
export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateFromV6(JSON.parse(legacy));
      saveSettings({ ...DEFAULT_CONFIG, ...migrated });
      return { ...DEFAULT_CONFIG, ...migrated };
    }
  } catch (_e) { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

/**
 * Persist settings to localStorage.
 * @param {import('./types.js').ChorductionSettings} settings
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_e) { /* ignore */ }
}
