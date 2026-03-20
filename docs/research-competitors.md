# Research: Competitors & Similar Tools

## Chorduction v6.0.0 - Competitive Analysis
*Last Updated: 2026-02-19*

---

## Direct Competitors

### 1. Real-time Chord Recognition for Browser Audio
- **Platform:** Chrome Extension
- **Users:** 540+
- **Rating:** 5.0/5 (2 ratings)
- **Price:** Free
- **Features:**
  - Real-time chord detection from browser tabs (YouTube, Spotify)
  - Major, Minor, Slash chords
  - Local processing (privacy-focused)
  - Draggable UI
  - Experimental tunable settings
- **Advantages over Chorduction:**
  - Works with any browser audio (YouTube, etc.)
  - Privacy-first (all local processing)
- **Disadvantages:**
  - No lyrics sync
  - No transposing
  - No export formats
  - No fretboard diagrams

### 2. Chordify
- **Platform:** Web + Apps
- **Users:** Millions
- **Price:** Freemium ($5-15/month premium)
- **Features:**
  - Chord detection from uploaded files or YouTube
  - Multiple instruments (guitar, piano, ukulele)
  - Synchronized playback
- **Disadvantages:**
  - No direct Spotify integration (manual search required)
  - Premium required for advanced features
  - No Nashville/Roman notation

### 3. Scaler 3
- **Platform:** DAW Plugin (VST/AU)
- **Price:** $99
- **Features:**
  - Key detection from audio
  - Chord progression suggestions
  - Drag-and-drop MIDI
  - Roman numeral notation
- **Disadvantages:**
  - DAW required
  - No real-time detection from streaming
  - Expensive

---

## Analysis Tools (Non-Chord)

### Mixed In Key
- **Price:** $58
- **Features:** BPM + Key detection (gold standard)
- **Use Case:** DJ workflow

### Bridge.audio
- **AI-powered analysis:**
  - Genre detection
  - BPM + Key
  - Mood analysis
  - Instrument detection
  - Autotune detection
- **Use Case:** Music cataloging, sync licensing

### Spotify for Artists
- **Free**
- **Features:** Stream counts, demographics, playlists
- **No chord analysis**

---

## Technical References

### Spotify Web API Audio Analysis
```javascript
// From Stack Overflow - chord detection using chroma vectors
const chromaticScaleFlat = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const chordQuality = ["m", "", "sus", "7", "dim", "aug"];

function getChordFromChroma(chroma) {
    // Use pitches array from Spotify segments
    // Returns chord name
}
```
- **Endpoint:** `https://api.spotify.com/v1/audio-analysis/{track_id}`
- **Returns:** segments.pitches (chroma vectors)
- **Limitations:** Rate limits, CORS in web player

### Key Algorithms
1. **Krumhansl-Schmuckler** - Key detection (used in Chorduction)
2. **Chroma Vector Analysis** - Chord detection basis
3. **Cosine Similarity** - Chord matching

---

## Market Gaps (Opportunities)

| Feature | Chorduction | Competitors |
|---------|-------------|-------------|
| Real-time Spotify detection | ✅ | ❌ (manual) |
| Lyrics sync | ✅ | ❌ |
| Nashville notation | ✅ | Partial (Scaler) |
| Roman numerals | ✅ | Partial (Scaler) |
| Solfege notation | ✅ | ❌ |
| Export (TXT/JSON/ChordPro) | ✅ | ❌ |
| Fretboard diagrams | ✅ | Partial |
| Manual override | ✅ | ❌ |
| Offline mode | Planned | Partial |
| YouTube support | Planned | ✅ (Chordify) |
| AI/ML accuracy | Planned | ✅ (Bridge) |

---

## Pricing Benchmark

| Model | Typical Range | Examples |
|-------|---------------|----------|
| Freemium | $0 base, $5-15/mo premium | Chordify |
| One-time | $30-200 | Mixed In Key ($58), Scaler ($99) |
| Free | Open source | Chorduction |

**Chorduction positioning:** Free, open-source, feature-rich alternative with unique notations and export.

---

## Recommendations for v7.0

1. **Add YouTube support** - Major gap vs competitors
2. **Improve accuracy with ML** - Bridge.audio uses AI
3. **Section detection** - Verse/Chorus labeling
4. **Offline mode** - Privacy-focused users
5. **Mobile app** - Chordify has apps

---

*Sources: Chrome Web Store, Stack Overflow, Reddit r/LearnGuitar, AudioCipher Blog, FitGap*