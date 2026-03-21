// chorduction.js
// Chorduction — Spicetify extension for chord analysis + per-chord lyrics
// Version: 6.1.0 - Enhanced UI with player controls, multiple lyric sources, chord levels

(function () {
  "use strict";
  
  // =============================
  // Global Error Boundary
  // =============================
  const GlobalErrorBoundary = {
      initialized: false,
      init() {
          if (this.initialized) return;
          this.initialized = true;
          window.addEventListener('error', (e) => console.error('[Chorduction] Global error:', e.error || e.message));
          window.addEventListener('unhandledrejection', (e) => console.error('[Chorduction] Unhandled rejection:', e.reason));
          console.log('[Chorduction] Global error boundary initialized');
      }
  };
  
  GlobalErrorBoundary.init();
  
  // =============================
  // Configuration & Settings
  // =============================
  const DEFAULT_CONFIG = {
      DEBUG_LEVEL: "INFO",
      DEBUG_CONSOLE_ENABLED: false,
      SMOOTHING_BEATS: 3,
      SHOW_NASHVILLE: true,
      SHOW_LYRICS: true,
      MIN_CONFIDENCE: 0.1,
      SYNCHRONIZATION_OFFSET_MS: 50,
      CHORD_SIMPLIFICATION: 1, // 1=simple, 2=7ths, 3=full extensions
      SECTION_LABELS_BY_LOUDNESS: true,
      CACHE_DURATION_MS: 10 * 60 * 1000, // 10 minutes
      QUEUE_CACHE_SIZE: 5,
      HISTORY_CACHE_SIZE: 5,
      REQUEST_TIMEOUT_MS: 15000,
      RETRY_ATTEMPTS: 2,
      ENABLE_KEYBOARD_SHORTCUTS: true,
      LANGUAGE: "en",
      LYRICS_PROVIDER: "lrclib",
      AUTO_REFRESH_ON_SONG_CHANGE: true,
      SHOW_FRETBOARD_DIAGRAMS: true,
      GROUP_CHORDS_BY_MEASURE: true,
      BEATS_PER_MEASURE: 4,
      // Transposing
      TRANSPOSE_SEMITONES: 0,
      MAX_TRANSPOSE: 12,
      // Chord notation
      CHORD_NOTATION: "standard", // standard, nashville, solfege, roman
      // Error handling
      SHOW_CONFIDENCE_THRESHOLD: true,
      CONFIDENCE_THRESHOLD: 0.3,
      ENABLE_MANUAL_OVERRIDE: true
  }
  
  const Settings = {
      STORAGE_KEY: "chorduction-settings-v6",
      load() {
          try {
              const stored = localStorage.getItem(this.STORAGE_KEY);
              if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
          } catch (e) {
              console.warn("[Chorduction] Failed to load settings:", e);
          }
          return { ...DEFAULT_CONFIG };
      },
      save(settings) {
          try {
              localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
          } catch (e) {
              console.warn("[Chorduction] Failed to save settings:", e);
          }
      },
  };
  
  const CONFIG = Settings.load();
  
  // =============================
  // Internationalization
  // =============================
  const TRANSLATIONS = {
      en: {
          title: "Chorduction",
          displayChords: "Display Chords:",
          basicsOnly: "Basics Only",
          intermediate: "Intermediate",
          advanced: "Advanced",
          language: "Language:",
          lyricsProvider: "Lyrics Provider:",
          autoscrollOn: "Autoscroll: On",
          autoscrollOff: "Autoscroll: Paused",
          external: "External:",
          noData: "No synced lyrics or chord data available.",
          error: "Error:",
          section: "Section",
          analyzing: "Analyzing track...",
          cancel: "Cancel",
          resume: "Resume",
          chordProgression: "Chord Progression",
          prevChord: "Previous Chord",
          playPause: "Play/Pause",
          nextChord: "Next Chord",
          chordInfo: "Chord Information",
          notes: "Notes:",
          intervals: "Intervals:",
          fretboard: "Fretboard:",
          // Transpose
          transpose: "Transpose",
          transposeUp: "Transpose Up",
          transposeDown: "Transpose Down",
          resetTranspose: "Reset Transpose",
          transposeValue: "Transpose: {0}",
          // Chord notations
          notation: "Notation:",
          standard: "Standard",
          nashville: "Nashville",
          solfege: "Solfege",
          roman: "Roman Numerals",
          // Error handling
          lowConfidence: "Low confidence",
          manualOverride: "Manual Override",
          confidence: "Confidence: {0}%",
          // Fretboard
          leftHanded: "Left-handed",
          capo: "Capo: {0}",
      },
      es: {
          title: "Chorduction",
          displayChords: "Mostrar Acordes:",
          basicsOnly: "Básico",
          intermediate: "Intermedio",
          advanced: "Avanzado",
          language: "Idioma:",
          lyricsProvider: "Proveedor de letras:",
          transpose: "Transponer",
          transposeUp: "Subir",
          transposeDown: "Bajar",
          resetTranspose: "Reiniciar",
          notation: "Notación:",
          standard: "Estándar",
          nashville: "Nashville",
          solfege: "Solfege",
          roman: "Números Romanos",
          noData: "No hay letras ni acordes disponibles.",
          analyzing: "Analizando pista...",
      },
      // Add other languages as needed
  };
  
  function getT(key, ...args) {
      const lang = TRANSLATIONS[CONFIG.LANGUAGE] || TRANSLATIONS.en;
      const text = lang[key] || TRANSLATIONS.en[key] || key;
      return args.length ? text.replace(/\{(\d+)\}/g, (_, i) => args[i] || '') : text;
  }
  
  // =============================
  // Cleanup Manager
  // =============================
  class CleanupManager {
      constructor() {
          this.listeners = new Set();
          this.timers = new Set();
          this.elements = new Set();
      }
      addListener(target, event, handler, options) {
          target?.addEventListener?.(event, handler, options);
          this.listeners.add({ target, event, handler, options });
      }
      addTimer(timerId) {
          this.timers.add(timerId);
          return timerId;
      }
      addElement(element) {
          this.elements.add(element);
          return element;
      }
      cleanup() {
          for (const l of this.listeners) {
              l.target?.removeEventListener?.(l.event, l.handler, l.options);
          }
          this.listeners.clear();
          for (const t of this.timers) {
              clearTimeout(t);
              clearInterval(t);
          }
          this.timers.clear();
          for (const el of this.elements) {
              if (el?.parentNode) el.remove();
          }
          this.elements.clear();
      }
  }
  
  const extensionCleanup = new CleanupManager();
  const panelCleanup = new CleanupManager();
  
  // =============================
  // Logger
  // =============================
  const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "OFF"];
  
  class Logger {
      constructor(name, level = "INFO", overlay = false) {
          this.name = name;
          this.levelIdx = LEVELS.indexOf(level);
          this.buffer = [];
          this.maxBuffer = 500;
          this.consoleEl = null;
          this.enabledOverlay = overlay;
          this.t0 = new Map();
          this.groupDepth = 0;
          if (overlay) this.ensureOverlay();
      }
  
      setLevel(level) {
          this.levelIdx = LEVELS.indexOf(level);
          this.render();
      }
  
      toggleOverlay() {
          this.enabledOverlay = !this.enabledOverlay;
          if (this.enabledOverlay) this.ensureOverlay();
          if (this.consoleEl) this.consoleEl.style.display = this.enabledOverlay ? "block" : "none";
      }
  
      ensureOverlay() {
          if (this.consoleEl) return;
          const el = document.createElement("div");
          el.id = "chorduction-debug-console";
          Object.assign(el.style, {
              position: "fixed",
              right: "10px",
              bottom: "10px",
              width: "520px",
              maxHeight: "40vh",
              overflow: "auto",
              background: "rgba(10,10,10,0.95)",
              color: "#ddd",
              font: "12px/1.35 monospace",
              border: "1px solid #444",
              borderRadius: "8px",
              zIndex: 999999,
              padding: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
          });
          el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
          document.body.appendChild(el);
          extensionCleanup.addElement(el);
          this.consoleEl = el;
          this.render();
      }
  
      time(label) { this.t0.set(label, performance.now()); }
      
      timeEnd(label) {
          const t = this.t0.get(label);
          if (t != null) {
              const dt = (performance.now() - t).toFixed(1);
              this.log("DEBUG", `⏱ ${label}: ${dt}ms`);
              this.t0.delete(label);
          }
      }
  
      group(label) {
          this.groupDepth++;
          this.log("DEBUG", "▼ " + label);
      }
  
      groupEnd() {
          if (this.groupDepth > 0) {
              this.groupDepth--;
              this.log("DEBUG", "▲");
          }
      }
  
      log(level, ...args) {
          const idx = LEVELS.indexOf(level);
          if (idx < this.levelIdx) return;
          const ts = new Date().toISOString().split("T")[1].replace("Z", "");
          const indent = "  ".repeat(this.groupDepth);
          const prefix = `[${ts}] [${this.name}] ${indent}${level}:`;
          const msg = [prefix, ...args].map((a) => (typeof a === "string" ? a : safeString(a))).join(" ");
          this.buffer.push(msg);
          if (this.buffer.length > this.maxBuffer) this.buffer.shift();
          
          try {
              const fn = level === "ERROR" || level === "WARN" ? console.error : console.log;
              fn("%c" + prefix, "color:#9cf", ...args);
          } catch {}
          
          if (this.enabledOverlay) this.render();
      }
  
      render() {
          if (!this.consoleEl) return;
          const html = this.buffer
              .slice(-200)
              .map((line) => {
                  const c = line.includes("ERROR") ? "#ff7b7b" : line.includes("WARN") ? "#ffd57b" : "#ddd";
                  return `<div style="color:${c}">${escapeHtml(line)}</div>`;
              })
              .join("");
          this.consoleEl.innerHTML = `<div style="margin-bottom:6px"><b>Chorduction Debug</b> | Level: ${LEVELS[this.levelIdx]}</div>${html}`;
          this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
      }
  
      trace(...a) { this.log("TRACE", ...a); }
      debug(...a) { this.log("DEBUG", ...a); }
      info(...a) { this.log("INFO", ...a); }
      warn(...a) { this.log("WARN", ...a); }
      error(...a) { this.log("ERROR", ...a); }
  }
  
  function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
  
  function safeString(obj) {
      try { return JSON.stringify(obj); } catch { return String(obj); }
  }
  
  const log = new Logger("Chorduction", CONFIG.DEBUG_LEVEL, CONFIG.DEBUG_CONSOLE_ENABLED);
  
  // =============================
  // Advanced Cache System
  // =============================
  class SmartCache {
      constructor(maxAge = CONFIG.CACHE_DURATION_MS, maxSize = 20) {
          this.cache = new Map();
          this.accessCount = new Map();
          this.maxAge = maxAge;
          this.maxSize = maxSize;
      }
  
      get(key) {
          const entry = this.cache.get(key);
          if (entry && Date.now() - entry.timestamp < this.maxAge) {
              this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
              return entry.data;
          }
          if (entry) this.cache.delete(key);
          return null;
      }
  
      set(key, data) {
          this.cache.set(key, { data, timestamp: Date.now() });
          this.accessCount.set(key, 1);
          this.evict();
      }
  
      evict() {
          if (this.cache.size <= this.maxSize) return;
          
          // LRU + access count based eviction
          const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
              key,
              value,
              score: (this.accessCount.get(key) || 0) / (Date.now() - value.timestamp + 1)
          }));
          
          entries.sort((a, b) => a.score - b.score);
          const toRemove = entries.slice(0, this.cache.size - this.maxSize);
          toRemove.forEach(({ key }) => {
              this.cache.delete(key);
              this.accessCount.delete(key);
          });
      }
  
      clear() {
          this.cache.clear();
          this.accessCount.clear();
      }
  
      has(key) {
          return this.cache.has(key) && Date.now() - this.cache.get(key).timestamp < this.maxAge;
      }
  }
  
  const analysisCache = new SmartCache();
  const lyricsCache = new SmartCache();
  const timelineCache = new SmartCache();
  
  // =============================
  // Spicetify API Helpers (with optional chaining)
  // =============================
  async function waitForSpicetify(timeoutMs = 20000) {
      const start = Date.now();
      while (!(window.Spicetify?.Player && (Spicetify.PopupModal || Spicetify.Platform))) {
          if (Date.now() - start > timeoutMs) {
              throw new Error("Spicetify not ready after " + timeoutMs + "ms");
          }
          await new Promise((r) => setTimeout(r, 200));
      }
  }
  
  function getCurrentTrackMeta() {
      try {
          // Use optional chaining for Spicetify API compatibility
          const playerData = Spicetify.Player?.data ?? {};
          const item = playerData?.item ?? playerData?.track ?? {};
          const meta = item?.metadata ?? {};
          const title = meta?.title ?? item?.name ?? "Unknown";
          const artist = item?.artists?.map?.((a) => a.name).join(", ") ?? meta?.artist_name ?? "Unknown";
          const uri = meta?.uri ?? item?.uri ?? playerData?.item?.uri;
          const duration = parseInt(meta?.duration ?? item?.duration_ms ?? 0);
          return { title, artist, uri, duration };
      } catch (e) {
          log.error("Failed to get track metadata:", e);
          return { title: "Unknown", artist: "Unknown", uri: null, duration: 0 };
      }
  }
  
  function spotifyIdFromUri(uri) {
      if (!uri) return null;
      // Handle formats: spotify:track:ID:suffix or spotify:track:ID
      // Also handles open.spotify.com/track/ID formats
      const match = uri.match(/spotify:track:([A-Za-z0-9]+)(?::[^:]+)?$|open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
      return match ? (match[1] || match[2]) : null;
  }
  
  async function getQueue() {
      try {
          // Use optional chaining for API compatibility
          const queue = await Spicetify?.Platform?.PlayerAPI?._queue ?? Spicetify?.Queue;
          return queue?.nextUp?.slice(0, CONFIG.QUEUE_CACHE_SIZE) || [];
      } catch (e) {
          log.debug("Failed to get queue:", e.message);
          return [];
      }
  }
  
  async function getHistory() {
      try {
          const queue = await Spicetify?.Platform?.PlayerAPI?._queue ?? Spicetify?.Queue;
          return queue?.prevTracks?.slice(-CONFIG.HISTORY_CACHE_SIZE) || [];
      } catch (e) {
          log.debug("Failed to get history:", e.message);
          return [];
      }
  }
  
  // =============================
  // Network Helpers
  // =============================
  async function timedFetch(url, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
      
      try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(timeout);
          return response;
      } catch (e) {
          clearTimeout(timeout);
          throw e;
      }
  }
  
  async function timedGet(url) {
      const promise = Spicetify?.CosmosAsync?.get?.(url) ?? fetch(url).then(r => r.json());
      const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), CONFIG.REQUEST_TIMEOUT_MS)
      );
      return Promise.race([promise, timeout]);
  }
  
  async function retryWithBackoff(fn, retries = CONFIG.RETRY_ATTEMPTS) {
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt++) {
          try {
              return await fn();
          } catch (e) {
              lastError = e;
              if (attempt < retries) {
                  await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
              }
          }
      }
      throw lastError;
  }
  
  // =============================
  // Transposing Module
  // =============================
  const Transposer = {
      // Note names (chromatic scale)
      NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
      
      // Semitone steps for each note
      semitone(note) {
          return this.NOTES.indexOf(note.toUpperCase().replace('♯', '#'));
      },
      
      // Transpose a note by semitones
      transposeNote(note, semitones) {
          const normalized = note.toUpperCase().replace('♯', '#').replace('♭', 'b');
          const idx = this.semitone(normalized.replace(/[b♭]/, ''));
          if (idx === -1) return note;
          
          const newIdx = (idx + semitones + 12) % 12;
          let newNote = this.NOTES[newIdx];
          
          // Preserve accidentals
          if (normalized.includes('b') || normalized.includes('♭')) {
              // Convert to flat notation if it was flat
              newNote = this.toFlat(newNote);
          }
          return newNote;
      },
      
      // Convert sharp to flat
      toFlat(note) {
          const flatMap = {
              'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
          };
          return flatMap[note] || note;
      },
      
      // Transpose a chord
      transpose(chord, semitones) {
          if (!chord || semitones === 0) return chord;
          
          // Match root note (with optional accidentals)
          const match = chord.match(/^([A-G][#b♯♭]?)(.*)$/);
          if (!match) return chord;
          
          const [, root, suffix] = match;
          const newRoot = this.transposeNote(root, semitones);
          return newRoot + suffix;
      },
      
      // Transpose a progression
      transposeProgression(progression, semitones) {
          return progression.map(chord => this.transpose(chord, semitones));
      },
      
      // Get transpose display
      getDisplay(semitones) {
          if (semitones === 0) return '';
          const sign = semitones > 0 ? '+' : '';
          return `${sign}${semitones}`;
      },
      
      // Apply transpose to current config
      setTranspose(semitones) {
          CONFIG.TRANSPOSE_SEMITONES = Math.max(-CONFIG.MAX_TRANSPOSE, Math.min(CONFIG.MAX_TRANSPOSE, semitones));
          Settings.save(CONFIG);
          log.info(`Transpose set to ${CONFIG.TRANSPOSE_SEMITONES} semitones`);
      },
      
      reset() {
          this.setTranspose(0);
      }
  };
  
  // =============================
  // Chord Notation Module
  // =============================
  const ChordNotation = {
      // Key mapping for notations
      KEY_MAPS: {
          standard: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
          nashville: ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'],
          solfege: ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Ti'],
          roman: ['I', 'I#', 'II', 'II#', 'III', 'IV', 'IV#', 'V', 'V#', 'VI', 'VI#', 'VII']
      },
      
      // Mode suffixes for Roman numerals
      MODE_SUFFIXES: {
          major: '',      // I, IV, V
          minor: 'm',     // ii, iii, vi
          dominant: '7',  // V7
          major7: 'maj7', // Imaj7
          minor7: 'm7',   // iim7
      },
      
      // Convert standard note to notation
      toNotation(note, notation, key = 'C', isMinor = false) {
          const maps = this.KEY_MAPS[notation];
          if (!maps) return note;
          
          const standardMap = this.KEY_MAPS.standard;
          const keyIndex = standardMap.indexOf(key.toUpperCase().replace('♯', '#').replace('♭', ''));
          const noteIndex = standardMap.indexOf(note.toUpperCase().replace('♯', '#').replace('♭', ''));
          
          if (keyIndex === -1 || noteIndex === -1) return note;
          
          // Calculate relative position in key
          const relativeIndex = (noteIndex - keyIndex + 12) % 12;
          const notationValue = maps[relativeIndex];
          
          // Apply case for Roman numerals based on mode
          if (notation === 'roman') {
              if (isMinor) {
                  return notationValue.toLowerCase();
              }
              return notationValue;
          }
          
          return notationValue;
      },
      
      // Convert chord to notation
      convert(chord, notation, detectedKey = 'C') {
          if (!chord || notation === 'standard') return chord;
          
          // Parse chord
          const match = chord.match(/^([A-G][#b♭]?)(.*)$/);
          if (!match) return chord;
          
          const [_, root, suffix] = match;
          const isMinor = suffix.toLowerCase().startsWith('m') && !suffix.toLowerCase().includes('maj');
          
          return this.toNotation(root, notation, detectedKey, isMinor) + suffix;
      },
      
      // Convert chord progression
      convertProgression(chords, notation, detectedKey = 'C') {
          return chords.map(chord => this.convert(chord, notation, detectedKey));
      },
      
      // Get available notations
      getAvailable() {
          return ['standard', 'nashville', 'solfege', 'roman'];
      },
      
      // Set current notation
      setNotation(notation) {
          if (this.getAvailable().includes(notation)) {
              CONFIG.CHORD_NOTATION = notation;
              Settings.save(CONFIG);
              log.info(`Chord notation set to ${notation}`);
          }
      },
      
      // Get display name for notation
      getDisplayName(notation) {
          const names = {
              standard: getT('standard'),
              nashville: getT('nashville'),
              solfege: getT('solfege'),
              roman: getT('roman')
          };
          return names[notation] || notation;
  
  // =============================
  // File Export Module
  // =============================
  const FileExporter = {
      formatMs(ms) {
          const s = Math.floor(ms / 1000);
          return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      },
      
      toTxt(data) {
          const { chords, meta, key } = data;
          let output = `# ${meta.title} - ${meta.artist}\n`;
          output += `# Key: ${key || 'Unknown'} | Generated by Chorduction v6.0.0\n\n`;
          for (const chord of chords || []) {
              output += `[${this.formatMs(chord.startMs)}] ${chord.chord}\n`;
          }
          return output;
      },
      
      toJson(data) {
          return JSON.stringify({
              meta: data.meta, key: data.key, tempo: data.tempo,
              chords: data.chords, exportedAt: new Date().toISOString(), version: '6.0.0'
          }, null, 2);
      },
      
      toChordPro(data) {
          const { chords, meta, key } = data;
          let output = `{title: ${meta.title}}\n{artist: ${meta.artist}}\n{key: ${key || 'C'}}\n\n`;
          for (const chord of chords || []) output += `[${chord.chord}]`;
          return output + `\n`;
      },
      
      download(content, filename, mimeType = 'text/plain') {
          const blob = new Blob([content], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      },
      
      export(data, format) {
          const safeTitle = (data.meta?.title || 'song').replace(/[^a-z0-9]/gi, '_');
          let content, filename;
          if (format === 'txt') { content = this.toTxt(data); filename = `${safeTitle}_chords.txt`; }
          else if (format === 'json') { content = this.toJson(data); filename = `${safeTitle}.json`; }
          else if (format === 'chordpro') { content = this.toChordPro(data); filename = `${safeTitle}.cho`; }
          this.download(content, filename);
          log.info(`Exported to ${format}: ${filename}`);
          return true;
      }
  };
      }
  };
  
  // =============================
  // Audio Analysis
  // =============================
  async function getAudioAnalysis(trackId, onStatus) {
      if (!trackId) throw new Error("No trackId provided");

      const cached = analysisCache.get(trackId);
      if (cached) {
          log.debug(`Analysis cache hit: ${trackId}`);
          return cached;
      }

      const url = `https://api.spotify.com/v1/audio-analysis/${trackId}`;

      for (let attempt = 0; attempt < 2; attempt++) {
          try {
              log.info(`Fetching audio analysis via CosmosAsync (attempt ${attempt + 1})...`);
              const data = await Spicetify.CosmosAsync.get(url);

              // CosmosAsync returns error objects instead of throwing on 4xx
              const httpStatus = data?.code || data?.status || data?.error?.status;
              if (httpStatus === 429) {
                  throw { status: 429 };
              }

              if (data?.segments?.length && (data.beats?.length || data.tatums?.length)) {
                  analysisCache.set(trackId, data);
                  log.debug('Analysis fetched via CosmosAsync');
                  return data;
              }
              log.warn('Analysis response missing segments/beats — data preview:', JSON.stringify(data)?.slice(0, 200));
              return null;
          } catch (e) {
              const errStr = String(e?.message || e?.error || e);
              const is429 = e?.code === 429 || e?.status === 429 || e?.error?.status === 429 || errStr.includes('429');

              if (is429 && attempt === 0) {
                  log.warn('Rate limited by Spotify (429) — retrying in 30s');
                  // Show countdown so the user knows what is happening
                  for (let s = 30; s > 0; s--) {
                      // Abort if the track changed while we were waiting
                      const nowId = spotifyIdFromUri(getCurrentTrackMeta?.()?.uri);
                      if (nowId && nowId !== trackId) {
                          log.info('Track changed during rate-limit wait — aborting');
                          return null;
                      }
                      if (onStatus) {
                          onStatus(`⏳ Spotify rate limit — retrying in ${s}s…`);
                      }
                      await new Promise(r => setTimeout(r, 1000));
                  }
                  continue; // retry once
              }

              log.warn(`Audio analysis failed: ${errStr}`);
              return null;
          }
      }

      return null;
  }
  
  // =============================
  // Multiple Lyrics Providers with Fallbacks
  // =============================
  
  // Provider 1: Spotify Internal (hm://color-lyrics)
  async function fetchFromSpotifyInternal(trackId) {
      if (!trackId) return null;
      const urls = [
          `hm://color-lyrics/v2/track/${trackId}?format=json&market=from_token`,
          `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`
      ];
      
      for (const url of urls) {
          try {
              const data = await (url.startsWith('hm://') 
                  ? Spicetify?.CosmosAsync?.get?.(url) 
                  : timedFetch(url).then(r => r.json()));
              
              if (data?.lyrics?.lines?.length) {
                  const lines = data.lyrics.lines.map(l => ({
                      startMs: parseInt(l.startTimeMs) || 0,
                      text: (l.words || '').trim()
                  })).filter(l => l.text);
                  
                  if (lines.length) {
                      log.info(`Lyrics found via spotify-internal: ${lines.length} lines`);
                      return { synced: true, lines, provider: 'spotify-internal' };
                  }
              }
          } catch (e) {
              log.debug(`Spotify internal lyrics failed: ${e.message}`);
          }
      }
      return null;
  }
  
  // Provider 2: LRCLIB
  async function fetchFromLRCLIB(artist, title, duration) {
      const baseURL = "https://lrclib.net/api/get";
      const params = new URLSearchParams({
          track_name: title,
          artist_name: artist,
          duration: Math.floor(duration / 1000),
      });

      try {
          const response = await timedFetch(`${baseURL}?${params}`, {
              headers: {
                  'User-Agent': 'Spicetify-Chorduction/6.1.0',
              },
          });

          if (!response.ok) return null;
          const data = await response.json();

          if (data?.syncedLyrics) {
              const lines = parseLRCLyrics(data.syncedLyrics);
              if (lines.synced?.length) {
                  log.info(`Lyrics found via lrclib: ${lines.synced.length} lines`);
                  return { synced: true, lines: lines.synced, provider: "lrclib" };
              }
          }
      } catch (e) {
          log.debug("LRCLIB fetch failed:", e.message);
      }
      return null;
  }
  
  function parseLRCLyrics(lyricsText) {
      const lines = lyricsText.trim().split('\n');
      const synced = [];
      const unsynced = [];
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
      for (const line of lines) {
          const match = line.match(timeRegex);
          if (match) {
              const minutes = parseInt(match[1]);
              const seconds = parseInt(match[2]);
              const centis = match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
              const startMs = (minutes * 60 + seconds) * 1000 + centis;
              const text = line.replace(timeRegex, '').trim();
              if (text) {
                  synced.push({ startMs, text });
              }
          } else if (line.trim()) {
              unsynced.push({ text: line.trim() });
          }
      }
  
      return { synced, unsynced };
  }
  
  // Spotify lyrics with graceful fallback
  async function fetchFromSpotify(trackId) {
      try {
          const lyricsData = await Spicetify?.Lyrics?.get?.(trackId);
          if (lyricsData?.lyrics) {
              const lines = parseLRCLyrics(lyricsData.lyrics);
              return {
                  synced: !!lines.synced?.length,
                  lines: lines.synced || lines.unsynced || [],
                  provider: "spotify"
              };
          }
      } catch (e) {
          log.debug("Spotify lyrics failed:", e.message);
      }
      return null;
  }
  
  async function fetchLyrics(artist, title, duration, trackId) {
      // Check cache first
      const cacheKey = `${artist}-${title}`;
      const cached = lyricsCache.get(cacheKey);
      if (cached) return cached;
  
      // Try configured provider first, then fallbacks
      const providers = ['lrclib', 'spotify'];
      const providerIndex = providers.indexOf(CONFIG.LYRICS_PROVIDER);
      const orderedProviders = [
          ...providers.slice(providerIndex),
          ...providers.slice(0, providerIndex)
      ];
  
      for (const provider of orderedProviders) {
          let result;
          if (provider === 'lrclib') {
              result = await fetchFromLRCLIB(artist, title, duration);
          } else if (provider === 'spotify' && trackId) {
              result = await fetchFromSpotify(trackId);
          }
  
          if (result?.lines?.length) {
              lyricsCache.set(cacheKey, result);
              log.debug(`Lyrics fetched via ${provider}`);
              return result;
          }
      }
  
      return { synced: false, lines: [], provider: null };
  }
  
  // =============================
  // Chord Detection Engine
  // =============================
  class ChordDetector {
      constructor() {
          // Chroma vector for each chord
          this.chordProfiles = this.buildChordProfiles();
          // Key profiles for Krumhansl-Schmuckler
          this.keyProfiles = this.buildKeyProfiles();
      }
  
      buildChordProfiles() {
          // Major and minor triads chroma vectors
          const profiles = {};
          
          // Major chords
          const majorRoots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
          const majorOffsets = [0, 4, 7];
          
          // Minor chords
          const minorOffsets = [0, 3, 7];
          
          const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          
          for (let root = 0; root < 12; root++) {
              // Major
              const majorChroma = new Array(12).fill(0);
              majorOffsets.forEach(off => majorChroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}`] = majorChroma;
              profiles[`${notes[root]}maj`] = majorChroma;
              
              // Minor
              const minorChroma = new Array(12).fill(0);
              minorOffsets.forEach(off => minorChroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}m`] = minorChroma;
              profiles[`${notes[root]}min`] = minorChroma;
              
              // 7th chords
              const dom7Offsets = [0, 4, 7, 10];
              const dom7Chroma = new Array(12).fill(0);
              dom7Offsets.forEach(off => dom7Chroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}7`] = dom7Chroma;
              
              const maj7Offsets = [0, 4, 7, 11];
              const maj7Chroma = new Array(12).fill(0);
              maj7Offsets.forEach(off => maj7Chroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}maj7`] = maj7Chroma;
              
              const min7Offsets = [0, 3, 7, 10];
              const min7Chroma = new Array(12).fill(0);
              min7Offsets.forEach(off => min7Chroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}m7`] = min7Chroma;
              
              // Diminished
              const dimOffsets = [0, 3, 6];
              const dimChroma = new Array(12).fill(0);
              dimOffsets.forEach(off => dimChroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}dim`] = dimChroma;
              profiles[`${notes[root]}°`] = dimChroma;
              
              // Augmented
              const augOffsets = [0, 4, 8];
              const augChroma = new Array(12).fill(0);
              augOffsets.forEach(off => augChroma[(root + off) % 12] = 1);
              profiles[`${notes[root]}aug`] = augChroma;
          }
          
          return profiles;
      }
  
      buildKeyProfiles() {
          // Krumhansl-Schmuckler key profiles (simplified)
          return {
              major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
              minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
          };
      }
  
      // Estimate key from chroma vector using Krumhansl-Schmuckler
      estimateKey(chromaVector) {
          const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          let bestKey = 'C';
          let bestScore = -Infinity;
  
          for (let i = 0; i < 12; i++) {
              // Test as major
              let majorScore = 0;
              for (let j = 0; j < 12; j++) {
                  majorScore += chromaVector[j] * this.keyProfiles.major[(j - i + 12) % 12];
              }
              
              // Test as minor
              let minorScore = 0;
              for (let j = 0; j < 12; j++) {
                  minorScore += chromaVector[j] * this.keyProfiles.minor[(j - i + 12) % 12];
              }
  
              if (majorScore > bestScore) {
                  bestScore = majorScore;
                  bestKey = notes[i];
              }
              if (minorScore > bestScore) {
                  bestScore = minorScore;
                  bestKey = notes[i] + 'm';
              }
          }
  
          return bestKey;
      }
  
      // Detect chord from chroma vector
      detectChord(chromaVector, confidenceThreshold = CONFIG.MIN_CONFIDENCE) {
          let bestChord = 'N';
          let bestSimilarity = 0;
          const similarities = [];
  
          for (const [chord, profile] of Object.entries(this.chordProfiles)) {
              const similarity = this.cosineSimilarity(chromaVector, profile);
              similarities.push({ chord, similarity });
              
              if (similarity > bestSimilarity) {
                  bestSimilarity = similarity;
                  bestChord = chord;
              }
          }
  
          // Sort by similarity (descending)
          similarities.sort((a, b) => b.similarity - a.similarity);
  
          // Return best chord if confidence is high enough
          const confidence = bestSimilarity;
          if (confidence >= confidenceThreshold) {
              return {
                  chord: bestChord,
                  confidence,
                  alternatives: similarities.slice(0, 3)
              };
          }
  
          return {
              chord: 'N',
              confidence,
              alternatives: similarities.slice(0, 3)
          };
      }
  
      cosineSimilarity(a, b) {
          let dotProduct = 0;
          let normA = 0;
          let normB = 0;
          for (let i = 0; i < 12; i++) {
              dotProduct += a[i] * b[i];
              normA += a[i] * a[i];
              normB += b[i] * b[i];
          }
          return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 0.0001);
      }
  
      // Process audio analysis to extract chords
      processAnalysis(analysis, lyrics) {
          if (!analysis?.segments?.length) {
              return { chords: [], key: 'C', confidence: 0 };
          }
  
          // Build chroma vector from segments
          const beats = analysis.beats || analysis.tatums || [];
          const avgChroma = new Array(12).fill(0);
          
          // Use first 30 seconds or first 50 segments for key detection
          const keySegments = analysis.segments.slice(0, 50).filter(s => s.pitches?.length === 12);
          for (const seg of keySegments) {
              for (let i = 0; i < 12; i++) {
                  avgChroma[i] += seg.pitches[i] || 0;
              }
          }
          if (keySegments.length > 0) {
              for (let i = 0; i < 12; i++) avgChroma[i] /= keySegments.length;
          }
  
          const detectedKey = this.estimateKey(avgChroma);
          log.info(`Detected key: ${detectedKey}`);
  
          // Detect chords per beat/bar with smoothing
          const chords = [];
          let currentChord = null;
          let chordStart = 0;
          const smoothingBeats = CONFIG.SMOOTHING_BEATS;
          let beatCount = 0;
  
          for (const beat of beats) {
              const segment = this.findSegmentForTime(beat.start, analysis.segments);
              if (!segment?.pitches?.length) continue;
  
              const result = this.detectChord(segment.pitches);
              
              // Apply smoothing
              if (result.chord === currentChord || beatCount < smoothingBeats) {
                  if (beatCount >= smoothingBeats && result.confidence > 0.3) {
                      currentChord = result.chord;
                  }
              } else {
                  if (currentChord) {
                      chords.push({
                          chord: currentChord,
                          startMs: chordStart * 1000,
                          endMs: beat.start * 1000,
                          confidence: result.confidence
                      });
                  }
                  currentChord = result.chord;
                  chordStart = beat.start;
              }
              beatCount++;
          }
  
          // Add final chord
          if (currentChord) {
              const lastBeat = beats[beats.length - 1];
              chords.push({
                  chord: currentChord,
                  startMs: chordStart * 1000,
                  endMs: lastBeat ? (lastBeat.start + lastBeat.duration) * 1000 : 0,
                  confidence: CONFIG.MIN_CONFIDENCE
              });
          }
  
          // Apply transpose
          const transposedChords = chords.map(c => ({
              ...c,
              chord: Transposer.transpose(c.chord, CONFIG.TRANSPOSE_SEMITONES)
          }));
  
          // Convert notation if needed
          const finalChords = CONFIG.CHORD_NOTATION !== 'standard'
              ? transposedChords.map(c => ({
                  ...c,
                  chord: ChordNotation.convert(c.chord, CONFIG.CHORD_NOTATION, detectedKey)
              }))
              : transposedChords;
  
          return {
              chords: finalChords,
              key: detectedKey,
              confidence: chords.reduce((sum, c) => sum + (c.confidence || 0), 0) / Math.max(chords.length, 1)
          };
      }
  
      findSegmentForTime(time, segments) {
          // Binary search for segment at time
          let left = 0, right = segments.length - 1;
          while (left <= right) {
              const mid = Math.floor((left + right) / 2);
              const seg = segments[mid];
              if (time >= seg.start && time < seg.start + seg.duration) {
                  return seg;
              }
              if (time < seg.start) {
                  right = mid - 1;
              } else {
                  left = mid + 1;
              }
          }
          return segments[0]; // Fallback
      }
  }
  
  const detector = new ChordDetector();
  
  // =============================
  // Chord-Lyrics Synchronization
  // =============================
  function syncChordsToLyrics(chords, lyrics) {
      if (!lyrics?.length) return chords;
  
      return chords.map(chord => {
          // Find lyric closest to chord start
          const closestLyric = lyrics.find(l => l.startMs >= chord.startMs) ||
                               lyrics[lyrics.length - 1];
          
          return {
              ...chord,
              lyric: closestLyric?.text || null
          };
      });
  }
  
  // =============================
  // Fretboard Diagram Generator
  // =============================
  function generateFretboardDiagram(chord) {
      const chordFingerings = {
          'C': { frets: [0, 1, 0, 2, 3, 2], baseFret: 1 },
          'C#': { frets: [4, 6, 5, 4, 4, 4], baseFret: 4 },
          'D': { frets: [0, 0, 0, 2, 3, 2], baseFret: 1 },
          'D#': { frets: [0, 1, 1, 1, 1, 1], baseFret: 1 },
          'E': { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
          'F': { frets: [1, 3, 3, 2, 1, 1], baseFret: 1 },
          'F#': { frets: [2, 4, 4, 3, 2, 2], baseFret: 2 },
          'G': { frets: [3, 2, 0, 0, 0, 3], baseFret: 3 },
          'G#': { frets: [4, 6, 5, 4, 4, 4], baseFret: 4 },
          'A': { frets: [0, 2, 2, 2, 0, 0], baseFret: 1 },
          'A#': { frets: [1, 3, 3, 3, 1, 1], baseFret: 1 },
          'B': { frets: [2, 4, 4, 4, 2, 2], baseFret: 2 },
          'Am': { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
          'Bm': { frets: [2, 4, 4, 2, 2, 2], baseFret: 2 },
          'Dm': { frets: [0, 0, 2, 2, 1, 0], baseFret: 1 },
          'Em': { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
          'Fm': { frets: [1, 3, 3, 1, 1, 1], baseFret: 1 },
          'Gm': { frets: [3, 5, 5, 3, 3, 3], baseFret: 3 },
      };
  
      // Apply transpose
      const transposedChord = Transposer.transpose(chord, CONFIG.TRANSPOSE_SEMITONES);
      const fingering = chordFingerings[transposedChord] || chordFingerings[chord];
      
      if (!fingering) return null;
  
      // Generate SVG
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 120 100");
      svg.style.width = "120px";
      svg.style.height = "100px";
  
      // Draw strings
      for (let i = 0; i < 6; i++) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", 20 + i * 20);
          line.setAttribute("y1", 10);
          line.setAttribute("x2", 20 + i * 20);
          line.setAttribute("y2", 90);
          line.setAttribute("stroke", "#555");
          line.setAttribute("stroke-width", "2");
          svg.appendChild(line);
      }
  
      // Draw frets
      for (let i = 0; i < 5; i++) {
          const fret = document.createElementNS("http://www.w3.org/2000/svg", "line");
          fret.setAttribute("x1", 10);
          fret.setAttribute("y1", 10 + i * 20);
          fret.setAttribute("x2", 110);
          fret.setAttribute("y2", 10 + i * 20);
          fret.setAttribute("stroke", "#555");
          fret.setAttribute("stroke-width", "2");
          svg.appendChild(fret);
      }
  
      // Draw finger dots
      const baseFret = fingering.baseFret;
      fingering.frets.forEach((fret, string) => {
          if (fret > 0) {
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("cx", 20 + string * 20);
              circle.setAttribute("cy", 10 + (fret - baseFret) * 20);
              circle.setAttribute("r", "6");
              circle.setAttribute("fill", "#1db954");
              svg.appendChild(circle);
          }
      });
  
      // Open strings (X or O)
      fingering.frets.forEach((fret, string) => {
          if (fret === 0) {
              const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
              text.setAttribute("x", 20 + string * 20);
              text.setAttribute("y", 5);
              text.setAttribute("text-anchor", "middle");
              text.setAttribute("fill", "#888");
              text.setAttribute("font-size", "10");
              text.textContent = "○";
              svg.appendChild(text);
          }
      });
  
      return svg;
  }
  
  // =============================
  // Player Controls
  // =============================
  function createPlayerControls() {
      const container = document.createElement("div");
      container.id = "chorduction-player-controls";
      container.style.cssText = `
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
          border-radius: 24px;
          margin-bottom: 12px;
          align-items: center;
          justify-content: center;
      `;
      
      // Previous track
      const prevBtn = document.createElement("button");
      prevBtn.innerHTML = "⏮";
      prevBtn.title = "Previous Track";
      prevBtn.style.cssText = `
          background: transparent;
          border: none;
          color: #b3b3b3;
          font-size: 16px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 50%;
          transition: all 0.2s;
      `;
      prevBtn.onmouseover = () => { prevBtn.style.color = "#fff"; prevBtn.style.background = "#333"; };
      prevBtn.onmouseout = () => { prevBtn.style.color = "#b3b3b3"; prevBtn.style.background = "transparent"; };
      prevBtn.onclick = () => Spicetify.Player?.prev?.();
      
      // Play/Pause
      const playPauseBtn = document.createElement("button");
      playPauseBtn.id = "chorduction-playpause-btn";
      playPauseBtn.innerHTML = "▶";
      playPauseBtn.title = "Play/Pause";
      playPauseBtn.style.cssText = `
          background: #1db954;
          border: none;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          padding: 8px 14px;
          border-radius: 50%;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
      `;
      playPauseBtn.onmouseover = () => { playPauseBtn.style.transform = "scale(1.1)"; };
      playPauseBtn.onmouseout = () => { playPauseBtn.style.transform = "scale(1)"; };
      playPauseBtn.onclick = () => Spicetify.Player?.togglePlay?.();
      
      // Update play/pause icon based on player state
      const updatePlayPauseIcon = () => {
          const isPlaying = Spicetify?.Player?.isPlaying?.() ?? false;
          playPauseBtn.innerHTML = isPlaying ? "⏸" : "▶";
      };
      
      // Listen for player state changes
      if (Spicetify?.Player) {
          Spicetify.Player.addEventListener("onplaypause", updatePlayPauseIcon);
          updatePlayPauseIcon();
      }
      
      // Next track
      const nextBtn = document.createElement("button");
      nextBtn.innerHTML = "⏭";
      nextBtn.title = "Next Track";
      nextBtn.style.cssText = `
          background: transparent;
          border: none;
          color: #b3b3b3;
          font-size: 16px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 50%;
          transition: all 0.2s;
      `;
      nextBtn.onmouseover = () => { nextBtn.style.color = "#fff"; nextBtn.style.background = "#333"; };
      nextBtn.onmouseout = () => { nextBtn.style.color = "#b3b3b3"; nextBtn.style.background = "transparent"; };
      nextBtn.onclick = () => Spicetify.Player?.next?.();
      
      // Stop
      const stopBtn = document.createElement("button");
      stopBtn.innerHTML = "⏹";
      stopBtn.title = "Stop";
      stopBtn.style.cssText = `
          background: transparent;
          border: none;
          color: #b3b3b3;
          font-size: 14px;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 50%;
          transition: all 0.2s;
      `;
      stopBtn.onmouseover = () => { stopBtn.style.color = "#fff"; stopBtn.style.background = "#333"; };
      stopBtn.onmouseout = () => { stopBtn.style.color = "#b3b3b3"; stopBtn.style.background = "transparent"; };
      stopBtn.onclick = () => {
          Spicetify.Player?.pause?.();
          Spicetify.Player?.seek?.(0);
      };
      
      // Current track info
      const trackInfo = document.createElement("div");
      trackInfo.id = "chorduction-track-info";
      trackInfo.style.cssText = `
          flex: 1;
          text-align: center;
          font-size: 11px;
          color: #888;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 0 8px;
      `;
      trackInfo.textContent = "No track playing";
      
      const updateTrackInfo = () => {
          const meta = getCurrentTrackMeta();
          trackInfo.textContent = meta.title && meta.artist 
              ? `${meta.title} - ${meta.artist}` 
              : "No track playing";
      };
      
      if (Spicetify?.Player) {
          Spicetify.Player.addEventListener("ontrackchange", updateTrackInfo);
          Spicetify.Player.addEventListener("onplaypause", updateTrackInfo);
          updateTrackInfo();
      }
      
      container.appendChild(prevBtn);
      container.appendChild(playPauseBtn);
      container.appendChild(nextBtn);
      container.appendChild(stopBtn);
      container.appendChild(trackInfo);
      
      return container;
  }
  
  // =============================
  // UI Components
  // =============================
  function createMainButton() {
      const btn = document.createElement("button");
      btn.className = "player-controls__button";
      btn.id = "chorduction-btn";
      // Use emoji for better visibility
      btn.innerHTML = `<span style="font-size: 20px; line-height: 1;">🎸</span>`;
      btn.title = "Open Chorduction (Alt+T)";
      btn.addEventListener("click", () => showMainPanel());
      return btn;
  }
  
  function showMainPanel() {
      // Check if modal exists - use correct API format
      if (Spicetify.PopupModal?.display) {
          Spicetify.PopupModal.display({
              title: "🎸 Chorduction",
              content: getMainPanelContent(),
              isLarge: true
          });
          return;
      }
  
      // Fallback to custom modal
      if (document.getElementById("chorduction-modal")) {
          document.getElementById("chorduction-modal").remove();
      }
  
      const modal = document.createElement("div");
      modal.id = "chorduction-modal";
      Object.assign(modal.style, {
          position: "fixed",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          background: "rgba(0,0,0,0.8)",
          zIndex: "99999",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
      });
  
      const content = getMainPanelContent();
      Object.assign(content.style, {
          background: "#282828",
          borderRadius: "8px",
          maxWidth: "800px",
          maxHeight: "80vh",
          overflow: "auto",
          padding: "20px",
          color: "#fff",
      });
  
      modal.appendChild(content);
      document.body.appendChild(modal);
      panelCleanup.addElement(modal);
  
      modal.addEventListener("click", (e) => {
          if (e.target === modal) modal.remove();
      });
  }
  
  function getMainPanelContent() {
      const container = document.createElement("div");
      container.id = "chorduction-panel";

      // Header with version
      const header = document.createElement("div");
      header.innerHTML = `
          <h2 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 12px;">
              ${getT('title')}
              <span style="font-size: 12px; color: #888;">v6.1.0</span>
          </h2>
      `;
      container.appendChild(header);

      // Player Controls - Integrated at top of panel
      const playerControls = createPlayerControls();
      container.appendChild(playerControls);

      // Transpose and Notation row - compact
      const controlsRow = document.createElement("div");
      controlsRow.style.cssText = "display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; align-items: center;";
      controlsRow.innerHTML = `
          <div style="display: flex; gap: 4px; align-items: center;">
              <button id="transpose-down" style="padding: 4px 8px; border-radius: 4px; border: none; background: #444; color: #fff; cursor: pointer; font-size: 12px;">−</button>
              <span id="transpose-value" style="min-width: 40px; text-align: center; font-size: 12px;">${Transposer.getDisplay(CONFIG.TRANSPOSE_SEMITONES) || '0'}</span>
              <button id="transpose-up" style="padding: 4px 8px; border-radius: 4px; border: none; background: #444; color: #fff; cursor: pointer; font-size: 12px;">+</button>
          </div>
          <select id="notation-select" style="padding: 4px 8px; border-radius: 4px; border: none; background: #333; color: #fff; font-size: 12px;">
              ${ChordNotation.getAvailable().map(n => `<option value="${n}" ${CONFIG.CHORD_NOTATION === n ? 'selected' : ''}>${ChordNotation.getDisplayName(n)}</option>`).join('')}
          </select>
          <select id="chord-level-select" style="padding: 4px 8px; border-radius: 4px; border: none; background: #333; color: #fff; font-size: 12px;">
              <option value="1" ${CONFIG.CHORD_SIMPLIFICATION === 1 ? 'selected' : ''}>${getT('basicsOnly')}</option>
              <option value="2" ${CONFIG.CHORD_SIMPLIFICATION === 2 ? 'selected' : ''}>${getT('intermediate')}</option>
              <option value="3" ${CONFIG.CHORD_SIMPLIFICATION === 3 ? 'selected' : ''}>${getT('advanced')}</option>
          </select>
      `;
      container.appendChild(controlsRow);
  
      // Transpose event listeners - use controlsRow
      controlsRow.querySelector('#transpose-down')?.addEventListener('click', () => {
          Transposer.setTranspose(CONFIG.TRANSPOSE_SEMITONES - 1);
          controlsRow.querySelector('#transpose-value').textContent = Transposer.getDisplay(CONFIG.TRANSPOSE_SEMITONES) || '0';
      });
      controlsRow.querySelector('#transpose-up')?.addEventListener('click', () => {
          Transposer.setTranspose(CONFIG.TRANSPOSE_SEMITONES + 1);
          controlsRow.querySelector('#transpose-value').textContent = Transposer.getDisplay(CONFIG.TRANSPOSE_SEMITONES) || '0';
      });
      controlsRow.querySelector('#notation-select')?.addEventListener('change', (e) => {
          ChordNotation.setNotation(e.target.value);
      });
      controlsRow.querySelector('#chord-level-select')?.addEventListener('change', (e) => {
          CONFIG.CHORD_SIMPLIFICATION = parseInt(e.target.value);
          Settings.save(CONFIG);
          log.info(`Chord level set to ${CONFIG.CHORD_SIMPLIFICATION}`);
      });
  
      // Chord display area
      const chordDisplay = document.createElement("div");
      chordDisplay.id = "chord-display";
      chordDisplay.style.cssText = "min-height: 100px; padding: 16px; background: #1a1a1a; border-radius: 8px; margin-bottom: 16px;";
      if (currentAnalysis?.chords?.length) {
          // Panel reopened — show existing analysis immediately
          setTimeout(() => updateChordDisplay(currentAnalysis.chords, currentAnalysis.lyrics, currentAnalysis.key), 0);
      } else {
          chordDisplay.innerHTML = `<div style="color: #888;">${getT('analyzing')}</div>`;
          // Reset debounce so panel open always triggers fresh analysis
          lastAnalysisStartMs = 0;
          setTimeout(analyzeCurrentTrack, 100);
      }
      container.appendChild(chordDisplay);
  
      // Settings toggle
      const settingsToggle = document.createElement("details");
      settingsToggle.innerHTML = `
          <summary style="cursor: pointer; padding: 8px; background: #333; border-radius: 4px;">Settings</summary>
          <div style="padding: 16px;">
              <label style="display: block; margin-bottom: 12px;">
                  <input type="checkbox" id="show-lyrics" ${CONFIG.SHOW_LYRICS ? 'checked' : ''}> ${getT('showLyrics')}
              </label>
              <label style="display: block; margin-bottom: 12px;">
                  <input type="checkbox" id="show-fretboard" ${CONFIG.SHOW_FRETBOARD_DIAGRAMS ? 'checked' : ''}> ${getT('fretboard')}
              </label>
              <label style="display: block; margin-bottom: 12px;">
                  <input type="checkbox" id="autoscroll" ${CONFIG.AUTO_REFRESH_ON_SONG_CHANGE ? 'checked' : ''}> Autoscroll on song change
              </label>
          </div>
      `;
      container.appendChild(settingsToggle);
  
      // Handle settings changes
      settingsToggle.querySelector('#show-lyrics')?.addEventListener('change', (e) => {
          CONFIG.SHOW_LYRICS = e.target.checked;
          Settings.save(CONFIG);
      });
      settingsToggle.querySelector('#show-fretboard')?.addEventListener('change', (e) => {
          CONFIG.SHOW_FRETBOARD_DIAGRAMS = e.target.checked;
          Settings.save(CONFIG);
      });
      settingsToggle.querySelector('#autoscroll')?.addEventListener('change', (e) => {
          CONFIG.AUTO_REFRESH_ON_SONG_CHANGE = e.target.checked;
          Settings.save(CONFIG);
      });
  
      // Store reference for updates
      
      // Export buttons - compact row
      const exportSection = document.createElement("div");
      exportSection.style.cssText = "margin-top: 12px; padding: 8px; background: #1a1a1a; border-radius: 8px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;";
      exportSection.innerHTML = `
          <span style="color: #888; font-size: 11px; margin-right: 4px;">Save:</span>
          <button id="export-txt" title="Export as text" style="padding: 4px 10px; border-radius: 4px; border: none; background: #333; color: #ccc; cursor: pointer; font-size: 11px;">TXT</button>
          <button id="export-json" title="Export as JSON" style="padding: 4px 10px; border-radius: 4px; border: none; background: #333; color: #ccc; cursor: pointer; font-size: 11px;">JSON</button>
          <button id="export-chordpro" title="Export as ChordPro" style="padding: 4px 10px; border-radius: 4px; border: none; background: #333; color: #ccc; cursor: pointer; font-size: 11px;">CPro</button>
      `;
      container.appendChild(exportSection);
      
      // Export event listeners
      exportSection.querySelector('#export-txt')?.addEventListener('click', () => {
          if (currentAnalysis) {
              FileExporter.export({...currentAnalysis, meta: getCurrentTrackMeta()}, 'txt');
              Spicetify.showNotification?.('Exported!');
          }
      });
      exportSection.querySelector('#export-json')?.addEventListener('click', () => {
          if (currentAnalysis) {
              FileExporter.export({...currentAnalysis, meta: getCurrentTrackMeta()}, 'json');
              Spicetify.showNotification?.('Exported!');
          }
      });
      exportSection.querySelector('#export-chordpro')?.addEventListener('click', () => {
          if (currentAnalysis) {
              FileExporter.export({...currentAnalysis, meta: getCurrentTrackMeta()}, 'chordpro');
              Spicetify.showNotification?.('Exported!');
          }
      });
      window._chorductionChordDisplay = chordDisplay;
      window._chorductionContainer = container;
  
      return container;
  }
  
  function updateChordDisplay(chords, lyrics, key) {
      const display = document.getElementById("chord-display") || window._chorductionChordDisplay;
      if (!display) return;
  
      if (!chords?.length) {
          display.innerHTML = `<div style="color: #888;">${getT('noData')}</div>`;
          return;
      }
  
      const container = document.createElement("div");
  
      // Group by measure if enabled
      const grouped = CONFIG.GROUP_CHORDS_BY_MEASURE;
      let currentMeasure = null;
  
      for (const chord of chords) {
          const measure = Math.floor(chord.startMs / (CONFIG.BEATS_PER_MEASURE * 500)); // Rough measure estimate
          
          if (grouped && measure !== currentMeasure) {
              const measureHeader = document.createElement("div");
              measureHeader.style.cssText = "border-bottom: 1px solid #444; padding: 8px 0; margin-top: 8px; color: #888; font-size: 12px;";
              measureHeader.textContent = `Measure ${measure + 1}`;
              container.appendChild(measureHeader);
              currentMeasure = measure;
          }
  
          const chordEl = document.createElement("div");
          chordEl.style.cssText = "display: flex; align-items: center; gap: 12px; padding: 8px; background: #2a2a2a; border-radius: 4px; margin: 4px 0;";
          
          // Chord name
          const chordName = document.createElement("span");
          chordName.style.cssText = "font-size: 18px; font-weight: bold; min-width: 60px; color: #1db954;";
          chordName.textContent = chord.chord;
          chordEl.appendChild(chordName);
  
          // Confidence indicator
          if (CONFIG.SHOW_CONFIDENCE_THRESHOLD) {
              const confEl = document.createElement("span");
              const confPercent = Math.round((chord.confidence || 0) * 100);
              confEl.style.cssText = `font-size: 11px; padding: 2px 6px; border-radius: 3px; background: ${confPercent < 30 ? '#ff6b6b' : confPercent < 50 ? '#ffd93d' : '#6bcb77'}; color: #000;`;
              confEl.textContent = `${confPercent}%`;
              chordEl.appendChild(confEl);
          }
  
          // Lyrics
          if (CONFIG.SHOW_LYRICS && chord.lyric) {
              const lyricEl = document.createElement("span");
              lyricEl.style.cssText = "flex: 1; color: #ccc;";
              lyricEl.textContent = chord.lyric;
              chordEl.appendChild(lyricEl);
          }
  
          // Fretboard diagram
          if (CONFIG.SHOW_FRETBOARD_DIAGRAMS) {
              const diagram = generateFretboardDiagram(chord.chord);
              if (diagram) {
                  chordEl.appendChild(diagram);
              }
          }
  
          // Manual override button
          if (CONFIG.ENABLE_MANUAL_OVERRIDE) {
              const overrideBtn = document.createElement("button");
              overrideBtn.textContent = getT('manualOverride');
              overrideBtn.style.cssText = "padding: 4px 8px; font-size: 11px; border-radius: 3px; border: none; background: #444; color: #fff; cursor: pointer;";
              overrideBtn.addEventListener('click', () => {
                  const newChord = prompt('Enter chord:', chord.chord);
                  if (newChord) {
                      chord.chord = newChord;
                      updateChordDisplay(chords, lyrics, key);
                  }
              });
              chordEl.appendChild(overrideBtn);
          }
  
          container.appendChild(chordEl);
      }
  
      display.innerHTML = "";
      display.appendChild(container);
  }
  
  // =============================
  // Main Analysis Loop
  // =============================
  let currentAnalysis = null;
  let analysisInProgress = false;
  let lastAttemptedTrackId = null;
  let lastAnalysisStartMs = 0;
  
  async function analyzeCurrentTrack() {
      const _now = Date.now();
      if (analysisInProgress || (_now - lastAnalysisStartMs < 2000)) {
          log.debug("Analysis debounced or already in progress");
          return;
      }
      lastAnalysisStartMs = _now;
  
      const _trackId = spotifyIdFromUri(getCurrentTrackMeta()?.uri);
      if (_trackId && _trackId === lastAttemptedTrackId && !analysisCache.get(_trackId)) {
          log.debug("Already attempted this track — skipping repeat");
          return;
      }

      analysisInProgress = true;
      const getDisplay = () => document.getElementById("chord-display") || window._chorductionChordDisplay;
      if (getDisplay()) {
          getDisplay().innerHTML = `<div style="color: #888;">${getT('analyzing')}</div>`;
      }
  
      try {
          const meta = getCurrentTrackMeta();
          log.info(`Analyzing: ${meta.title} - ${meta.artist}`);
  
          const trackId = spotifyIdFromUri(meta.uri);
          if (!trackId) {
              // Podcast, local file, ad — silently do nothing
              if (getDisplay()) getDisplay().innerHTML = "";
              analysisInProgress = false;
              return;
          }
          lastAttemptedTrackId = trackId;
  
          // Get audio analysis — passes onStatus so rate-limit countdown is visible
          const analysis = await getAudioAnalysis(trackId, (msg) => {
              if (getDisplay()) getDisplay().innerHTML = `<div style="color: #888; text-align: center; padding: 20px;">${msg}</div>`;
          });
          
          if (!analysis) {
              // Audio analysis unavailable - show user-friendly message with manual entry option
              log.info("Audio analysis unavailable - showing manual entry option");
              if (getDisplay()) {
                  getDisplay().innerHTML = `
                      <div style="text-align: center; padding: 20px; color: #ccc;">
                          <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
                          <div style="font-size: 16px; margin-bottom: 8px;">Audio Analysis Unavailable</div>
                          <div style="font-size: 13px; color: #888; margin-bottom: 20px;">
                              Spotify's audio analysis API is rate-limited or blocked.<br>
                              You can manually enter chords below.
                          </div>
                          <button id="manual-chord-entry" style="
                              padding: 10px 20px; 
                              border-radius: 20px; 
                              border: none; 
                              background: #1db954; 
                              color: #fff; 
                              cursor: pointer;
                              font-size: 14px;
                          ">Add Chords Manually</button>
                      </div>
                  `;
                  getDisplay().querySelector('#manual-chord-entry')?.addEventListener('click', () => {
                      manualChordEntry(meta);
                  });
              }
              analysisInProgress = false;
              return;
          }
          
          // Get lyrics
          const lyricsResult = await fetchLyrics(meta.artist, meta.title, meta.duration, trackId);
          
          // Process and detect chords
          const result = detector.processAnalysis(analysis, lyricsResult.lines);
          
          // Sync chords to lyrics
          const syncedChords = syncChordsToLyrics(result.chords, lyricsResult.lines);
          
          currentAnalysis = { chords: syncedChords, key: result.key, lyrics: lyricsResult.lines };
          
          // Update display
          updateChordDisplay(syncedChords, lyricsResult.lines, result.key);
          
          log.info(`Analysis complete: ${syncedChords.length} chords detected in key ${result.key}`);
  
      } catch (e) {
          log.error("Analysis failed:", e);
          if (getDisplay()) {
              getDisplay().innerHTML = `
                  <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                      <div style="font-size: 14px; margin-bottom: 8px;">Analysis Unavailable</div>
                      <div style="font-size: 12px; color: #888;">${e.message}</div>
                  </div>
              `;
          }
      } finally {
          analysisInProgress = false;
      }
  }
  
  // Manual chord entry fallback
  function manualChordEntry(meta) {
      const display = document.getElementById("chord-display") || window._chorductionChordDisplay;
      if (!display) return;
      
      const chords = [];
      const numChords = prompt("How many chords in this song?", "4");
      if (!numChords) return;
      
      for (let i = 0; i < parseInt(numChords); i++) {
          const chord = prompt(`Chord ${i + 1}:`, "C");
          if (chord) {
              chords.push({
                  chord: Transposer.transpose(chord, CONFIG.TRANSPOSE_SEMITONES),
                  startMs: i * 4000,
                  endMs: (i + 1) * 4000,
                  confidence: 1,
                  lyric: null
              });
          }
      }
      
      if (chords.length > 0) {
          currentAnalysis = { chords, key: 'C', lyrics: [] };
          updateChordDisplay(chords, [], 'C');
      }
  }
  
  // =============================
  // Event Handlers
  // =============================
  function setupEventListeners() {
      // Player state changes
      extensionCleanup.addListener(Spicetify.Player, "onplaypause", () => {
          // Play/pause does not change the track — no re-analysis needed
      });
  
      extensionCleanup.addListener(Spicetify.Player, "ontrackchange", () => {
          if (CONFIG.AUTO_REFRESH_ON_SONG_CHANGE) {
              analyzeCurrentTrack();
          }
      });
  
      // Keyboard shortcuts
      if (CONFIG.ENABLE_KEYBOARD_SHORTCUTS) {
          extensionCleanup.addListener(document, "keydown", (e) => {
              if (e.altKey && e.key === "t") {
                  // Alt+T: Open panel
                  showMainPanel();
              }
              if (e.altKey && e.key === "ArrowUp") {
                  Transposer.setTranspose(CONFIG.TRANSPOSE_SEMITONES + 1);
              }
              if (e.altKey && e.key === "ArrowDown") {
                  Transposer.setTranspose(CONFIG.TRANSPOSE_SEMITONES - 1);
              }
          });
      }
  }
  
  // =============================
  // Initialization
  // =============================
  let menuRegistered = false;
  
  async function init() {
      try {
          log.info("Initializing Chorduction v6.0.0");
          
          await waitForSpicetify();
          log.info("Spicetify API ready");
  
          // Method 1: Try Spicetify.Menu (new API)
          if (Spicetify.Menu?.register) {
              try {
                  Spicetify.Menu.register("🎸 Chorduction", showMainPanel);
                  menuRegistered = true;
                  log.info("Registered in Spicetify Menu");
              } catch (e) {
                  log.warn("Menu.register failed:", e.message);
              }
          }
          
          // Method 2: Try Spicetify.Topbar (alternative)
          if (!menuRegistered && Spicetify.Topbar?.register) {
              try {
                  Spicetify.Topbar.register("🎸 Chorduction", showMainPanel);
                  menuRegistered = true;
                  log.info("Registered in Spicetify Topbar");
              } catch (e) {
                  log.warn("Topbar.register failed:", e.message);
              }
          }
  
          // Method 3: Add button to player controls (always try as fallback)
          const addButtonToPlayer = () => {
              try {
                  // Try multiple selectors for different Spotify versions
                  const selectors = [
                      ".player-controls__right",
                      ".player-controls__buttons",
                      ".player-controls",
                      "[data-testid='player-controls']",
                      ".main-nowPlayingBar-nowPlayingBar"
                  ];
                  
                  let container = null;
                  for (const selector of selectors) {
                      container = document.querySelector(selector);
                      if (container) break;
                  }
                  
                  if (container) {
                      const existingBtn = document.getElementById("chorduction-btn");
                      if (!existingBtn) {
                          const btn = createMainButton();
                          btn.style.cssText = `
                              background: transparent;
                              border: none;
                              color: #b3b3b3;
                              cursor: pointer;
                              padding: 8px;
                              border-radius: 50%;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              transition: color 0.2s;
                          `;
                          btn.onmouseover = () => btn.style.color = "#fff";
                          btn.onmouseout = () => btn.style.color = "#b3b3b3";
                          container.appendChild(btn);
                          extensionCleanup.addElement(btn);
                          log.info("Button added to player controls via selector:", container.className);
                          return true;
                      }
                  }
              } catch (e) {
                  log.warn("Failed to add button:", e.message);
              }
              return false;
          };
  
          // Try immediately
          let buttonAdded = addButtonToPlayer();
          
          // Retry with delays if button not added
          if (!buttonAdded) {
              for (const delay of [500, 1000, 2000, 3000, 5000]) {
                  setTimeout(() => {
                      if (!document.getElementById("chorduction-btn")) {
                          addButtonToPlayer();
                      }
                  }, delay);
              }
          }
          
          // Also add to right-click context menu as ultimate fallback
          document.addEventListener("contextmenu", (e) => {
              // Only add if no button or menu exists
              if (!menuRegistered && !document.getElementById("chorduction-btn")) {
                  // Could add context menu item here if needed
              }
          });
  
          // Setup event listeners
          setupEventListeners();
  
          // Analyze current track
          setTimeout(analyzeCurrentTrack, 1500);
  
          log.info("Chorduction initialized successfully");
          log.info("Use Alt+T keyboard shortcut to open panel");
  
      } catch (e) {
          log.error("Failed to initialize:", e);
      }
  }
  
  // Start when DOM is ready
  if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
  } else {
      init();
  }
  
  // Cleanup on unload
  window.addEventListener("unload", () => {
      extensionCleanup.cleanup();
      panelCleanup.cleanup();
  });
  
  // Export for error handling
  window.onChorductionError = function(error) {
      log.error("Chorduction error handler:", error);
      // Attempt graceful recovery
      analysisInProgress = false;
  };
  
  })();
