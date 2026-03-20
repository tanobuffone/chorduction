/**
 * @fileoverview Internationalization strings.
 * @module utils/i18n
 */

export const TRANSLATIONS = {
  en: {
    title: 'Chorduction',
    analyzing: 'Analyzing track…',
    noData: 'No synced lyrics or chord data available.',
    audioUnavailable: 'Audio Analysis Unavailable',
    audioUnavailableHint: "Spotify's audio analysis API is rate-limited or blocked. You can enter chords manually.",
    addChordsManually: 'Add Chords Manually',
    manualOverride: 'Edit',
    confidence: 'Confidence: {0}%',
    notation: 'Notation:',
    standard: 'Standard',
    nashville: 'Nashville',
    solfege: 'Solfege',
    roman: 'Roman Numerals',
    transpose: 'Transpose',
    showLyrics: 'Show Lyrics',
    showFretboard: 'Show Fretboard',
    autoAnalyze: 'Auto-analyze on track change',
    showSections: 'Show section labels',
    useML: 'Use ML detection (experimental)',
    instrument: 'Instrument:',
    guitar: 'Guitar',
    ukulele: 'Ukulele',
    piano: 'Piano',
    bass: 'Bass',
    exportAs: 'Export:',
    settingsTitle: 'Settings',
    section_intro: 'INTRO',
    section_verse: 'VERSE',
    section_chorus: 'CHORUS',
    section_bridge: 'BRIDGE',
    section_outro: 'OUTRO',
    section_unknown: 'SECTION',
  },
  es: {
    title: 'Chorduction',
    analyzing: 'Analizando pista…',
    noData: 'No hay letras ni acordes disponibles.',
    audioUnavailable: 'Análisis de Audio No Disponible',
    audioUnavailableHint: 'La API de análisis de audio de Spotify está bloqueada. Podés ingresar los acordes manualmente.',
    addChordsManually: 'Agregar Acordes Manualmente',
    manualOverride: 'Editar',
    notation: 'Notación:',
    standard: 'Estándar',
    nashville: 'Nashville',
    solfege: 'Solfeo',
    roman: 'Números Romanos',
    transpose: 'Transponer',
    showLyrics: 'Mostrar Letras',
    showFretboard: 'Mostrar Diagrama',
    autoAnalyze: 'Analizar automáticamente',
    showSections: 'Mostrar secciones',
    useML: 'Usar detección ML (experimental)',
    instrument: 'Instrumento:',
    guitar: 'Guitarra',
    ukulele: 'Ukulele',
    piano: 'Piano',
    bass: 'Bajo',
    exportAs: 'Exportar:',
    settingsTitle: 'Configuración',
    section_intro: 'INTRO',
    section_verse: 'VERSO',
    section_chorus: 'CORO',
    section_bridge: 'PUENTE',
    section_outro: 'OUTRO',
    section_unknown: 'SECCIÓN',
  },
};

/**
 * Get a translated string, interpolating positional args {0}, {1}, etc.
 * @param {string} key
 * @param {string} lang
 * @param {...string} args
 * @returns {string}
 */
export function t(key, lang = 'en', ...args) {
  const map = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const text = map[key] ?? TRANSLATIONS.en[key] ?? key;
  return args.length ? text.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? '') : text;
}
