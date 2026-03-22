# Chorduction — Roadmap

**Last Updated:** 2026-03-21

---

## Release Philosophy

- **v6.x** — stability, bug fixes, polish on the existing single-file architecture
- **v7.0** — breaking architectural change: modular multi-file, TypeScript, ML detection, new capabilities
- **v8.0** — platform expansion, collaboration, advanced music theory features

---

## Current: v6.4.0 ✅

All v6.x work to date is complete. See [CHANGELOG.md](../CHANGELOG.md) for full history.

**v6.x releases shipped:**
- v6.0.0 — unified monolith, SmartCache, FileExporter, CI/CD
- v6.1.0 — 429 detection fix, stale DOM fix, double-init fix, rate-limit countdown
- v6.3.0 — fretboard hover for all chords, chord consolidation, prev/next as song nav, re-analyze button
- v6.4.0 — bar-level harmonic detection, correct lyric sync direction, solo section detection, measure-aligned display

---

## v6.5.0 — Stability + UX Polish

**Target:** April 2026
**Scope:** Bug fixes and UX polish. No new features.

### Bug Fixes
- [ ] DOM selector fragility — replace brittle CSS class selectors with attribute-based and structural queries; add a `MutationObserver` to detect when the player controls re-render
- [ ] Keyboard shortcut registration timing — defer registration until Spicetify reports fully loaded
- [ ] Modal z-index conflicts on certain Spotify themes

### UX Improvements
- [ ] Sidebar button as injection fallback when player controls injection fails
- [ ] User-facing error messages with specific, actionable text (e.g., "Spotify API rate limited — retry in 30s" instead of generic error)
- [ ] Fretboard diagrams for dominant 7th chords (C7, G7, D7, A7, E7, B7, F7)
- [ ] Controls bar grouping — visually group transport (⏮▶⏭🔄) separately from musical settings (notation/level/transpose)
- [ ] Time signature display in header (3/4, 6/8, etc.) using `analysis.track.time_signature`

### Developer Experience
- [ ] Stress test suite — rapid track changes, network failure simulation
- [ ] Performance benchmark baseline for v7 comparison
- [ ] `DEBUG_LEVEL=TRACE` captures full API response payloads for easier bug reports

---

## v7.0.0 — Architecture Overhaul

**Target:** June 2026
**This is a major breaking release.** The single-file design is replaced with a proper modular structure, TypeScript types are introduced, and two new major capabilities are added: ML-based chord detection and YouTube support.

---

### 7.1 — Modular Architecture Refactor

**Problem:** `chorduction.js` at ~2000 lines is at the limit of maintainability for a single file. Adding ML models, new providers, and new instruments will push it past 4000 lines.

**Solution:** Introduce a Spicetify-compatible build step using `esbuild` (zero config, fast, outputs a single bundled `.js`). Source code becomes a proper module tree.

#### New File Structure

```
src/
├── index.js                    # Entry point: init, event wiring
├── config.js                   # DEFAULT_CONFIG, constants
│
├── core/
│   ├── chord-detector.js       # ChordDetector class
│   ├── key-detector.js         # Krumhansl-Schmuckler
│   ├── transposer.js           # Transposer module
│   ├── chord-notation.js       # ChordNotation module
│   └── chord-templates.js      # Template vectors (extracted constant)
│
├── ml/
│   ├── ml-detector.js          # TensorFlow.js-based detector (v7 new)
│   ├── model-loader.js         # Lazy model loading + caching
│   └── training-adapter.js     # Collect user corrections for fine-tuning
│
├── providers/
│   ├── analysis-provider.js    # Spotify Audio Analysis API
│   ├── lyrics-provider.js      # Provider chain orchestration
│   ├── lrclib.js               # LRCLIB adapter
│   ├── spotify-lyrics.js       # Spotify Lyrics API adapter
│   └── youtube-provider.js     # YouTube audio + lyrics (v7 new)
│
├── cache/
│   ├── smart-cache.js          # SmartCache class
│   └── cache-manager.js        # Named cache instances
│
├── export/
│   ├── file-exporter.js        # FileExporter module
│   ├── txt-formatter.js
│   ├── json-formatter.js
│   └── chordpro-formatter.js
│
├── ui/
│   ├── modal.js                # Spicetify.PopupModal wrapper
│   ├── player-buttons.js       # Injection + retry logic
│   ├── fretboard.js            # SVG chord diagrams
│   ├── section-labels.js       # Verse/Chorus/Bridge labels (v7 new)
│   └── settings-panel.js       # Settings UI
│
└── utils/
    ├── logger.js               # Logger module
    ├── error-boundary.js       # GlobalErrorBoundary
    ├── cleanup-manager.js      # CleanupManager
    └── math.js                 # cosineSimilarity, pearsonCorrelation, binarySearch

build/
└── chorduction.js              # Bundled output (what gets installed)

tests/
├── unit/                       # One file per src module
├── integration/                # Cross-module flow tests
└── e2e/                        # Spicetify mock environment tests
```

#### Build Pipeline

```bash
npm run build        # esbuild src/index.js → build/chorduction.js
npm run build:watch  # watch mode for development
npm run release      # build + version bump + tag
```

CI produces `build/chorduction.js` as the release artifact.

---

### 7.2 — TypeScript Type Definitions

**Approach:** Incremental — start with JSDoc `@typedef` annotations for all public APIs, then migrate hot-path modules to `.ts` in a subsequent phase.

#### Phase 1 (v7.0): JSDoc types on all public APIs

```javascript
/**
 * @typedef {Object} ChordResult
 * @property {string} chord - Chord name in current notation
 * @property {number} confidence - Detection confidence 0–1
 * @property {number} startTime - Beat start time in seconds
 * @property {number} endTime - Beat end time in seconds
 */

/**
 * @param {Float32Array} chroma - 12-dimensional chroma vector
 * @returns {ChordResult}
 */
function detectChord(chroma) { ... }
```

#### Phase 2 (v7.1+): Migrate core modules to TypeScript

Priority order:
1. `chord-templates.ts` — pure data, zero migration cost
2. `transposer.ts` — stateless functions, easy to type
3. `chord-notation.ts` — stateless functions
4. `smart-cache.ts` — generic `SmartCache<K, V>`
5. `chord-detector.ts` — complex but isolated

---

### 7.3 — ML-Based Chord Detection

**Problem:** Chroma cosine similarity achieves ~70% accuracy. Complex jazz chords, borrowed chords, and polychords are systematically misidentified.

**Solution:** TensorFlow.js model running in the browser alongside (not replacing) the existing chroma detector, with a confidence-weighted blend.

#### Architecture

```
AudioAnalysis segments
        │
        ├──── [existing] ChromaDetector ─────────────────┐
        │     cosine similarity                           │
        │     confidence: ~0.7 avg                        │
        │                                                 ▼
        └──── [new] MLDetector ──────────────────► BlendedResult
              TF.js CNN on chroma sequences              │
              confidence: ~0.85 avg (target)             ▼
                                               ChordResult (final)
```

#### Model Specification

- **Input:** 12 × 8 chroma matrix (current beat + 3 before + 4 after = context window)
- **Architecture:** 2-layer CNN → flatten → dense 128 → softmax over 60 chord classes
- **Output:** 60-class probability distribution (12 roots × 5 qualities)
- **Size target:** < 500 KB (gzipped), loads in < 1s on average connection
- **Runtime:** TF.js `@tensorflow/tfjs-core` + `@tensorflow/tfjs-backend-webgl`

#### Training Strategy

1. **Initial model:** Train offline on [CASD dataset](https://github.com/carlosholivan/chords-dataset) + Beatles corpus
2. **User corrections adapter:** When user manually corrects a chord, record `{ chroma, correct_chord }` pair in `localStorage`
3. **Fine-tune pipeline:** Nightly GitHub Actions job fetches correction batches, retrains, uploads new model weights to CDN
4. **Model versioning:** Semantic versioning independent of extension; extension downloads latest compatible version on startup

#### Fallback Chain

```
MLDetector available AND confidence > threshold
    → use ML result

MLDetector unavailable OR confidence < threshold
    → use ChromaDetector result (existing behavior)

ChromaDetector also low confidence
    → show manual entry option
```

---

### 7.4 — Section Detection

**Problem:** Users currently see a flat list of chords with no structural context. "This chord is in the chorus" is musically meaningful.

**Solution:** Automatic verse/chorus/bridge labeling using energy profile clustering and chroma self-similarity matrix analysis.

#### Algorithm

1. Compute **chroma self-similarity matrix** — compare every 4-bar segment to every other
2. Apply **checkerboard kernel** novelty detection to find structural boundaries
3. Cluster segments by chroma centroid similarity → groups = sections
4. Label by position heuristic:
   - First occurrence of most-repeated section → Verse
   - Most energy + most repetitions → Chorus
   - High novelty + low repetition → Bridge
   - Beginning → Intro, End → Outro

#### UI Display

```
[INTRO]   C → G → Am → F  (0:00 – 0:16)
[VERSE]   C → G → Am → F  (0:16 – 0:48)
          C → G → Em → F
[CHORUS]  F → C → G → Am  (0:48 – 1:04)  ← highlighted
[VERSE]   ...
[CHORUS]  ...
[BRIDGE]  Dm → G → Em → Am (2:30 – 2:46)
```

#### Export Integration

- TXT format gains section headers
- JSON gains `sections[]` array with start/end times and label
- ChordPro gains `{comment: Chorus}` markers

---

### 7.5 — YouTube Support

**Problem:** Chorduction only works in Spotify. Users want to analyze any song they can play, including YouTube.

**Solution:** A companion browser extension that detects YouTube playback and provides the same chord display as the Spicetify extension.

#### Technical Approach

- **Extension type:** Chrome/Firefox Manifest V3 content script
- **Audio source:** Web Audio API `createMediaElementSource` on `<video>` element
- **Analysis:** Same chroma extraction, same ChordDetector class (shared module)
- **Lyrics:** YouTube caption API (auto-generated or user-uploaded) + LRCLIB fallback
- **CORS:** Not an issue — content scripts run in the page context

#### Shared Code Strategy

Extract core modules (ChordDetector, Transposer, ChordNotation, FileExporter) into an `@chorduction/core` npm package. Both the Spicetify extension and the browser extension depend on this shared package.

#### YouTube-Specific Challenges

- Audio fingerprinting for lyric matching (title/artist from YouTube metadata)
- Chapter markers as section labels (available for many music videos)
- Live streams: disable caching, increase smoothing window

---

### 7.6 — Instrument Expansion

Currently only guitar fretboard diagrams. v7 adds:

| Instrument | Diagrams | Interactive |
|------------|----------|-------------|
| Guitar | All 60 chords | Transpose updates diagram |
| Ukulele | All 60 chords | Transpose updates diagram |
| Piano | All 60 chords | Highlighted keys SVG |
| Bass | Root + octave only | Fretboard position |

Instrument is selected in Settings and persists across sessions.

---

## v7.0.0 Migration Guide (for users)

### Settings Reset
Settings key changes from `chorduction-settings-v6` to `chorduction-settings-v7`. First launch will reset to defaults. Export your v6 settings before upgrading if needed:
```javascript
// In browser console before upgrade:
console.log(localStorage.getItem('chorduction-settings-v6'));
```

### Installation Change
v7 is still installed as a single `.js` file — the build step is transparent to end users. Installation process is identical.

### API Breaking Changes (for developers building on top of Chorduction)
- `ChordDetector.processAnalysis()` return type gains `sections[]` field
- `FileExporter.export()` JSON format version bumped to `2.0`
- SmartCache constructor now requires explicit `name` parameter

---

## v8.0.0 — Platform Expansion

**Target:** December 2026

### Playlist Analysis
Batch-analyze an entire Spotify playlist. Produces a summary view:
- Most common key across playlist
- Most common chord progressions
- BPM distribution chart
- Export as combined chord sheet

### Key Change Detection (Modulation)
Detect when a song changes key mid-track:
- Report modulation point with confidence
- Show before/after keys
- Annotate section labels with key information

### Collaborative Chord Sheets
- Export a shareable link (chord sheet hosted on `chorduction.app`)
- Import shared chord sheets
- Community corrections feed into ML training data

### Mobile Companion App
React Native app that:
- Receives chord data from desktop via WebSocket
- Displays large chord name on phone screen while playing
- Guitar tuner integration

---

## Technical Debt Tracker

| Issue | Impact | Effort | Target Version |
|-------|--------|--------|---------------|
| DOM selector fragility | High | Medium | v6.1.0 |
| API rate limit recovery UX | Medium | Low | v6.1.0 |
| CORS in web player | High | High | v7.0.0 (YouTube extension) |
| Test coverage > 85% | Medium | Medium | v7.0.0 |
| TypeScript migration (phase 1) | Medium | Medium | v7.0.0 |
| TypeScript migration (phase 2) | Low | High | v7.1.0 |
| Offline IndexedDB cache | Low | Medium | v8.0.0 |

---

## References

- [Architecture Guide](./ARCHITECTURE.md)
- [Competitor Research](./research-competitors.md)
- [Changelog](../CHANGELOG.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Progress Tracker](../memory-bank/progress.md)
