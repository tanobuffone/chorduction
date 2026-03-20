# Chorduction

> Real-time chord detection, lyrics synchronization, and music analysis — directly inside Spotify.

[![Version](https://img.shields.io/badge/version-6.0.0-1db954.svg)](https://github.com/user/chorduction/releases)
[![Spicetify](https://img.shields.io/badge/Spicetify-Compatible-1ed760.svg)](https://spicetify.app)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-64%20passing-brightgreen.svg)](tests/)
[![CI](https://github.com/user/chorduction/actions/workflows/ci.yml/badge.svg)](https://github.com/user/chorduction/actions)

Chorduction is a [Spicetify](https://spicetify.app) extension that brings professional-grade chord analysis to the Spotify desktop client. It uses chroma vector analysis and the Krumhansl-Schmuckler algorithm to detect chords and keys in real time, synchronized with lyrics, and lets you export results in multiple formats.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Export Formats](#export-formats)
- [Technical Details](#technical-details)
- [Development](#development)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Chord Detection
- Real-time chord recognition via 12-dimensional chroma vector analysis
- Key detection using the Krumhansl-Schmuckler algorithm
- Chord types: major, minor, 7th, diminished, augmented
- Per-chord confidence scoring with configurable threshold
- Beat-window smoothing (configurable, default: 3 beats)

### Lyrics Synchronization
- Per-line synced lyrics aligned to chord timestamps
- Multi-provider fallback system:
  1. Spotify Internal (`hm://color-lyrics`)
  2. [LRCLIB](https://lrclib.net) (primary external source)
  3. Spotify Lyrics API (secondary fallback)

### Transposing
- Real-time transposition ±12 semitones
- Preserves chord quality (major/minor/extensions) through all shifts
- Keyboard shortcuts: `Alt+↑` / `Alt+↓`

### Chord Notations
Four notation systems selectable at runtime:

| Format | Example |
|--------|---------|
| Standard | `C`, `Dm`, `G7` |
| Nashville | `1`, `2m`, `57` |
| Solfege | `Do`, `Rem`, `Sol7` |
| Roman Numerals | `I`, `ii`, `V7` |

### Export Formats
- **TXT** — human-readable chord sheet with timestamps
- **JSON** — structured data with full metadata for apps and tools
- **ChordPro** — industry-standard song sheet format (`.cho`)

### Fretboard Diagrams
- SVG guitar chord diagrams rendered inline
- Common fingerings for major and minor chords
- Updates in real time with transposition

---

## Installation

### Requirements
- [Spicetify](https://spicetify.app) installed and configured
- Spotify Desktop Client (web player has CORS limitations)

### Via Spicetify Marketplace *(coming soon)*
1. Open Spotify → Spicetify Marketplace
2. Search `Chorduction`
3. Click **Install**

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/user/chorduction.git

# Copy the extension to Spicetify
cp chorduction/chorduction.js ~/.spicetify/Extensions/

# Apply to Spotify
spicetify apply
```

**Windows (PowerShell):**
```powershell
Copy-Item chorduction\chorduction.js "$env:APPDATA\spicetify\Extensions\"
spicetify apply
```

---

## Usage

### Opening the Panel
- **Keyboard:** `Alt+T`
- **Button:** Click the guitar icon (🎸) in the player controls bar
- **Menu:** Spicetify right-click menu → Chorduction

### Analyzing a Track
1. Play any track in Spotify
2. Open the Chorduction panel
3. The extension automatically fetches and displays the chord progression, key, and tempo
4. Lyrics with timestamps appear below if available

### Manual Chord Entry
If the audio analysis API is unavailable or returns insufficient data, you can enter chords manually using the inline input. Manual entries are exported along with detected chords.

---

## Configuration

All settings are persisted in `localStorage` under the key `chorduction-settings-v6`.

Access the settings panel by clicking **Settings** inside the Chorduction modal.

| Setting | Default | Description |
|---------|---------|-------------|
| `CHORD_NOTATION` | `standard` | Notation format: standard, nashville, solfege, roman |
| `SMOOTHING_BEATS` | `3` | Beat window for chord smoothing |
| `MIN_CONFIDENCE` | `0.1` | Minimum confidence threshold (0–1) |
| `CHORD_SIMPLIFICATION` | `1` | Chord complexity: 1=basic, 2=intermediate, 3=advanced |
| `TRANSPOSE_SEMITONES` | `0` | Active transposition offset (±12) |
| `SHOW_LYRICS` | `true` | Display synced lyrics |
| `SHOW_FRETBOARD` | `true` | Display fretboard diagram |
| `AUTO_ANALYZE` | `true` | Automatically analyze on track change |
| `CACHE_DURATION_MS` | `600000` | Cache TTL in milliseconds (default: 10 min) |
| `REQUEST_TIMEOUT_MS` | `15000` | API request timeout in milliseconds |
| `DEBUG_LEVEL` | `INFO` | Log verbosity: TRACE, DEBUG, INFO, WARN, ERROR, OFF |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+T` | Open / close Chorduction panel |
| `Alt+↑` | Transpose up one semitone |
| `Alt+↓` | Transpose down one semitone |

Shortcuts can be disabled individually in Settings.

---

## Export Formats

### TXT
```
# Song Title - Artist Name
# Key: C Major  |  Tempo: 120 BPM
# Chorduction v6.0.0

[0:00] C
[0:04] G
[0:08] Am
[0:12] F
```

### JSON
```json
{
  "meta": {
    "title": "Song Title",
    "artist": "Artist Name",
    "key": "C",
    "tempo": 120,
    "version": "6.0.0",
    "exportedAt": "2026-03-20T00:00:00Z"
  },
  "chords": [
    { "time": 0, "chord": "C", "confidence": 0.92 },
    { "time": 4, "chord": "G", "confidence": 0.88 }
  ]
}
```

### ChordPro
```
{title: Song Title}
{artist: Artist Name}
{key: C}
{tempo: 120}

[C]First line of [G]lyrics here
[Am]Second line [F]continues
```

---

## Technical Details

### Architecture

Chorduction is a single-file extension (`chorduction.js`, ~2000 lines) organized into independent modules:

```
GlobalErrorBoundary        — crash prevention, unhandled promise rejection
Settings                   — LocalStorage persistence, config validation
Logger                     — debug console overlay (6 levels)
SmartCache                 — LRU eviction + TTL + access-frequency scoring
Transposer                 — pitch shifting (±12 semitones)
ChordNotation              — 4 notation format converters
FileExporter               — TXT / JSON / ChordPro file generation
ChordDetector              — main analysis class
  ├─ Krumhansl-Schmuckler  — key detection via profile correlation
  ├─ Chroma analysis       — cosine similarity chord template matching
  └─ Beat smoothing        — configurable window for stability
UI Components              — Modal, player buttons, fretboard SVG
CleanupManager             — proper resource and event listener teardown
```

### Chord Detection Algorithm

1. Fetch audio analysis from Spotify (`/v1/audio-analysis/{id}`)
2. Extract per-segment 12-dimensional chroma vectors
3. Compute cosine similarity between each chroma vector and chord templates
4. Apply beat-window smoothing over `SMOOTHING_BEATS` consecutive beats
5. Assign confidence scores; filter by `MIN_CONFIDENCE`
6. Pass results through `Transposer` and `ChordNotation` for final display

**Chord templates** are binary vectors marking the root, third, and fifth of each chord type:
```
C Major:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]
A Minor:  [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]
```

### Key Detection (Krumhansl-Schmuckler)

1. Aggregate chroma vectors from the first 30 seconds of the track
2. Compute Pearson correlation with 24 major and minor key profiles
3. Return the key with the highest correlation and a confidence score

### Caching Strategy

Three independent `SmartCache` instances with LRU + frequency-scored eviction:

| Cache | TTL | Max Entries | Content |
|-------|-----|-------------|---------|
| `analysisCache` | 10 min | 20 | Spotify audio analysis responses |
| `lyricsCache` | 10 min | 20 | Lyrics provider responses |
| `timelineCache` | 10 min | 20 | Pre-processed chord timelines |

### Performance

| Metric | Value |
|--------|-------|
| Analysis latency | ~2–3 s (API-bound) |
| Memory footprint | ~5 MB |
| Cache hit rate | ~85% |
| Binary segment lookup | O(log n) |
| Extension file size | 75.6 KB (unminified) |

---

## Development

### Prerequisites
- Node.js ≥ 18
- npm

### Setup

```bash
git clone https://github.com/user/chorduction.git
cd chorduction
npm install
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

### Test Suite

| Suite | Tests | Description |
|-------|-------|-------------|
| `chorduction.test.js` | 24 | Unit tests: Transposer, ChordNotation, FileExporter, SmartCache, ChordDetector |
| `analysis-flow.test.js` | 8 | End-to-end analysis pipeline |
| `export-flow.test.js` | 11 | All three export formats |
| `cache-integration.test.js` | 8 | Cache behavior under load |
| `degradation.test.js` | 13 | Graceful degradation scenarios |
| **Total** | **64** | **All passing** |

### CI/CD

GitHub Actions runs on every push and pull request:
- Tests on Node.js 18, 20, 21
- Coverage report upload
- Automatic release on version tags

---

## Project Structure

```
chorduction/
├── chorduction.js                  # Main extension (~2000 lines)
├── package.json                    # Project config and Jest setup
├── package-lock.json
├── README.md
├── CHANGELOG.md                    # Version history
├── CONTRIBUTING.md                 # Contribution guidelines
├── LICENSE
│
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions pipeline
│
├── tests/
│   ├── chorduction.test.js         # 24 unit tests
│   └── integration/
│       ├── analysis-flow.test.js
│       ├── export-flow.test.js
│       ├── cache-integration.test.js
│       └── degradation.test.js
│
├── docs/
│   ├── ROADMAP.md                  # Versioned feature roadmap
│   ├── ARCHITECTURE.md             # Deep-dive architecture guide
│   └── research-competitors.md     # Competitive analysis
│
├── memory-bank/                    # Internal project documentation
│   ├── projectbrief.md
│   ├── techContext.md
│   └── progress.md
│
└── deprecated/                     # Legacy versions (v1–v5)
    └── DEPRECATION.md
```

---

## Roadmap

| Version | Target | Highlights |
|---------|--------|-----------|
| **v6.1.0** | April 2026 | DOM selector fixes, sidebar button fallback, better UX errors |
| **v7.0.0** | June 2026 | Modular architecture, TypeScript, ML chord detection, YouTube, section labels |
| **v8.0.0** | December 2026 | Playlist analysis, key-change detection, collaboration, mobile companion |

See [docs/ROADMAP.md](docs/ROADMAP.md) for the complete plan.

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

Quick start:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Ensure all tests pass: `npm test`
5. Open a pull request against `main`

---

## Known Limitations

- **CORS in web player:** Spotify Web API requests are blocked by CORS outside the desktop client. Use Spotify Desktop for full functionality.
- **Chord accuracy:** ~70% typical confidence. Complex jazz harmonies, non-Western scales, and heavily processed audio may yield lower accuracy.
- **Rate limits:** Rapid track changes can trigger Spotify API 429 responses. The extension falls back to cached data or manual entry.
- **Spicetify version fragility:** DOM selector logic includes multiple fallback strategies to accommodate Spotify UI changes across versions.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Spicetify](https://spicetify.app) — the Spotify mod framework that makes this possible
- [LRCLIB](https://lrclib.net) — open, free synced lyrics database
- Krumhansl & Schmuckler — key-finding algorithm (1990)
- The music theory community for chord template references
