/**
 * @fileoverview Shared type definitions for Chorduction v7.
 * All cross-module objects are typed here via JSDoc @typedef.
 */

/**
 * A 12-element pitch-class chroma vector from Spotify Audio Analysis.
 * @typedef {Object} ChromaVector
 * @property {number[]} pitches    - 12 floats [0..1], energy per chromatic pitch class (C=0 … B=11)
 * @property {number}   duration   - Segment duration in seconds
 * @property {number}   start      - Segment start time in seconds
 * @property {number}   confidence - Spotify-reported confidence [0..1]
 * @property {number}   [loudness_max] - Peak loudness in dB
 */

/**
 * A detected chord with timing and confidence metadata.
 * @typedef {Object} ChordResult
 * @property {string}  chord       - Chord name in the current notation/transposition
 * @property {string}  rawChord    - Chord name without transposition or notation conversion
 * @property {number}  confidence  - Detection confidence [0..1]
 * @property {number}  startMs     - Start time in milliseconds
 * @property {number}  endMs       - End time in milliseconds
 * @property {string}  [lyric]     - Associated lyric line (if synced)
 * @property {string}  [source]    - Detection source: 'chroma' | 'ml' | 'blend' | 'manual'
 */

/**
 * A structural section of the song.
 * @typedef {Object} SectionLabel
 * @property {'intro'|'verse'|'chorus'|'bridge'|'outro'|'unknown'} type
 * @property {number} startTime        - Start time in seconds
 * @property {number} endTime          - End time in seconds
 * @property {number} repetitionIndex  - 1-based count of how many times this section has appeared
 */

/**
 * A time-stamped lyric line.
 * @typedef {Object} LyricsLine
 * @property {number} startMs  - Start time in milliseconds
 * @property {string} text     - Lyric text
 * @property {string} [chord]  - Chord name at this line (if synced)
 */

/**
 * Full result of a track analysis.
 * @typedef {Object} AnalysisResult
 * @property {ChordResult[]}  chords
 * @property {string}         key           - e.g. "C", "F#m"
 * @property {number}         keyConfidence - [0..1]
 * @property {number}         tempo         - BPM
 * @property {string}         timeSignature - e.g. "4/4"
 * @property {SectionLabel[]} sections
 * @property {LyricsLine[]}   lyrics
 * @property {string}         trackId
 * @property {number}         analyzedAt    - Unix timestamp ms
 */

/**
 * Data passed to file exporters.
 * @typedef {Object} ExportData
 * @property {Object}         meta
 * @property {string}         meta.title
 * @property {string}         meta.artist
 * @property {string}         meta.key
 * @property {number}         meta.tempo
 * @property {string}         meta.version
 * @property {string}         meta.exportedAt  - ISO 8601
 * @property {ChordResult[]}  chords
 * @property {SectionLabel[]} [sections]
 * @property {LyricsLine[]}   [lyrics]
 */

/**
 * Settings object persisted in localStorage.
 * @typedef {Object} ChorductionSettings
 * @property {string}  chordNotation       - 'standard'|'nashville'|'solfege'|'roman'
 * @property {number}  smoothingBeats      - Beat window for chord smoothing
 * @property {number}  minConfidence       - Min confidence threshold [0..1]
 * @property {number}  transposeSemitones  - Active transpose offset (−12..12)
 * @property {boolean} showLyrics
 * @property {boolean} showFretboard
 * @property {boolean} autoAnalyze
 * @property {string}  debugLevel          - 'TRACE'|'DEBUG'|'INFO'|'WARN'|'ERROR'|'OFF'
 * @property {string}  language            - 'en'|'es'
 * @property {string}  instrument          - 'guitar'|'ukulele'|'piano'|'bass'
 * @property {boolean} showSections
 * @property {boolean} useMLDetection
 * @property {number}  cacheDurationMs
 * @property {number}  requestTimeoutMs
 */

export {};
