# Changelog

All notable changes to Chorduction are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), versioning follows [Semantic Versioning](https://semver.org/).

---

## [6.3.0] — 2026-03-21

### Fixed
- **Fretboard tooltip**: Now shows for ALL chords (Am7, G7, Dm7, etc.), not just the ~12 chords in the fingerings dict. Tooltip always displays chord name + scale notes (e.g. `A · C · E`); fretboard diagram appears when available and enabled
- **Chord complexity selector**: Now actually re-renders when changed — was saving config but not applying it
- **Prev button**: Now restarts current song (`seek(0)`) instead of seeking to previous chord. If within first 3s, skips to previous track (standard media player behavior)
- **Next button**: Now skips to next track instead of next chord

### Added
- **Re-analyze button** (🔄): Clears cache and re-triggers analysis for the current song — useful when audio data fails to load initially
- **`getChordNotes()`**: Helper that computes the notes in any chord (major, minor, 7th, maj7, dim, aug, sus, m7b5, etc.) using interval arithmetic — shown in hover tooltip
- **`consolidateChords(level)`**: Applies chord simplification — Level 1 strips all extensions (Am7→Am, Cmaj7→C) and merges chords < 2s; Level 2 keeps 7ths but strips higher extensions and merges < 1s; Level 3 keeps all with < 0.5s merge minimum
- **`SmartCache.delete(key)`**: Public delete method on SmartCache, used by re-analyze to invalidate a specific track

---

## [6.1.0] — 2026-03-20

### Fixed
- **429 rate-limit detection**: CosmosAsync returns `{code:429}` (not `{status:429}`) — updated all detection paths
- **Stale DOM reference**: `analyzeCurrentTrack` captured `display` once at start; if panel was reopened a new element was created but updates went to the detached old one — replaced with dynamic getter `getDisplay()` called at each update point
- **Double init**: `chorduction.js` was listed twice in Spicetify config (`.\chorduction.js` + `chorduction.js`), causing two simultaneous analyses per track change
- **`onplaypause` re-analysis loop**: `onplaypause` fired immediately after `ontrackchange` finished, restarting analysis and overwriting "Audio Analysis Unavailable" with "Analyzing track..." in a loop
- **Debounce**: Added 2s debounce + `lastAttemptedTrackId` guard to prevent concurrent analysis calls
- **Non-track URI handling**: Podcasts, local files, and ads now exit silently instead of throwing "Invalid track URI"
- **Panel reopen state**: Opening the panel now shows existing `currentAnalysis` immediately, or triggers fresh analysis with debounce reset

### Added
- 30-second countdown with user-visible `⏳ Spotify rate limit — retrying in Xs…` message via `onStatus` callback
- Automatic retry after rate-limit wait (1 retry, then shows "Audio Analysis Unavailable")
- Track-change detection during rate-limit wait — aborts countdown and resets if song changes
- "Audio Analysis Unavailable" UI with "Add Chords Manually" button as fallback when API is blocked
- Debug log for CosmosAsync response body on unexpected returns

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
