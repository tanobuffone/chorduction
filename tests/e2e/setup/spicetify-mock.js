/**
 * @fileoverview Full Spicetify mock environment for E2E tests.
 * Simulates all Spicetify globals that chorduction/src/index.js depends on.
 */

// ── Track fixture library ─────────────────────────────────────────────────────
export const TRACK_FIXTURES = {
  cMajorSong: {
    uri:    'spotify:track:fixture_cmajor',
    name:   'C Major Test Song',
    artist: 'Test Artist',
    album:  'Test Album',
    duration_ms: 180_000,
  },
  gMajorSong: {
    uri:    'spotify:track:fixture_gmajor',
    name:   'G Major Test Song',
    artist: 'Another Artist',
    album:  'Another Album',
    duration_ms: 210_000,
  },
};

// ── Analysis fixture library ──────────────────────────────────────────────────
function chromaFor(...pcs) {
  const v = new Array(12).fill(0.02);
  for (const pc of pcs) { v[pc] = 0.9; }
  return v;
}

export const ANALYSIS_FIXTURES = {
  cMajorSong: {
    track:    { tempo: 120, time_signature: 4, key: 0, mode: 1 },
    segments: [
      { start: 0,   duration: 2, pitches: chromaFor(0, 4, 7),  loudness_max: -10 },
      { start: 2,   duration: 2, pitches: chromaFor(9, 0, 4),  loudness_max: -11 },
      { start: 4,   duration: 2, pitches: chromaFor(5, 9, 0),  loudness_max: -12 },
      { start: 6,   duration: 2, pitches: chromaFor(7, 11, 2), loudness_max: -10 },
      { start: 8,   duration: 2, pitches: chromaFor(0, 4, 7),  loudness_max: -9  },
      { start: 10,  duration: 2, pitches: chromaFor(9, 0, 4),  loudness_max: -10 },
      { start: 12,  duration: 2, pitches: chromaFor(5, 9, 0),  loudness_max: -11 },
      { start: 14,  duration: 2, pitches: chromaFor(7, 11, 2), loudness_max: -10 },
    ],
    beats: Array.from({ length: 120 }, (_, i) => ({ start: i * 0.5, duration: 0.5, confidence: 0.9 })),
  },
  gMajorSong: {
    track:    { tempo: 100, time_signature: 4, key: 7, mode: 1 },
    segments: [
      { start: 0,  duration: 2, pitches: chromaFor(7, 11, 2), loudness_max: -8  },
      { start: 2,  duration: 2, pitches: chromaFor(4, 8, 11), loudness_max: -10 },
      { start: 4,  duration: 2, pitches: chromaFor(0, 4, 7),  loudness_max: -11 },
      { start: 6,  duration: 2, pitches: chromaFor(2, 6, 9),  loudness_max: -9  },
    ],
    beats: Array.from({ length: 100 }, (_, i) => ({ start: i * 0.6, duration: 0.6, confidence: 0.85 })),
  },
};

// ── Lyrics fixture library ────────────────────────────────────────────────────
export const LYRICS_FIXTURES = {
  cMajorSong: [
    { startMs: 0,    text: 'First line of the verse' },
    { startMs: 2000, text: 'Second line of the verse' },
    { startMs: 4000, text: 'Third line' },
    { startMs: 6000, text: 'Into the chorus' },
  ],
  gMajorSong: [],
};

// ── Spicetify mock factory ────────────────────────────────────────────────────
export function createSpicetifyMock(options = {}) {
  const {
    currentTrackKey = 'cMajorSong',
    failAnalysis    = false,
    failLyrics      = false,
    playerState     = 'playing',
  } = options;

  const listeners = { songchange: [], appchange: [] };
  let _currentTrack = TRACK_FIXTURES[currentTrackKey];

  const mock = {
    // ── Player ──────────────────────────────────────────────────────────────
    Player: {
      data: {
        item: {
          uri:  _currentTrack.uri,
          name: _currentTrack.name,
          artists: [{ name: _currentTrack.artist }],
          album:   { name: _currentTrack.album },
          duration_ms: _currentTrack.duration_ms,
        },
      },
      origin: {
        get isPaused() { return playerState !== 'playing'; },
      },
      addEventListener(event, cb) {
        if (!listeners[event]) { listeners[event] = []; }
        listeners[event].push(cb);
      },
      removeEventListener(event, cb) {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(l => l !== cb);
        }
      },
    },

    // ── CosmosAsync (mocked HTTP) ────────────────────────────────────────────
    CosmosAsync: {
      get: jest.fn(async (url) => {
        if (url.includes('/audio-analysis/')) {
          if (failAnalysis) { throw new Error('Mock analysis fetch failed'); }
          return ANALYSIS_FIXTURES[currentTrackKey];
        }
        if (url.includes('/lyrics/')) {
          if (failLyrics) { return { lyrics: { lines: [] } }; }
          const lines = LYRICS_FIXTURES[currentTrackKey].map(l => ({
            startTimeMs: String(l.startMs),
            words: l.text,
          }));
          return { lyrics: { lines, syncType: 'LINE_SYNCED' } };
        }
        return {};
      }),
    },

    // ── PopupModal ───────────────────────────────────────────────────────────
    PopupModal: {
      display: jest.fn(({ title, content }) => {
        // No-op in tests
      }),
      hide: jest.fn(),
    },

    // ── Platform ─────────────────────────────────────────────────────────────
    Platform: {
      getAdManagement: jest.fn(() => ({ isAdFree: jest.fn(() => true) })),
    },

    // ── URI helpers ──────────────────────────────────────────────────────────
    URI: {
      fromString: jest.fn(str => ({ id: str.split(':')[2] ?? str })),
    },

    // ── Test helpers ─────────────────────────────────────────────────────────
    _emit(event, data) {
      for (const cb of listeners[event] ?? []) { cb(data); }
    },
    _setTrack(trackKey) {
      _currentTrack = TRACK_FIXTURES[trackKey];
      mock.Player.data.item = {
        uri:  _currentTrack.uri,
        name: _currentTrack.name,
        artists: [{ name: _currentTrack.artist }],
        album:   { name: _currentTrack.album },
        duration_ms: _currentTrack.duration_ms,
      };
    },
  };

  return mock;
}

// ── Install mock into global scope ────────────────────────────────────────────
/**
 * @param {ReturnType<typeof createSpicetifyMock>} mock
 */
export function installSpicetifyGlobal(mock) {
  global.Spicetify = mock;
  global.document  = global.document ?? {
    createElement: () => ({
      style: {},
      appendChild: () => {},
      addEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      textContent: '',
      innerHTML: '',
    }),
    body: {
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    getElementById: () => null,
    querySelector:  () => null,
    querySelectorAll: () => [],
  };
}

export function uninstallSpicetifyGlobal() {
  delete global.Spicetify;
}
