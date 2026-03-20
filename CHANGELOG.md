# Changelog

All notable changes to Chorduction are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — v6.1.0

### Fixed
- DOM selector fragility across Spotify UI versions (multiple fallback strategies)
- Keyboard shortcut registration timing on Spicetify load

### Added
- Sidebar button as fallback when player controls injection fails
- Improved user-facing error messages with actionable suggestions
- Fretboard diagrams for dominant 7th chords

---

## [6.0.0] — 2026-02-19

### Added
- **FileExporter module** — export chord progressions as TXT, JSON, or ChordPro (`.cho`)
- **Unified codebase** — merged improvements from v1–v5 into a single maintained file
- **SmartCache** — LRU eviction with access-frequency scoring across 3 independent caches
- **GlobalErrorBoundary** — top-level crash prevention with unhandled promise rejection handling
- **CleanupManager** — proper teardown of event listeners and DOM nodes on extension unload
- **GitHub Actions CI/CD** — automated testing on Node.js 18, 20, 21 with coverage upload
- **Integration test suite** — 40 new tests covering analysis flow, export, cache, and degradation
- **Competitor research document** — analysis of Chordify, Scaler 3, and Chrome extensions
- **Roadmap** — versioned feature plan through v8.0.0
- **Deprecation notes** — documented all 12 legacy versions

### Changed
- Settings key updated to `chorduction-settings-v6` (breaking: clears v5 settings on first run)
- Cache TTL default increased from 5 min to 10 min
- Chord confidence threshold default lowered from 0.15 to 0.10 for better coverage

### Fixed
- Race condition in lyrics provider fallback chain
- Memory leak in fretboard SVG element creation
- Incorrect Roman numeral case for diminished chords

---

## [5.0.0] — 2026-01-15

### Added
- Comprehensive error handling with graceful API degradation
- Manual chord entry fallback when analysis is unavailable
- API rate limit detection and exponential backoff

### Fixed
- CORS fallback for Spotify Lyrics endpoint
- Button placement retry logic with increasing delays

---

## [4.0.0] — 2025-12-10

### Added
- **ChordNotation module** — Nashville, Solfege, and Roman numeral notation
- Notation selector in settings panel
- Internationalization groundwork (English, Spanish)

---

## [3.0.0] — 2025-11-05

### Added
- **Transposer module** — real-time transposition ±12 semitones
- `Alt+↑` / `Alt+↓` keyboard shortcuts for transposing
- Graceful handling of unrecognized chord names in transposition

---

## [2.0.0] — 2025-10-01

### Added
- **Lyrics synchronization** — per-line timestamps from LRCLIB
- Multi-provider fallback: Spotify internal → LRCLIB → Spotify Lyrics API
- Per-chord lyrics alignment display

---

## [1.0.0] — 2025-09-01

### Added
- Initial release
- Real-time chord detection via chroma vector analysis
- Key detection using Krumhansl-Schmuckler algorithm
- Fretboard SVG diagram for current chord
- Debug console overlay with configurable log levels
- Settings panel with LocalStorage persistence
