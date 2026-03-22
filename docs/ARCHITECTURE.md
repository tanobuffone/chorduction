# Chorduction — Architecture Reference

This document describes the internal architecture of `chorduction.js` and the design decisions behind it.

---

## Overview

Chorduction is a **single-file Spicetify extension**. All runtime code lives in `chorduction.js`. There is no build step, bundler, or transpiler — the file is loaded directly by Spicetify as a plain JavaScript extension.

The file is organized into independent modules using immediately-invoked patterns and closures, separated by clear comment blocks. Each module has a single responsibility and exposes a minimal public interface.

---

## Module Map

```
chorduction.js
│
├── [CONFIG] DEFAULT_CONFIG
│   Constants and tunable parameters
│
├── [MODULE] GlobalErrorBoundary
│   window.onerror + unhandledrejection handlers
│   Logs errors and prevents full extension crash
│
├── [MODULE] Settings
│   Read/write to localStorage (key: chorduction-settings-v6)
│   Merges defaults with stored values on load
│   Validates types on write
│
├── [MODULE] Logger
│   6 levels: TRACE < DEBUG < INFO < WARN < ERROR < OFF
│   Console output + optional DOM overlay
│   Respects DEBUG_LEVEL setting
│
├── [MODULE] SmartCache
│   Generic LRU cache with TTL
│   Eviction scoring: (1 / access_count) * age_ms
│   Three instances: analysisCache, lyricsCache, timelineCache
│
├── [MODULE] Transposer
│   Stateless pitch-shifting functions
│   Transposer.transpose(chord, semitones)
│   Transposer.setTranspose(n) — sets global offset
│   Handles chord quality preservation across all shifts
│
├── [MODULE] ChordNotation
│   Stateless notation converters
│   ChordNotation.convert(chord, format, key)
│   Formats: standard | nashville | solfege | roman
│
├── [MODULE] FileExporter
│   Stateless file generation + browser download trigger
│   FileExporter.export(data, format)
│   Formats: txt | json | chordpro
│
├── [CLASS] ChordDetector
│   Main analysis orchestrator
│   Depends on: SmartCache, Transposer, ChordNotation
│   ├── detectKey(segments)         — Krumhansl-Schmuckler
│   ├── detectChord(chroma)         — cosine similarity
│   ├── processAnalysis(data)       — bar-level averaging pipeline
│   │     Primary path: average all segment pitches within each bar → detectChord once per bar
│   │     Fallback: beat-level with SMOOTHING_BEATS window (if bars < 4)
│   └── returns { rawChords[], bars[], key, confidence, tempo }
│
├── [ASYNC] getAudioAnalysis(trackId)
│   Spotify Web API: GET /v1/audio-analysis/{id}
│   Checks analysisCache first; stores result on miss
│   Handles 429 rate limiting with logged fallback
│
├── [ASYNC] fetchLyrics(trackId, title, artist)
│   Provider chain:
│   1. Spicetify.CosmosAsync (hm://color-lyrics)
│   2. LRCLIB API
│   3. Spotify Lyrics API (/v1/tracks/{id}/lyrics)
│   Checks lyricsCache; stores on miss
│
├── [UI] FretboardDiagram
│   SVG chord diagram generator
│   fingerings: static map of chord → finger positions
│   render(chord) → SVG string
│
├── [UI] Modal
│   Spicetify.PopupModal wrapper
│   buildContent(state) → HTML string
│   update(state) — partial re-render via innerHTML
│
├── [UI] PlayerButtons
│   Injects 🎸 button into Spotify player controls
│   Retry strategy: 3 attempts × 2s backoff
│   Sidebar fallback if main injection fails
│
├── [HANDLER] onTrackChange(track)
│   Called by Spicetify.Player.addEventListener('songchange')
│   Triggers getAudioAnalysis + fetchLyrics in parallel
│   Passes results to ChordDetector.processAnalysis
│   Updates Modal state
│
├── [HANDLER] onPlaybackUpdate(event)
│   Called on 'onplaypause' + progress events
│   Updates current chord highlight based on playback position
│   Uses binary search on timeline for O(log n) lookup
│
├── [HANDLER] KeyboardShortcuts
│   Alt+T — toggle modal
│   Alt+↑ / Alt+↓ — transpose ±1 semitone
│   Respects ENABLE_KEYBOARD_SHORTCUTS setting
│
├── [MODULE] CleanupManager
│   Tracks all event listeners and DOM nodes added by the extension
│   CleanupManager.register(fn) — queue a cleanup function
│   CleanupManager.runAll() — called on extension unload
│
└── [INIT] initialize()
    Spicetify readiness check loop
    Registers all event listeners via CleanupManager
    Injects UI elements
    Loads persisted settings
```

---

## Data Flow

```
User plays track
        │
        ▼
onTrackChange / panel open
        │
        ├──────────────────────────────┐
        ▼                              ▼
getAudioAnalysis()              fetchLyrics()
  [SmartCache → Spotify API]    [SmartCache → Provider chain]
  returns: segments[], bars[],   returns: { lines: [{startMs, text}] }
           beats[], sections[]
        │                              │
        └──────────┬───────────────────┘
                   ▼
        ChordDetector.processAnalysis(analysis)
                   │
                   ├─ detectKey(first 50 segments avg chroma) → key string
                   ├─ Bar-level path (bars.length >= 4):
                   │    for each bar: avg all segment pitches → detectChord() → rawChord
                   └─ Fallback (beat-level): detectChord(segment.pitches) per beat + smoothing
                   │
                   ▼
        rawChords[] + bars[] returned
                   │
                   ▼
        consolidateChords(rawChords, CHORD_SIMPLIFICATION)
          strip extensions per level, merge consecutive same-name, filter short durations
                   │
                   ▼
        syncChordsToLyrics(chords, lyrics)
          each chord → reverse-scan lyrics[] → last line with startMs ≤ chord.startMs
                   │
                   ▼
        currentAnalysis = { chords, rawChords, key, lyrics, sections, bars, tempo }
                   │
                   ▼
        buildStructuredSections(sections, chords, lyrics)
          labelSections(sections, lyrics):
            no-lyric middle sections → type:'solo' (purple)
            loud sections → 'chorus' (green)
            short middle → 'bridge' (orange)
            else → 'verse' (blue)
          buildChordLines(secChords, secLyrics):
            has lyrics → group by active lyric line
            no lyrics + bars → group 2 bars per visual row
            fallback → 4s fixed windows
                   │
                   ▼
        updateChordDisplay() → DOM render
        startPlayheadTracking() → onprogress → binarySearchChords → highlight .now chip + .now-line


User scrubs / song plays
        │
        ▼
onprogress event → updatePlayhead(ms)
        │
        ▼
binarySearchChords(ms) → O(log n) index lookup
        │
        ▼
chip.classList.add('now') + line.classList.add('now-line')
scrollIntoView({ block:'nearest', behavior:'smooth' }) if autoscroll enabled
```

---

## Caching Architecture

```
SmartCache (generic)
├── capacity: max entries (default 20)
├── ttl: time-to-live in ms (default 600,000)
├── store: Map<key, { value, createdAt, lastAccess, accessCount }>
│
├── get(key)
│   ├── Check TTL expiry → delete + return null if expired
│   ├── Increment accessCount, update lastAccess
│   └── Return value
│
├── set(key, value)
│   ├── If at capacity: evict entry with lowest score
│   │   score = accessCount / age_ms  (higher = keep)
│   └── Store with current timestamp
│
└── clear() — full eviction

Instances:
  analysisCache  — Spotify Audio Analysis API responses
  lyricsCache    — Lyrics provider responses (any provider)
  timelineCache  — Post-processed chord+lyric timeline arrays
```

---

## Lyrics Provider Chain

```
fetchLyrics(trackId, title, artist)
        │
        ▼
[1] Spicetify.CosmosAsync("hm://color-lyrics/v2/track/{id}")
        │  success ──────────────────────────────────────┐
        │  fail (CORS / unavailable)                     │
        ▼                                                 │
[2] LRCLIB API                                           │
    GET https://lrclib.net/api/get                       │
    ?track_name={title}&artist_name={artist}             │
        │  success ──────────────────────────────────────┤
        │  fail (no match / timeout)                     │
        ▼                                                 │
[3] Spotify Lyrics API                                   │
    GET /v1/tracks/{id}/lyrics                           │
        │  success ──────────────────────────────────────┤
        │  fail                                           │
        ▼                                                 │
    Return null (lyrics section hidden in UI)            │
                                                         ▼
                                               Parse timestamps
                                               Align with chord timeline
                                               Store in lyricsCache
```

---

## Error Handling Strategy

Chorduction uses a layered error handling model:

| Layer | Mechanism | Behavior |
|-------|-----------|----------|
| Global | `window.onerror` + `unhandledrejection` | Log error, prevent crash |
| API | try/catch per `fetch()` call | Fall to next provider or show fallback UI |
| Rate limit | Detect 429 status | Log, show manual entry option |
| UI injection | Retry loop with backoff | Try 3×, fall to sidebar button |
| Analysis | Null/empty data checks | Show informational message, enable manual input |
| Cache | TTL + eviction on miss | Transparent to consumers |

---

## Chord Detection Math

### Chroma Vector
A 12-element array representing the energy of each pitch class (C, C#, D, ... B) in a time segment.

### Cosine Similarity
For chord template `T` and observed chroma `C`:
```
similarity = dot(C, T) / (||C|| × ||T||)
```
Range: 0–1. Higher = more similar.

### Chord Templates
Binary vectors indicating which pitch classes are present:
```javascript
const CHORD_TEMPLATES = {
  'C':  [1,0,0,0,1,0,0,1,0,0,0,0],  // C E G
  'Cm': [1,0,0,1,0,0,0,1,0,0,0,0],  // C Eb G
  'C7': [1,0,0,0,1,0,0,1,0,0,1,0],  // C E G Bb
  // ... all 12 chromatic roots × 5 qualities = 60 templates
}
```

### Key Detection (Krumhansl-Schmuckler)
```
for each of 24 key candidates (12 major + 12 minor):
    correlation = pearson(aggregated_chroma, key_profile)
return key with max correlation
```

Key profiles are empirically derived weights for each scale degree (Krumhansl & Schmuckler, 1990).

---

## Bar-Level Chord Detection (primary path, v6.4.0+)

Averaging all segment pitches within a bar before detecting the chord significantly reduces melodic contamination:

```
for each bar in analysis.bars:
    barSegments = segments where segment.start ∈ [bar.start, bar.start + bar.duration)
    avgPitches[i] = mean( seg.pitches[i] for seg in barSegments )
    chord = detectChord(avgPitches)   ← one cosine similarity call per bar
    rawChords.push({ chord, startMs: bar.start*1000, endMs: (bar.start+bar.duration)*1000 })
```

**Why averaging helps:**
- A vocalist singing scale degree 3 on beat 1, degree 5 on beat 2, degree 1 on beat 3, degree 2 on beat 4 produces a nearly uniform chroma distribution (melody averages out)
- The harmonic structure (e.g. a sustained G chord = G B D) appears consistently across all beats → its chroma energy accumulates
- Net effect: ~75% fewer chord changes, harmonically accurate, works on solos too

**Fallback (beat-level with smoothing):**
Used only when `analysis.bars.length < 4`. Iterates beats, takes the segment at each beat position, applies a smoothing window of `SMOOTHING_BEATS` (default 3) to reduce flickering.

---

## Known Constraints

### Single-File Design
The extension must be a single `.js` file for Spicetify compatibility. Modules cannot use `import`/`export`. Internal organization relies on function hoisting and closure scope.

### No Build Step
Minification, bundling, and transpilation are intentionally excluded to keep the extension auditable and easy to install manually.

### Spicetify API Surface
The extension depends on:
- `Spicetify.Player` — playback events and state
- `Spicetify.Platform` — track metadata
- `Spicetify.CosmosAsync` — internal Spotify endpoint access
- `Spicetify.PopupModal` — modal display
- `Spicetify.Menu` — right-click menu registration

These APIs are not versioned and can break with Spotify updates. DOM fallback strategies mitigate this but cannot fully prevent breakage.
