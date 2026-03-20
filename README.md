# Chorduction

> Real-time chord detection, lyrics sync, and music analysis — inside Spotify and YouTube.

[![Version](https://img.shields.io/badge/version-7.0.0-1db954.svg)](https://github.com/tanobuffone/chorduction/releases)
[![Spicetify](https://img.shields.io/badge/Spicetify-Compatible-1ed760.svg)](https://spicetify.app)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-290%20passing-brightgreen.svg)](tests/)
[![CI](https://github.com/tanobuffone/chorduction/actions/workflows/ci.yml/badge.svg)](https://github.com/tanobuffone/chorduction/actions)

Chorduction brings professional-grade chord analysis to the Spotify desktop client and YouTube — completely free and open source. It detects chords in real time, synchronizes them with lyrics, shows fretboard diagrams for guitar/ukulele/piano/bass, and exports results to TXT, JSON, or ChordPro.

---

## Table of Contents

- [Features](#features)
- [Quick Install — Spotify](#quick-install--spotify-desktop)
- [Quick Install — YouTube](#quick-install--youtube)
- [Usage](#usage)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Export Formats](#export-formats)
- [Development](#development)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| | |
|---|---|
| 🎸 **Chord detection** | Real-time chroma vector analysis + optional ML (TF.js CNN) |
| 🎵 **Section detection** | Automatic verse / chorus / bridge / intro / outro labels |
| 🎤 **Lyrics sync** | Per-line lyrics aligned to chord timestamps |
| 🔑 **Key detection** | Krumhansl-Schmuckler algorithm |
| 🎛 **Transpose** | ±6 semitones in real time |
| 🔢 **4 notations** | Standard · Nashville · Solfège · Roman numerals |
| 🎼 **Fretboard diagrams** | Guitar · Ukulele · Piano · Bass (SVG, responsive) |
| 💾 **Export** | TXT · JSON (schema v2) · ChordPro |
| 📺 **YouTube** | Chrome extension — Web Audio API, no CORS issues |

---

## Quick Install — Spotify Desktop

### Step 1 — Install Spicetify (if you haven't already)

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh | sh
```

**Windows (PowerShell as Administrator):**
```powershell
iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex
```

> After installing, run `spicetify backup apply` once to patch Spotify.

---

### Step 2 — Install Chorduction

**Option A — One-liner (recommended)**

macOS / Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/tanobuffone/chorduction/main/chorduction.js \
  -o "$(spicetify -c | head -1)/Extensions/chorduction.js" \
  && spicetify config extensions chorduction.js \
  && spicetify apply
```

Windows (PowerShell):
```powershell
$ext = "$env:APPDATA\spicetify\Extensions"
Invoke-WebRequest "https://raw.githubusercontent.com/tanobuffone/chorduction/main/chorduction.js" -OutFile "$ext\chorduction.js"
spicetify config extensions chorduction.js
spicetify apply
```

**Option B — Clone and install**

```bash
git clone https://github.com/tanobuffone/chorduction.git
cd chorduction
npm install
npm run build

# macOS / Linux
cp build/chorduction.js "$(spicetify -c | head -1)/Extensions/"

# Windows (PowerShell)
Copy-Item build\chorduction.js "$env:APPDATA\spicetify\Extensions\"

spicetify config extensions chorduction.js
spicetify apply
```

---

### Uninstall

```bash
spicetify config extensions chorduction.js-
spicetify apply
```

---

## Quick Install — YouTube

The YouTube extension works as a standard Chrome (or Chromium-based) browser extension. No build step required.

### Step 1 — Download the extension

```bash
git clone https://github.com/tanobuffone/chorduction.git
```

Or [download the ZIP](https://github.com/tanobuffone/chorduction/archive/refs/heads/main.zip) and extract it.

### Step 2 — Load in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `youtube-extension/` folder inside the cloned/extracted project

### Step 3 — Use it

1. Open any YouTube music video
2. The chord overlay appears in the bottom-right corner of the video
3. Click the 🎸 extension icon in the toolbar to see the current chord and toggle settings

---

## Usage

### Spotify Desktop

| Action | How |
|--------|-----|
| Open panel | Press `Alt+T` or click 🎸 in the player bar |
| Analyze track | Happens automatically when a song starts playing |
| Transpose | `Alt+↑` / `Alt+↓` (one semitone per press) |
| Change notation | Notation selector inside the Chorduction panel |
| Export | Click **Export** → choose TXT, JSON, or ChordPro |
| Settings | Click **Settings** inside the panel |

### YouTube Extension

| Action | How |
|--------|-----|
| See current chord | Bottom-right overlay on any YouTube video |
| View details | Click 🎸 toolbar icon |
| Toggle overlay | Switch in the popup panel |
| Toggle lyrics | Switch in the popup panel |

---

## Configuration

All settings persist automatically in `localStorage`.

| Setting | Default | Description |
|---------|---------|-------------|
| `chordNotation` | `standard` | `standard` · `nashville` · `solfege` · `roman` |
| `smoothingBeats` | `3` | Beat window for chord smoothing (higher = more stable) |
| `minConfidence` | `0.1` | Minimum confidence to display a chord (0–1) |
| `chordSimplification` | `1` | `1` = triads only · `2` = include 7ths · `3` = all extensions |
| `transposeSemitones` | `0` | Active transposition offset (−6 to +6) |
| `showLyrics` | `true` | Display synced lyrics in the panel |
| `showFretboard` | `true` | Display instrument diagram |
| `instrument` | `guitar` | `guitar` · `ukulele` · `piano` · `bass` |
| `showSections` | `true` | Display verse/chorus section labels |
| `useMLDetection` | `false` | Enable TF.js CNN blend for higher accuracy |
| `autoAnalyze` | `true` | Analyze automatically on track change |
| `cacheDurationMs` | `600000` | Cache TTL — 10 minutes default |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+T` | Open / close Chorduction panel |
| `Alt+↑` | Transpose up one semitone |
| `Alt+↓` | Transpose down one semitone |

---

## Export Formats

### TXT
```
# Golden Hour - JVKE
# Key: C major  |  Tempo: 120 BPM

[VERSE]  (0:00 – 0:30)
[0:00] C
[0:04] Am
[0:08] F
[0:12] G
```

### JSON (schema v2.0)
```json
{
  "meta": {
    "title": "Golden Hour",
    "artist": "JVKE",
    "key": "C major",
    "tempo": 120,
    "schemaVersion": "2.0",
    "exportedAt": "2026-03-20T12:00:00Z"
  },
  "chords": [
    { "startMs": 0, "endMs": 4000, "chord": "C", "confidence": 0.92 }
  ],
  "sections": [
    { "type": "verse", "startTime": 0, "endTime": 30, "repetitionIndex": 1 }
  ]
}
```

### ChordPro
```
{title: Golden Hour}
{artist: JVKE}
{key: C}

{start_of_verse}
[C]First line of [Am]the verse
[F]Second line [G]here
{end_of_verse}

{start_of_chorus}
[C]Chorus line [G]one
{end_of_chorus}
```

---

## Development

### Requirements

- Node.js ≥ 18
- npm

### Setup

```bash
git clone https://github.com/tanobuffone/chorduction.git
cd chorduction
npm install
```

### Available scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all 290 tests |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run build` | Build Spicetify bundle → `build/chorduction.js` |
| `npm run build:watch` | Rebuild on file change |
| `npm run typecheck` | JSDoc type checking (tsc --noEmit) |
| `npm run lint` | ESLint |

### Test suite

| Suite | Tests | Description |
|-------|-------|-------------|
| `unit/core/` | 99 | ChordDetector, Transposer, KeyDetector, ChordNotation, SectionDetector |
| `unit/cache/` | 22 | SmartCache TTL, LRU, eviction |
| `unit/export/` | 39 | TXT, JSON, ChordPro formatters |
| `unit/ml/` | 27 | BlendStrategy, FeatureExtractor |
| `unit/utils/` | 29 | Math utilities (cosine, pearson, binary search, normalize) |
| `integration/` | 74 | Full pipelines, cache, degradation, export flow |
| **Total** | **290** | |

---

## Project Structure

```
chorduction/
├── chorduction.js              # Legacy v6 bundle (kept for reference)
├── build.js                    # esbuild configuration
├── package.json
├── jest.config.js
├── tsconfig.json
├── .eslintrc.js
│
├── src/                        # v7 source modules
│   ├── index.js                # Entry point
│   ├── config.js               # Settings + migration from v6
│   ├── types.js                # JSDoc @typedef declarations
│   │
│   ├── core/                   # Pure logic — no Spicetify coupling
│   │   ├── chord-detector.js
│   │   ├── chord-notation.js
│   │   ├── chord-templates.js
│   │   ├── key-detector.js
│   │   ├── section-detector.js
│   │   └── transposer.js
│   │
│   ├── cache/
│   │   ├── smart-cache.js      # LRU + TTL + frequency-score eviction
│   │   └── cache-manager.js
│   │
│   ├── ml/
│   │   ├── blend-strategy.js   # Chroma + ML confidence zones
│   │   ├── feature-extractor.js
│   │   ├── ml-detector.js
│   │   ├── model-loader.js     # TF.js, IndexedDB cache
│   │   └── correction-collector.js
│   │
│   ├── export/
│   │   ├── file-exporter.js
│   │   └── formatters/
│   │       ├── txt-formatter.js
│   │       ├── json-formatter.js
│   │       └── chordpro-formatter.js
│   │
│   ├── providers/
│   │   ├── analysis-provider.js      # Spotify Audio Analysis API
│   │   └── lyrics-provider-chain.js  # Spotify internal → LRCLIB
│   │
│   ├── platforms/spicetify/
│   │   ├── player-adapter.js
│   │   ├── button-injector.js
│   │   └── panel.js
│   │
│   ├── ui/
│   │   ├── component.js        # Base component (setState/render)
│   │   ├── chord-display.js
│   │   ├── modal.js
│   │   └── instruments/
│   │       ├── guitar-fretboard.js
│   │       ├── ukulele-fretboard.js
│   │       ├── piano-keys.js
│   │       └── bass-fretboard.js
│   │
│   └── utils/
│       ├── logger.js
│       ├── math.js
│       ├── i18n.js
│       ├── cleanup-manager.js
│       └── error-boundary.js
│
├── youtube-extension/          # Chrome MV3 extension
│   ├── manifest.json
│   ├── background/service-worker.js
│   ├── content/
│   │   ├── chorduction-yt.js
│   │   ├── audio-capturer.js
│   │   └── caption-provider.js
│   └── popup/
│       ├── popup.html
│       └── popup.js
│
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   ├── cache/
│   │   ├── export/
│   │   ├── ml/
│   │   └── utils/
│   ├── integration/
│   └── e2e/setup/
│       └── spicetify-mock.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PLAN_V7.md
│   └── ROADMAP.md
│
├── .github/workflows/
│   ├── ci.yml                  # typecheck → lint → tests → build → release
│   └── model-update.yml        # Weekly ML accuracy check
│
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/chorduction.git
cd chorduction
npm install

git checkout -b feat/my-feature
# make changes
npm test
git push origin feat/my-feature
# open a pull request against main
```

---

## Known Limitations

- **CORS in Spotify Web Player** — audio analysis requires the Desktop client. The extension does not work in the browser version of Spotify.
- **Chord accuracy** — ~70–80% on typical pop/rock. Complex jazz, atonal music, or heavily processed audio will yield lower confidence.
- **Spicetify version fragility** — Spotify updates its UI without notice. The button injector uses 6 CSS selector fallbacks + MutationObserver. If the button disappears, update Spicetify first.

---

## Roadmap

| Version | Status | Highlights |
|---------|--------|-----------|
| **v7.0.0** | ✅ Current | Modular architecture, ML blend, YouTube extension, section detection, 4 instruments |
| **v7.1.0** | Planned | Real Spicetify Marketplace submission, ML model training scripts |
| **v8.0.0** | Future | Playlist analysis, key-change detection, mobile companion |

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full plan.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Spicetify](https://spicetify.app) — the framework that makes all of this possible
- [LRCLIB](https://lrclib.net) — free, open, synced lyrics database
- Krumhansl & Schmuckler (1990) — key-finding algorithm
