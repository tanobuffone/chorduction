# Technical Context: Chorduction

## Technology Stack

### Core
- **JavaScript (ES6+)**: No build step, vanilla JS
- **Spicetify API**: Player, Platform, CosmosAsync, PopupModal
- **Spotify Web API**: Audio Analysis, Lyrics

### External APIs
- **Spotify Audio Analysis API**: Segments, beats, pitches
- **LRCLIB API**: Synced lyrics
- **Spotify Lyrics API**: Fallback lyrics source

### Algorithms
- **Chroma Vector Analysis**: 12-dimensional pitch representation
- **Krumhansl-Schmuckler**: Key detection via profile correlation
- **Cosine Similarity**: Chord template matching

## Architecture

### Modules
```
chorduction.js (1700+ lines)
├── GlobalErrorBoundary - Crash prevention
├── Settings - LocalStorage persistence
├── Logger - Debug overlay
├── SmartCache - LRU with TTL
├── Transposer - Pitch shifting
├── ChordNotation - Format conversion
├── FileExporter - Download formats
├── ChordDetector - Main analysis class
└── UI Components - Modal, buttons, diagrams
```

### Data Flow
```
Track Change → getAudioAnalysis() → processAnalysis()
                     ↓
              ChordDetector.detectChord()
                     ↓
              Transposer.transpose()
                     ↓
              ChordNotation.convert()
                     ↓
              updateChordDisplay()
                     ↓
              FileExporter.export() (optional)
```

### Cache Strategy
- **analysisCache**: Spotify Audio Analysis (10min TTL)
- **lyricsCache**: LRCLIB/Spotify lyrics (10min TTL)
- **timelineCache**: Pre-processed timelines

## Configuration

### DEFAULT_CONFIG
```javascript
{
  DEBUG_LEVEL: "INFO",
  SMOOTHING_BEATS: 3,
  MIN_CONFIDENCE: 0.1,
  CHORD_SIMPLIFICATION: 1,
  TRANSPOSE_SEMITONES: 0,
  CHORD_NOTATION: "standard",
  CACHE_DURATION_MS: 600000,
  REQUEST_TIMEOUT_MS: 15000
}
```

## Error Handling

### Graceful Degradation
1. API rate limited → Show manual entry option
2. CORS blocked → Fallback endpoints
3. No audio analysis → Display message, allow manual chords
4. Lyrics unavailable → Continue without lyrics

### Error Boundary
- Global error handler prevents extension crash
- Promise rejection handling
- User-friendly error messages

## Performance Considerations

### Optimization
- Binary search for segment lookup O(log n)
- SmartCache with eviction scoring
- Async operations with timeout
- Minimal DOM manipulation

### Limitations
- Spotify API rate limits (429 errors)
- CORS in web player environment
- No offline support
- Accuracy depends on audio quality

## Dependencies

### Runtime
- Spicetify (required)
- Spotify Desktop or Web Player

### Build
- None (vanilla JS)

### Testing
- Node.js + Jest (planned)

## Browser Compatibility
- Spotify Desktop Client (recommended)
- Chrome-based browsers
- Spotify Web Player (limited by CORS)