// chorduction.js
// Chorduction — Spicetify extension for chord analysis + per-chord lyrics
// Version: 6.5.0 - Smart autoscroll centering, track-change detection fix, chord levels fix, lyric dedup in instrumentals, UI overhaul

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
  // Styles
  // =============================
  function ensureStyles() {
      if (document.getElementById('chorduction-style')) return;
      const style = document.createElement('style');
      style.id = 'chorduction-style';
      style.textContent = `
          /* =========================================================
             CHORDUCTION — UI Design System v6.5.0
             Palette: #0a0a0a bg · #1db954 green · #4a9eff blue
                      #ff8c1a amber · #c084fc purple · #ff5b5b red
             Typography: system-ui body · ui-monospace chords
          ========================================================= */

          /* === Panel Shell === */
          .chorduction-panel {
              overflow-y: auto; overflow-x: hidden;
              padding: 0; box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif;
              scrollbar-width: thin;
              scrollbar-color: #2a2a2a transparent;
          }
          .chorduction-panel::-webkit-scrollbar { width: 4px; }
          .chorduction-panel::-webkit-scrollbar-track { background: transparent; }
          .chorduction-panel::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }

          /* === Header === */
          .chorduction-hdr {
              padding: 16px 16px 12px;
              background: linear-gradient(180deg, #0d0d0d 0%, #080808 100%);
              border-bottom: 1px solid #1a1a1a;
              position: relative;
          }
          .chorduction-hdr::after {
              content: ''; position: absolute; bottom: 0; left: 16px; right: 16px;
              height: 1px; background: linear-gradient(90deg, transparent, #1db95428 30%, #1db95428 70%, transparent);
          }
          .chorduction-hdr-title {
              font-size: 15px; font-weight: 700; color: #f0f0f0;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
              letter-spacing: -0.01em;
          }
          .chorduction-hdr-artist {
              font-size: 12px; color: #666; margin-top: 2px;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .chorduction-hdr-pills {
              display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; align-items: center;
          }
          .chorduction-pill {
              display: inline-flex; align-items: center; gap: 4px;
              padding: 3px 9px; border-radius: 99px;
              font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
              border: 1px solid; text-transform: uppercase;
              font-family: ui-monospace, monospace;
          }
          .chorduction-pill-key   { color: #1db954; border-color: #1db95450; background: #1db95410; }
          .chorduction-pill-bpm   { color: #999; border-color: #2a2a2a; background: #111; }
          .chorduction-pill-mode  { color: #4a9eff; border-color: #4a9eff40; background: #4a9eff0e; }

          /* === Controls Bar — two groups === */
          .chorduction-ctrl-bar {
              display: flex; align-items: center; padding: 6px 12px; gap: 0;
              background: #090909; border-bottom: 1px solid #181818;
              flex-wrap: wrap; row-gap: 4px;
          }
          /* Transport group: ⏮ ▶ ⏭ 🔄 */
          .chorduction-ctrl-transport {
              display: flex; align-items: center; gap: 2px;
              padding-right: 10px; margin-right: 10px;
              border-right: 1px solid #222;
          }
          /* Settings group: autoscroll · transpose · notation · level */
          .chorduction-ctrl-settings {
              display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          }
          .chorduction-ctrl-btn {
              background: transparent; border: none; color: #666; cursor: pointer;
              padding: 5px 7px; border-radius: 6px; font-size: 14px;
              transition: color 0.12s, background 0.12s;
              line-height: 1;
          }
          .chorduction-ctrl-btn:hover { color: #e0e0e0; background: #1e1e1e; }
          .chorduction-ctrl-btn.active-play { color: #1db954; }
          .chorduction-ctrl-btn[title*="Re-analyze"]:hover { color: #4a9eff; }

          /* Autoscroll toggle */
          .chorduction-autoscroll-badge {
              font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
              color: #555; padding: 3px 9px; border: 1px solid #222; border-radius: 99px;
              cursor: pointer; white-space: nowrap; transition: all 0.15s;
              font-family: ui-monospace, monospace;
          }
          .chorduction-autoscroll-badge:hover { border-color: #444; color: #aaa; }
          .chorduction-autoscroll-badge.on { color: #1db954; border-color: #1db95448; background: #1db9540a; }

          /* Transpose */
          .chorduction-transpose-group {
              display: flex; align-items: center;
              border: 1px solid #222; border-radius: 6px; overflow: hidden;
              background: #0e0e0e;
          }
          .chorduction-transpose-group button {
              background: transparent; border: none; color: #888;
              cursor: pointer; padding: 4px 9px; font-size: 14px; font-weight: 700;
              transition: color 0.1s, background 0.1s; line-height: 1;
          }
          .chorduction-transpose-group button:hover { background: #1a1a1a; color: #fff; }
          .chorduction-transpose-group span {
              min-width: 30px; text-align: center; font-size: 11px;
              font-family: ui-monospace, monospace; color: #ccc;
              border-left: 1px solid #1e1e1e; border-right: 1px solid #1e1e1e;
              padding: 4px 4px;
          }

          /* Selects */
          .chorduction-notation-select, .chorduction-level-select {
              background: #0e0e0e; border: 1px solid #222; border-radius: 6px;
              color: #888; font-size: 10px; font-weight: 600; letter-spacing: 0.03em;
              padding: 4px 7px; cursor: pointer; text-transform: uppercase;
              font-family: ui-monospace, monospace; appearance: none;
              -webkit-appearance: none;
          }
          .chorduction-notation-select:hover, .chorduction-level-select:hover { border-color: #333; color: #ccc; }

          /* === Autoscroll Paused Banner === */
          .chorduction-paused-banner {
              display: none; text-align: center; padding: 5px 16px;
              font-size: 11px; color: #666; background: #060606;
              border-bottom: 1px solid #181818; gap: 10px;
          }
          .chorduction-paused-banner.active { display: flex; align-items: center; justify-content: center; }
          .chorduction-resume-btn {
              background: transparent; border: 1px solid #333; border-radius: 99px;
              color: #888; font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
              padding: 2px 12px; cursor: pointer; text-transform: uppercase;
              transition: all 0.15s;
          }
          .chorduction-resume-btn:hover { border-color: #1db954; color: #1db954; background: #1db9540a; }

          /* === Timeline === */
          .chorduction-timeline { padding: 4px 14px 32px; }

          /* === Section Headers === */
          .chorduction-section { margin-top: 6px; }
          .chorduction-sec-hdr {
              display: flex; align-items: center; gap: 10px;
              padding: 18px 0 8px; position: relative;
          }
          .chorduction-sec-hdr-line { flex: 1; height: 1px; }
          .chorduction-sec-hdr-label {
              font-size: 9px; font-weight: 800; text-transform: uppercase;
              letter-spacing: 0.18em; white-space: nowrap;
              font-family: ui-monospace, monospace;
              padding: 3px 10px; border-radius: 99px; border: 1px solid;
          }
          /* Section color tokens */
          .chorduction-sec-hdr[data-type="chorus"] .chorduction-sec-hdr-label  { color: #1db954; border-color: #1db95448; background: #1db9540d; }
          .chorduction-sec-hdr[data-type="chorus"] .chorduction-sec-hdr-line   { background: linear-gradient(90deg, transparent, #1db95430, transparent); }
          .chorduction-sec-hdr[data-type="verse"] .chorduction-sec-hdr-label   { color: #4a9eff; border-color: #4a9eff44; background: #4a9eff0d; }
          .chorduction-sec-hdr[data-type="verse"] .chorduction-sec-hdr-line    { background: linear-gradient(90deg, transparent, #4a9eff28, transparent); }
          .chorduction-sec-hdr[data-type="bridge"] .chorduction-sec-hdr-label  { color: #ff8c1a; border-color: #ff8c1a44; background: #ff8c1a0d; }
          .chorduction-sec-hdr[data-type="bridge"] .chorduction-sec-hdr-line   { background: linear-gradient(90deg, transparent, #ff8c1a28, transparent); }
          .chorduction-sec-hdr[data-type="solo"] .chorduction-sec-hdr-label    { color: #c084fc; border-color: #c084fc44; background: #c084fc0d; }
          .chorduction-sec-hdr[data-type="solo"] .chorduction-sec-hdr-line     { background: linear-gradient(90deg, transparent, #c084fc28, transparent); }
          .chorduction-sec-hdr[data-type="intro"] .chorduction-sec-hdr-label,
          .chorduction-sec-hdr[data-type="outro"] .chorduction-sec-hdr-label   { color: #555; border-color: #2a2a2a; background: #111; }
          .chorduction-sec-hdr[data-type="intro"] .chorduction-sec-hdr-line,
          .chorduction-sec-hdr[data-type="outro"] .chorduction-sec-hdr-line    { background: #1e1e1e; }

          /* === Lyric Lines === */
          .chorduction-line {
              margin: 6px 0; padding: 6px 8px 5px;
              border-radius: 6px; border-left: 2px solid transparent;
              transition: background 0.2s, border-color 0.2s;
          }
          .chorduction-line.now-line {
              background: rgba(29,185,84,0.055);
              border-left-color: #1db95455;
          }
          .chorduction-line-chips {
              position: relative; height: 30px; margin-bottom: 6px;
          }
          .chorduction-line-lyric {
              font-size: 13px; line-height: 1.5; color: #505050;
              transition: color 0.2s; padding-left: 1px;
              letter-spacing: 0.01em;
          }
          .chorduction-line.now-line .chorduction-line-lyric {
              color: #c8c8c8; font-weight: 500;
          }

          /* === Chord Chips === */
          .chorduction-chip {
              display: inline-flex; align-items: center; justify-content: center;
              padding: 3px 9px; border-radius: 5px;
              border: 1px solid #222; background: #0e0e0e;
              color: #999; cursor: pointer; font-size: 12px; font-weight: 700;
              position: absolute; top: 0; white-space: nowrap;
              transition: background 0.12s, border-color 0.12s, transform 0.12s,
                          box-shadow 0.15s, color 0.12s, opacity 0.12s;
              user-select: none;
              font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
              letter-spacing: 0.02em;
          }
          .chorduction-chip:hover {
              background: #1a1a1a; transform: translateY(-2px);
              z-index: 2; border-color: #383838; color: #ddd;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }

          /* Chord function tints — resting state */
          .chorduction-chip[data-fn="tonic"]       { border-color: #1db95432; color: #7bc89a; background: #0a1a10; }
          .chorduction-chip[data-fn="subdominant"] { border-color: #4a9eff2e; color: #7aaedf; background: #080f1e; }
          .chorduction-chip[data-fn="dominant"]    { border-color: #ff8c1a2e; color: #d89460; background: #150a00; }
          .chorduction-chip[data-fn="secondary"]   { border-color: #9b59b628; color: #b08ad0; background: #100818; }
          .chorduction-chip[data-fn="neutral"]     { border-color: #282828; color: #888; }

          /* Active chip — currently playing */
          .chorduction-chip.now {
              border-width: 1.5px !important;
              transform: translateY(-3px) scale(1.10) !important;
              z-index: 4; font-size: 13px; font-weight: 800;
              letter-spacing: 0.03em;
          }
          .chorduction-chip[data-fn="tonic"].now {
              border-color: #1db954; color: #23e868; background: #071a0d;
              box-shadow: 0 0 0 2px #1db95420, 0 6px 18px #1db95430;
          }
          .chorduction-chip[data-fn="subdominant"].now {
              border-color: #4a9eff; color: #5cb0ff; background: #050e1c;
              box-shadow: 0 0 0 2px #4a9eff20, 0 6px 18px #4a9eff30;
          }
          .chorduction-chip[data-fn="dominant"].now {
              border-color: #ff8c1a; color: #ffaa50; background: #120800;
              box-shadow: 0 0 0 2px #ff8c1a20, 0 6px 18px #ff8c1a30;
          }
          .chorduction-chip[data-fn="secondary"].now {
              border-color: #a855f7; color: #c084fc; background: #0d0618;
              box-shadow: 0 0 0 2px #a855f720, 0 6px 18px #a855f730;
          }
          .chorduction-chip[data-fn="neutral"].now,
          .chorduction-chip:not([data-fn]).now {
              border-color: #ccc; color: #fff; background: #141414;
              box-shadow: 0 0 0 2px #ffffff18, 0 6px 16px rgba(255,255,255,0.12);
          }

          /* === Settings & Export collapsible === */
          .chorduction-settings-section {
              border-top: 1px solid #141414;
          }
          .chorduction-settings-section summary {
              cursor: pointer; padding: 8px 16px; font-size: 10px;
              color: #444; list-style: none; display: flex; align-items: center; gap: 6px;
              text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
              transition: color 0.15s; user-select: none;
              font-family: ui-monospace, monospace;
          }
          .chorduction-settings-section summary:hover { color: #666; }
          .chorduction-settings-section summary::before { content: '⚙'; font-size: 11px; }

          /* === Spinner === */
          @keyframes chorduction-spin { to { transform: rotate(360deg); } }
          .chorduction-spinner {
              width: 14px; height: 14px;
              border: 1.5px solid #1e1e1e; border-top-color: #1db954;
              border-radius: 50%; animation: chorduction-spin 0.75s linear infinite;
              display: inline-block; vertical-align: middle; margin-right: 8px;
          }

          /* === Waveform-style progress indicator on now-line === */
          @keyframes chorduction-pulse {
              0%, 100% { opacity: 0.5; }
              50%       { opacity: 1; }
          }
          .chorduction-line.now-line::before {
              content: ''; display: inline-block;
              width: 3px; height: 3px; border-radius: 50%;
              background: #1db954; margin-right: 4px;
              animation: chorduction-pulse 1.2s ease-in-out infinite;
              vertical-align: middle; position: absolute; left: 2px; top: 50%;
              margin-top: -1.5px;
          }
      `;
      document.head.appendChild(style);
      extensionCleanup.addElement(style);
  }
  
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

      delete(key) {
          this.cache.delete(key);
          this.accessCount.delete(key);
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

      // 1. Spicetify.getAudioData — built-in, uses internal Spicetify transport
      if (typeof Spicetify.getAudioData === 'function') {
          try {
              log.info('Fetching audio analysis via Spicetify.getAudioData...');
              const data = await Spicetify.getAudioData(`spotify:track:${trackId}`);
              if (data?.segments?.length && (data.beats?.length || data.tatums?.length)) {
                  analysisCache.set(trackId, data);
                  log.info('Analysis fetched via getAudioData');
                  return data;
              }
              log.warn('getAudioData returned no segments');
          } catch (e) {
              log.warn(`getAudioData failed: ${e?.message || e}`);
          }
      }

      // 2. spclient endpoint — confirmed working via diagnostic
      try {
          log.info('Fetching audio analysis via spclient...');
          const data = await Spicetify.CosmosAsync.get(
              `https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${trackId}`
          );
          const httpStatus = data?.code || data?.status || data?.error?.status;
          if (!httpStatus || httpStatus < 400) {
              if (data?.segments?.length && (data.beats?.length || data.tatums?.length)) {
                  analysisCache.set(trackId, data);
                  log.info('Analysis fetched via spclient');
                  return data;
              }
          }
          log.warn(`spclient response: status=${httpStatus} preview=${JSON.stringify(data)?.slice(0, 100)}`);
      } catch (e) {
          log.warn(`spclient failed: ${e?.message || e?.code || e}`);
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
      processAnalysis(analysis) {
          if (!analysis?.segments?.length) {
              return { rawChords: [], key: 'C', confidence: 0, tempo: 0 };
          }

          const beats = analysis.beats || analysis.tatums || [];
          const avgChroma = new Array(12).fill(0);
          const keySegments = analysis.segments.slice(0, 50).filter(s => s.pitches?.length === 12);
          for (const seg of keySegments) {
              for (let i = 0; i < 12; i++) avgChroma[i] += seg.pitches[i] || 0;
          }
          if (keySegments.length > 0) {
              for (let i = 0; i < 12; i++) avgChroma[i] /= keySegments.length;
          }

          const detectedKey = this.estimateKey(avgChroma);
          log.info(`Detected key: ${detectedKey}`);

          const rawChords = [];
          const bars = analysis.bars || [];

          if (bars.length >= 4) {
              // Bar-level detection: average all segment pitches within each bar.
              // Averaging over a full bar (4 beats) lets vocal melody notes cancel out while
              // the sustained harmonic structure (the chord) accumulates — better quality for
              // sung sections AND solos where beat-level chroma is dominated by the melody.
              for (const bar of bars) {
                  const barSegments = analysis.segments.filter(
                      s => s.start >= bar.start && s.start < bar.start + bar.duration && s.pitches?.length === 12
                  );
                  if (!barSegments.length) continue;
                  const avgPitches = new Array(12).fill(0);
                  for (const seg of barSegments) {
                      for (let i = 0; i < 12; i++) avgPitches[i] += seg.pitches[i];
                  }
                  for (let i = 0; i < 12; i++) avgPitches[i] /= barSegments.length;
                  const result = this.detectChord(avgPitches);
                  rawChords.push({
                      chord: result.chord,
                      startMs: Math.round(bar.start * 1000),
                      endMs: Math.round((bar.start + bar.duration) * 1000),
                      confidence: result.confidence
                  });
              }
          } else {
              // Fallback: beat-level with smoothing (for tracks without usable bar data)
              let currentChord = null, chordStart = 0, beatCount = 0;
              const smoothingBeats = CONFIG.SMOOTHING_BEATS;
              for (const beat of beats) {
                  const segment = this.findSegmentForTime(beat.start, analysis.segments);
                  if (!segment?.pitches?.length) continue;
                  const result = this.detectChord(segment.pitches);
                  if (result.chord === currentChord || beatCount < smoothingBeats) {
                      if (beatCount >= smoothingBeats && result.confidence > 0.3) currentChord = result.chord;
                  } else {
                      if (currentChord) rawChords.push({ chord: currentChord, startMs: chordStart * 1000, endMs: beat.start * 1000, confidence: result.confidence });
                      currentChord = result.chord;
                      chordStart = beat.start;
                  }
                  beatCount++;
              }
              if (currentChord) {
                  const lastBeat = beats[beats.length - 1];
                  rawChords.push({ chord: currentChord, startMs: chordStart * 1000, endMs: lastBeat ? (lastBeat.start + lastBeat.duration) * 1000 : 0, confidence: CONFIG.MIN_CONFIDENCE });
              }
          }

          return {
              rawChords,
              bars,
              key: detectedKey,
              confidence: rawChords.reduce((s, c) => s + (c.confidence || 0), 0) / Math.max(rawChords.length, 1),
              tempo: analysis.track?.tempo || 0
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
          // Find the lyric line active at chord.startMs:
          // last line whose startMs is <= chord.startMs (the line currently being sung)
          let activeLyric = null;
          for (let i = lyrics.length - 1; i >= 0; i--) {
              if (lyrics[i].startMs <= chord.startMs) { activeLyric = lyrics[i]; break; }
          }
          if (!activeLyric) activeLyric = lyrics[0];
          return { ...chord, lyric: activeLyric?.text || null };
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
          display: flex; gap: 6px; padding: 6px 12px;
          background: #1a1a1a; border-radius: 20px;
          margin-bottom: 10px; align-items: center; justify-content: center;
      `;

      const mkBtn = (html, title, action) => {
          const btn = document.createElement("button");
          btn.innerHTML = html;
          btn.title = title;
          btn.dataset.action = action;
          btn.style.cssText = "background:transparent; border:none; color:#b3b3b3; font-size:15px; cursor:pointer; padding:5px 9px; border-radius:50%; transition:all 0.15s;";
          btn.onmouseover = () => { btn.style.color = "#fff"; btn.style.background = "#333"; };
          btn.onmouseout = () => { btn.style.color = "#b3b3b3"; btn.style.background = "transparent"; };
          return btn;
      };

      const prevBtn = mkBtn("⏮", "Previous Chord", "prev-chord");
      const playPauseBtn = mkBtn("▶", "Play/Pause", "playpause");
      const nextBtn = mkBtn("⏭", "Next Chord", "next-chord");

      const autoscrollBadge = document.createElement("span");
      autoscrollBadge.setAttribute("data-role", "autoscroll-status");
      autoscrollBadge.style.cssText = "font-size:11px; color:#888; padding:2px 6px; border:1px solid #333; border-radius:999px; cursor:pointer; white-space:nowrap;";
      autoscrollBadge.title = "Click to toggle autoscroll";
      autoscrollBadge.textContent = "Autoscroll: On";
      autoscrollBadge.onclick = () => setAutoscroll(!chordPlayState.enabled);

      const trackInfo = document.createElement("div");
      trackInfo.id = "chorduction-track-info";
      trackInfo.style.cssText = "flex:1; text-align:center; font-size:11px; color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 6px; min-width:0;";
      const meta = getCurrentTrackMeta();
      trackInfo.textContent = meta.title ? `${meta.title} — ${meta.artist}` : "No track playing";

      const updatePlayPauseIcon = () => {
          const playing = Spicetify?.Player?.isPlaying?.() ?? false;
          playPauseBtn.innerHTML = playing ? "⏸" : "▶";
      };
      if (Spicetify?.Player) {
          Spicetify.Player.addEventListener("onplaypause", updatePlayPauseIcon);
          updatePlayPauseIcon();
      }

      // Chord navigation — prev/next seek within current track
      prevBtn.onclick = () => {
          const ms = Spicetify.Player.getProgress?.() ?? 0;
          if (ms > 3000) {
              Spicetify.Player.seek(0);
          } else {
              Spicetify.Player.back?.();
          }
      };
      nextBtn.onclick = () => {
          const ms = Spicetify.Player.getProgress?.() ?? 0;
          const idx = binarySearchChords(ms);
          seekToChord(idx + 1);
      };
      playPauseBtn.onclick = () => Spicetify.Player?.togglePlay?.();

      container.appendChild(prevBtn);
      container.appendChild(playPauseBtn);
      container.appendChild(nextBtn);
      container.appendChild(autoscrollBadge);
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
      // Clean up previous panel listeners and playhead tracking
      panelCleanup.cleanup();
      if (panelProgressHandler) {
          try { Spicetify.Player.removeEventListener('onprogress', panelProgressHandler); } catch {}
          panelProgressHandler = null;
      }
      chordPlayState.chords = [];
      chordPlayState.chips = null;
      chordPlayState.activeIdx = -1;

      ensureStyles();

      const openedTrackUri = getCurrentTrackMeta()?.uri;

      if (Spicetify.PopupModal?.display) {
          Spicetify.PopupModal.display({
              title: "🎸 Chorduction",
              content: getMainPanelContent(),
              isLarge: true
          });
      } else {
          // Fallback custom modal
          if (document.getElementById("chorduction-modal")) {
              document.getElementById("chorduction-modal").remove();
          }
          const modal = document.createElement("div");
          modal.id = "chorduction-modal";
          Object.assign(modal.style, {
              position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
              background: "rgba(0,0,0,0.8)", zIndex: "99999",
              display: "flex", alignItems: "center", justifyContent: "center",
          });
          const content = getMainPanelContent();
          Object.assign(content.style, {
              background: "#282828", borderRadius: "8px",
              maxWidth: "800px", maxHeight: "80vh",
              overflow: "auto", padding: "20px", color: "#fff",
          });
          modal.appendChild(content);
          document.body.appendChild(modal);
          panelCleanup.addElement(modal);
          modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
      }

      // When song changes while panel is open — re-render the panel for the new track
      panelCleanup.addListener(Spicetify.Player, "ontrackchange", () => {
          const isOpen = document.querySelector(".main-popupModal-container, #chorduction-modal");
          if (!isOpen) return;
          const newUri = getCurrentTrackMeta()?.uri;
          if (newUri === openedTrackUri) return;
          log.info("Song changed while panel open — refreshing panel");
          currentAnalysis = null;
          lastAttemptedTrackId = null;
          lastAnalysisStartMs = 0;
          showMainPanel();
      });
  }

  function getMainPanelContent() {
      const panel = document.createElement('div');
      panel.className = 'chorduction-panel';
      panel.id = 'chorduction-panel';

      ensureStyles();

      // === Header: track info + musical context ===
      const hdr = document.createElement('div');
      hdr.className = 'chorduction-hdr';
      const meta = getCurrentTrackMeta();
      const key = currentAnalysis?.key || '—';
      const tempo = currentAnalysis?.tempo ? Math.round(currentAnalysis.tempo) : null;
      const isMinor = key.endsWith('m');
      hdr.innerHTML = `
          <div class="chorduction-hdr-title">${escapeHtml(meta.title || 'No track playing')}</div>
          <div class="chorduction-hdr-artist">${escapeHtml(meta.artist || '')}</div>
          <div class="chorduction-hdr-pills">
              <span class="chorduction-pill chorduction-pill-key">Key: ${escapeHtml(key)}</span>
              ${tempo ? `<span class="chorduction-pill chorduction-pill-bpm">${tempo} BPM</span>` : ''}
              <span class="chorduction-pill chorduction-pill-mode">${isMinor ? 'Minor' : 'Major'}</span>
          </div>
      `;
      panel.appendChild(hdr);

      // === Controls Bar ===
      const ctrlBar = document.createElement('div');
      ctrlBar.className = 'chorduction-ctrl-bar';

      // Prev/Play-Pause/Next chord
      const prevBtn = document.createElement('button');
      prevBtn.className = 'chorduction-ctrl-btn';
      prevBtn.innerHTML = '⏮'; prevBtn.title = 'Restart song (prev song if at start)';
      prevBtn.onclick = () => {
          const ms = Spicetify.Player.getProgress?.() ?? 0;
          if (ms > 3000) {
              Spicetify.Player.seek(0);
          } else {
              Spicetify.Player.back?.();
          }
      };

      const playBtn = document.createElement('button');
      playBtn.className = 'chorduction-ctrl-btn';
      playBtn.id = 'chorduction-pp-btn';
      const updatePP = () => {
          const playing = Spicetify?.Player?.isPlaying?.() ?? false;
          playBtn.innerHTML = playing ? '⏸' : '▶';
          playBtn.classList.toggle('active-play', playing);
      };
      playBtn.onclick = () => Spicetify.Player?.togglePlay?.();
      Spicetify.Player?.addEventListener?.('onplaypause', updatePP);
      updatePP();

      const nextBtn = document.createElement('button');
      nextBtn.className = 'chorduction-ctrl-btn';
      nextBtn.innerHTML = '⏭'; nextBtn.title = 'Next song';
      nextBtn.onclick = () => Spicetify.Player.next?.();

      // Re-analyze button
      const reanalyzeBtn = document.createElement('button');
      reanalyzeBtn.className = 'chorduction-ctrl-btn';
      reanalyzeBtn.innerHTML = '🔄'; reanalyzeBtn.title = 'Re-analyze current song';
      reanalyzeBtn.onclick = () => {
          const trackId = spotifyIdFromUri(getCurrentTrackMeta()?.uri);
          if (trackId) analysisCache.delete(trackId);
          lastAttemptedTrackId = null;
          lastAnalysisStartMs = 0;
          analyzeCurrentTrack();
      };

      // Autoscroll badge
      const asBadge = document.createElement('span');
      asBadge.className = 'chorduction-autoscroll-badge on';
      asBadge.setAttribute('data-role', 'autoscroll-status');
      asBadge.title = 'Click to toggle autoscroll';
      asBadge.textContent = 'Autoscroll: On';
      asBadge.onclick = () => setAutoscroll(!chordPlayState.enabled);

      // Transpose controls
      const transposeGrp = document.createElement('div');
      transposeGrp.className = 'chorduction-transpose-group';
      const tdBtn = document.createElement('button'); tdBtn.textContent = '−'; tdBtn.title = 'Transpose down';
      const tuBtn = document.createElement('button'); tuBtn.textContent = '+'; tuBtn.title = 'Transpose up';
      const tvSpan = document.createElement('span');
      tvSpan.id = 'transpose-value';
      tvSpan.textContent = Transposer.getDisplay(CONFIG.TRANSPOSE_SEMITONES) || '0';
      transposeGrp.appendChild(tdBtn);
      transposeGrp.appendChild(tvSpan);
      transposeGrp.appendChild(tuBtn);
      tdBtn.onclick = () => { Transposer.setTranspose(CONFIG.TRANSPOSE_SEMITONES - 1); reRenderChords(); };
      tuBtn.onclick = () => { Transposer.setTranspose(CONFIG.TRANSPOSE_SEMITONES + 1); reRenderChords(); };

      // Notation selector
      const notationSel = document.createElement('select');
      notationSel.className = 'chorduction-notation-select';
      notationSel.title = 'Chord notation';
      ChordNotation.getAvailable().forEach(n => {
          const opt = document.createElement('option');
          opt.value = n; opt.textContent = ChordNotation.getDisplayName(n);
          opt.selected = CONFIG.CHORD_NOTATION === n;
          notationSel.appendChild(opt);
      });
      notationSel.onchange = (e) => { ChordNotation.setNotation(e.target.value); reRenderChords(); };

      // Chord level selector
      const levelSel = document.createElement('select');
      levelSel.className = 'chorduction-level-select';
      levelSel.title = 'Chord complexity';
      [['1', getT('basicsOnly')], ['2', getT('intermediate')], ['3', getT('advanced')]].forEach(([v, t]) => {
          const opt = document.createElement('option');
          opt.value = v; opt.textContent = t; opt.selected = CONFIG.CHORD_SIMPLIFICATION === parseInt(v);
          levelSel.appendChild(opt);
      });
      levelSel.onchange = (e) => { CONFIG.CHORD_SIMPLIFICATION = parseInt(e.target.value); Settings.save(CONFIG); reRenderChords(); };

      // Group: transport (⏮ ▶ ⏭ 🔄)
      const transportGrp = document.createElement('div');
      transportGrp.className = 'chorduction-ctrl-transport';
      [prevBtn, playBtn, nextBtn, reanalyzeBtn].forEach(el => transportGrp.appendChild(el));

      // Group: settings (autoscroll · transpose · notation · level)
      const settingsGrp = document.createElement('div');
      settingsGrp.className = 'chorduction-ctrl-settings';
      [asBadge, transposeGrp, notationSel, levelSel].forEach(el => settingsGrp.appendChild(el));

      ctrlBar.appendChild(transportGrp);
      ctrlBar.appendChild(settingsGrp);
      panel.appendChild(ctrlBar);

      // === Autoscroll paused banner ===
      const pausedBanner = document.createElement('div');
      pausedBanner.className = 'chorduction-paused-banner';
      pausedBanner.setAttribute('data-role', 'autoscroll-banner');
      pausedBanner.innerHTML = '<span>Autoscroll paused</span>';
      const resumeBtn = document.createElement('button');
      resumeBtn.className = 'chorduction-resume-btn';
      resumeBtn.textContent = 'Resume';
      resumeBtn.onclick = () => setAutoscroll(true);
      pausedBanner.appendChild(resumeBtn);
      panel.appendChild(pausedBanner);

      // === Chord display area ===
      const chordDisplay = document.createElement('div');
      chordDisplay.id = 'chord-display';
      chordDisplay.style.cssText = 'min-height: 150px;';

      if (currentAnalysis?.chords?.length) {
          setTimeout(() => updateChordDisplay(currentAnalysis.chords, currentAnalysis.lyrics, currentAnalysis.key), 0);
      } else {
          chordDisplay.innerHTML = `<div style="color:#888;padding:20px 16px;display:flex;align-items:center;"><span class="chorduction-spinner"></span>${getT('analyzing')}</div>`;
          lastAnalysisStartMs = 0;
          setTimeout(analyzeCurrentTrack, 100);
      }
      panel.appendChild(chordDisplay);

      // === Settings (collapsed) + Export ===
      const settingsDetails = document.createElement('details');
      settingsDetails.className = 'chorduction-settings-section';
      settingsDetails.innerHTML = `
          <summary>Settings &amp; Export</summary>
          <div style="padding:10px 16px 14px;display:flex;flex-direction:column;gap:10px;">
              <label style="font-size:11px;color:#666;display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="chrd-show-lyrics" ${CONFIG.SHOW_LYRICS ? 'checked' : ''}> Show lyrics
              </label>
              <label style="font-size:11px;color:#666;display:flex;align-items:center;gap:8px;cursor:pointer;">
                  <input type="checkbox" id="chrd-show-fretboard" ${CONFIG.SHOW_FRETBOARD_DIAGRAMS ? 'checked' : ''}> Fretboard on hover
              </label>
              <div style="display:flex;gap:5px;align-items:center;margin-top:2px;">
                  <span style="font-size:10px;color:#444;text-transform:uppercase;letter-spacing:0.06em;font-family:ui-monospace,monospace;margin-right:2px;">Export</span>
                  <button id="export-txt" style="padding:3px 11px;border-radius:99px;border:1px solid #222;background:transparent;color:#666;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-family:ui-monospace,monospace;transition:all 0.12s;">TXT</button>
                  <button id="export-json" style="padding:3px 11px;border-radius:99px;border:1px solid #222;background:transparent;color:#666;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-family:ui-monospace,monospace;transition:all 0.12s;">JSON</button>
                  <button id="export-chordpro" style="padding:3px 11px;border-radius:99px;border:1px solid #222;background:transparent;color:#666;cursor:pointer;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-family:ui-monospace,monospace;transition:all 0.12s;">ChordPro</button>
              </div>
          </div>
      `;
      panel.appendChild(settingsDetails);

      settingsDetails.querySelector('#chrd-show-lyrics')?.addEventListener('change', e => { CONFIG.SHOW_LYRICS = e.target.checked; Settings.save(CONFIG); reRenderChords(); });
      settingsDetails.querySelector('#chrd-show-fretboard')?.addEventListener('change', e => { CONFIG.SHOW_FRETBOARD_DIAGRAMS = e.target.checked; Settings.save(CONFIG); });
      settingsDetails.querySelector('#export-txt')?.addEventListener('click', () => { if (currentAnalysis) FileExporter.export({...currentAnalysis, meta: getCurrentTrackMeta()}, 'txt'); });
      settingsDetails.querySelector('#export-json')?.addEventListener('click', () => { if (currentAnalysis) FileExporter.export({...currentAnalysis, meta: getCurrentTrackMeta()}, 'json'); });
      settingsDetails.querySelector('#export-chordpro')?.addEventListener('click', () => { if (currentAnalysis) FileExporter.export({...currentAnalysis, meta: getCurrentTrackMeta()}, 'chordpro'); });

      window._chorductionChordDisplay = chordDisplay;
      window._chorductionContainer = panel;
      return panel;
  }
  function updateChordDisplay(chords, lyrics, key) {
      const display = document.getElementById('chord-display') || window._chorductionChordDisplay;
      if (!display?.isConnected && !display?.parentNode) return;
      if (!chords?.length) {
          if (display) display.innerHTML = `<div style="color:#888;padding:20px;text-align:center;">${getT('noData')}</div>`;
          return;
      }

      ensureStyles();
      const timeline = document.createElement('div');
      timeline.className = 'chorduction-timeline';

      // Build structured sections (uses audio analysis sections if available)
      const audioSections = currentAnalysis?.sections || [];
      const sections = buildStructuredSections(audioSections, chords, lyrics);

      for (const sec of sections) {
          const secEl = document.createElement('div');
          secEl.className = 'chorduction-section';

          // Section header (only if label is non-empty)
          if (sec.label) {
              const hdr = document.createElement('div');
              hdr.className = 'chorduction-sec-hdr';
              hdr.dataset.type = sec.type || 'song';
              hdr.innerHTML = `
                  <div class="chorduction-sec-hdr-line"></div>
                  <span class="chorduction-sec-hdr-label">${escapeHtml(sec.label)}</span>
                  <div class="chorduction-sec-hdr-line"></div>
              `;
              secEl.appendChild(hdr);
          }

          // Lines within section
          for (const line of sec.lines) {
              const lineEl = document.createElement('div');
              lineEl.className = 'chorduction-line';
              lineEl.dataset.startMs = line.startMs;
              lineEl.dataset.endMs = line.endMs;

              // Chip row
              const chipsRow = document.createElement('div');
              chipsRow.className = 'chorduction-line-chips';
              const lineDur = line.endMs - line.startMs;

              for (let ci = 0; ci < line.chords.length; ci++) {
                  const c = line.chords[ci];
                  const leftPct = lineDur > 0
                      ? Math.min(((c.startMs - line.startMs) / lineDur) * 100, 93)
                      : (ci / Math.max(line.chords.length, 1)) * 88;

                  const chip = document.createElement('div');
                  chip.className = 'chorduction-chip';
                  chip.dataset.start = c.startMs;
                  chip.dataset.end = c.endMs;
                  chip.style.left = leftPct.toFixed(1) + '%';

                  // Chord function — use raw chord name for accurate functional analysis
                  const rawChord = currentAnalysis?.rawChords?.find?.(r => r.startMs === c.startMs)?.chord || c.chord;
                  const fn = getChordFunction(rawChord, currentAnalysis?.key || key);
                  chip.dataset.fn = fn;

                  const label = document.createElement('span');
                  label.textContent = c.chord === 'N' ? '—' : c.chord;
                  chip.appendChild(label);

                  // JS-managed fretboard tooltip (bypass overflow clipping)
                  const rawName = c.chord === 'N' ? null : c.chord;
                  if (rawName) {
                      chip.addEventListener('mouseenter', () => showFretTooltip(chip, rawName));
                      chip.addEventListener('mouseleave', hideFretTooltip);
                  }

                  chipsRow.appendChild(chip);
              }
              lineEl.appendChild(chipsRow);

              // Lyric text
              if (CONFIG.SHOW_LYRICS && line.text) {
                  const lyricEl = document.createElement('div');
                  lyricEl.className = 'chorduction-line-lyric';
                  lyricEl.textContent = line.text;
                  lineEl.appendChild(lyricEl);
              }

              secEl.appendChild(lineEl);
          }
          timeline.appendChild(secEl);
      }

      if (display) {
          display.innerHTML = '';
          display.appendChild(timeline);
      }

      startPlayheadTracking(chords);
  }
  // =============================
  // Autoscroll & Playhead Tracking
  // =============================
  let chordPlayState = { chords: [], chips: null, activeIdx: -1, rafId: 0, enabled: true, programmatic: false };
  let panelProgressHandler = null;

  function binarySearchChords(ms) {
      const c = chordPlayState.chords;
      let lo = 0, hi = c.length - 1;
      while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (ms < c[mid].startMs) hi = mid - 1;
          else if (ms >= c[mid].endMs) lo = mid + 1;
          else return mid;
      }
      return -1;
  }

  function setAutoscroll(enabled) {
      chordPlayState.enabled = enabled;
      const badge = document.querySelector('[data-role="autoscroll-status"]');
      const banner = document.querySelector('[data-role="autoscroll-banner"]');
      if (badge) {
          badge.textContent = `Autoscroll: ${enabled ? 'On' : 'Paused'}`;
          badge.classList.toggle('on', enabled);
      }
      if (banner) banner.classList.toggle('active', !enabled);
  }

  function updatePlayhead(ms) {
      const state = chordPlayState;
      if (!state.chords.length) return;
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = requestAnimationFrame(() => {
          const idx = binarySearchChords(ms);
          if (idx === state.activeIdx) return;
          state.chips = state.chips || document.querySelectorAll('.chorduction-chip');

          // Remove old active chip
          if (state.activeIdx >= 0) state.chips[state.activeIdx]?.classList.remove('now');

          // Remove old active line
          document.querySelector('.chorduction-line.now-line')?.classList.remove('now-line');

          state.activeIdx = idx;
          if (idx >= 0) {
              const el = state.chips[idx];
              el?.classList.add('now');

              // Highlight the parent lyric line
              const lineEl = el?.closest('.chorduction-line');
              if (lineEl) lineEl.classList.add('now-line');

              if (state.enabled) {
                  state.programmatic = true;
                  // Scroll so the active line sits at ~35% from top of the panel,
                  // keeping ~65% of visible area for upcoming verses/chords.
                  const target = lineEl || el;
                  const panel = document.querySelector('.chorduction-panel');
                  if (panel && target) {
                      const panelRect = panel.getBoundingClientRect();
                      const targetRect = target.getBoundingClientRect();
                      const relativeTop = targetRect.top - panelRect.top;
                      const desiredOffset = panelRect.height * 0.30;
                      const scrollDelta = relativeTop - desiredOffset;
                      // Only scroll if delta is significant (> 1 line height) to avoid jitter
                      if (Math.abs(scrollDelta) > 32) {
                          panel.scrollTo({ top: panel.scrollTop + scrollDelta, behavior: 'smooth' });
                      }
                  }
                  setTimeout(() => { state.programmatic = false; }, 500);
              }
          }
      });
  }

  function seekToChord(idx) {
      const chords = chordPlayState.chords;
      if (idx < 0 || idx >= chords.length) return;
      Spicetify.Player.seek?.(chords[idx].startMs);
      setAutoscroll(true);
      updatePlayhead(chords[idx].startMs);
  }

  function attachChordInteractions() {
      const panel = document.querySelector('.chorduction-panel');
      if (!panel || panel.__chorductionBound) return;
      panel.__chorductionBound = true;
      const onScroll = () => { if (!chordPlayState.programmatic) setAutoscroll(false); };
      panel.addEventListener('wheel', onScroll, { passive: true });
      panel.addEventListener('scroll', onScroll, { passive: true });
      panel.addEventListener('click', e => {
          const chip = e.target.closest('.chorduction-chip');
          if (chip) {
              setAutoscroll(true);
              Spicetify.Player.seek?.(Number(chip.dataset.start));
          }
      });
  }

  function startPlayheadTracking(chords) {
      chordPlayState.chords = chords;
      chordPlayState.chips = null;
      chordPlayState.activeIdx = -1;
      setAutoscroll(true);
      if (panelProgressHandler) {
          try { Spicetify.Player.removeEventListener('onprogress', panelProgressHandler); } catch {}
          panelProgressHandler = null;
      }
      panelProgressHandler = (e) => {
          updatePlayhead(e?.data ?? Spicetify.Player.getProgress?.() ?? 0);
      };
      Spicetify.Player.addEventListener('onprogress', panelProgressHandler);
      updatePlayhead(Spicetify.Player.getProgress?.() ?? 0);
      attachChordInteractions();
  }

  function buildChordLines(chords, lyrics) {
      if (lyrics?.length) {
          // Group chords by active lyric line (each distinct lyric line = one visual row)
          const lines = [];
          let cur = null;
          for (const chord of chords) {
              if (!cur || chord.lyric !== cur.text) {
                  if (cur) { cur.endMs = chord.startMs; lines.push(cur); }
                  cur = { startMs: chord.startMs, endMs: 0, text: chord.lyric, chords: [] };
              }
              cur.chords.push(chord);
          }
          if (cur) {
              const last = chords[chords.length - 1];
              cur.endMs = last.endMs || (last.startMs + 4000);
              lines.push(cur);
          }
          return lines;
      }

      // No lyrics: group 2 bars per visual line for readable measure-aligned display
      const analysisBars = currentAnalysis?.bars;
      if (analysisBars?.length >= 4) {
          const lines = [];
          const BARS_PER_LINE = 2;
          for (let i = 0; i < analysisBars.length; i += BARS_PER_LINE) {
              const lineStartMs = Math.round(analysisBars[i].start * 1000);
              const lastBar = analysisBars[Math.min(i + BARS_PER_LINE - 1, analysisBars.length - 1)];
              const lineEndMs = Math.round((lastBar.start + lastBar.duration) * 1000);
              const lineChords = chords.filter(c => c.startMs >= lineStartMs && c.startMs < lineEndMs);
              if (lineChords.length) lines.push({ startMs: lineStartMs, endMs: lineEndMs, text: null, chords: lineChords });
          }
          if (lines.length) return lines;
      }

      // Final fallback: 4-second fixed windows
      const BAR_MS = 4000;
      const lines = [];
      let bar = null;
      for (const chord of chords) {
          const bi = Math.floor(chord.startMs / BAR_MS);
          if (!bar || bi !== bar.barIdx) {
              if (bar) lines.push(bar);
              bar = { barIdx: bi, startMs: bi * BAR_MS, endMs: (bi + 1) * BAR_MS, text: null, chords: [] };
          }
          bar.chords.push(chord);
      }
      if (bar) lines.push(bar);
      return lines;
  }

  // =============================
  // Chord Function + Section Helpers
  // =============================

  function getChordFunction(chordName, keyName) {
      if (!chordName || chordName === 'N' || chordName === '—') return 'neutral';
      const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const flatToSharp = {'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'};
      const keyRoot = ((keyName || 'C').replace(/m$/, '')).replace(/[♭b]/g, 'b').replace(/[♯#]/g, '#');
      const normalKeyRoot = flatToSharp[keyRoot] || keyRoot;
      const keyIdx = notes.indexOf(normalKeyRoot);
      if (keyIdx === -1) return 'neutral';
      const chordMatch = chordName.match(/^([A-G][#b♭♯]?)/);
      if (!chordMatch) return 'neutral';
      let cr = chordMatch[1].replace(/[♭]/g,'b').replace(/[♯]/g,'#');
      cr = flatToSharp[cr] || cr;
      const chordIdx = notes.indexOf(cr);
      if (chordIdx === -1) return 'neutral';
      const degree = (chordIdx - keyIdx + 12) % 12;
      if (degree === 0) return 'tonic';
      if (degree === 5) return 'subdominant';
      if (degree === 7) return 'dominant';
      if (degree === 2 || degree === 4 || degree === 9) return 'secondary';
      return 'neutral';
  }

  function labelSections(sections, lyrics) {
      if (!sections?.length) return [];
      const n = sections.length;
      const avgLoud = sections.reduce((s, x) => s + x.loudness, 0) / n;
      let verse = 0, chorus = 0, bridge = 0, solo = 0;
      return sections.map((sec, i) => {
          const startMs = Math.round(sec.start * 1000);
          const endMs = Math.round((sec.start + sec.duration) * 1000);
          const dur = sec.duration;
          // Intro/Outro by position + short duration
          if (i === 0 && dur < 25) return { startMs, endMs, label: 'Intro', type: 'intro' };
          if (i === n - 1 && dur < 25) return { startMs, endMs, label: 'Outro', type: 'outro' };
          // Instrumental / Solo: middle section with no associated lyrics
          // (lyrics are available = sung section; no lyrics = instrumental passage or solo)
          const hasLyrics = lyrics?.some(l => l.startMs >= startMs && l.startMs < endMs);
          if (!hasLyrics && lyrics?.length && dur > 5 && i > 0 && i < n - 1) {
              solo++;
              return { startMs, endMs, label: solo > 1 ? `Solo ${solo}` : 'Solo', type: 'solo' };
          }
          // Very short middle section = bridge/transition
          if (dur < 9 && i > 0 && i < n - 1) {
              bridge++;
              return { startMs, endMs, label: bridge > 1 ? `Bridge ${bridge}` : 'Bridge', type: 'bridge' };
          }
          // Louder than average = chorus
          if (sec.loudness > avgLoud + 1.5) {
              chorus++;
              return { startMs, endMs, label: chorus > 1 ? `Chorus ${chorus}` : 'Chorus', type: 'chorus' };
          }
          verse++;
          return { startMs, endMs, label: verse > 1 ? `Verse ${verse}` : 'Verse', type: 'verse' };
      });
  }

  function buildStructuredSections(audioSections, chords, lyrics) {
      const labeled = labelSections(audioSections, lyrics);
      if (!labeled.length) {
          return [{ label: '', type: 'song', startMs: 0, endMs: Infinity, lines: buildChordLines(chords, lyrics) }];
      }
      const result = [];
      for (const sec of labeled) {
          const secChords = chords.filter(c => c.startMs >= sec.startMs && c.startMs < sec.endMs);
          if (!secChords.length) continue;
          // Solo/instrumental sections have no sung content — pass empty lyrics so
          // no lyric text appears in these sections (prevents duplication of surrounding verses)
          const isInstrumental = sec.type === 'solo' || sec.type === 'instrumental' || sec.type === 'intro' || sec.type === 'outro';
          const secLyrics = isInstrumental ? [] : lyrics.filter(l => l.startMs >= sec.startMs && l.startMs < sec.endMs);
          result.push({ ...sec, lines: buildChordLines(secChords, secLyrics) });
      }
      // Catch any chords before the first labeled section (e.g. no intro detected)
      if (labeled.length && chords.length) {
          const firstSectionMs = labeled[0].startMs;
          const preChords = chords.filter(c => c.startMs < firstSectionMs);
          if (preChords.length) {
              const preLines = buildChordLines(preChords, lyrics.filter(l => l.startMs < firstSectionMs));
              result.unshift({ label: 'Intro', type: 'intro', startMs: 0, endMs: firstSectionMs, lines: preLines });
          }
      }
      return result.length ? result : [{ label: '', type: 'song', startMs: 0, endMs: Infinity, lines: buildChordLines(chords, lyrics) }];
  }

  // =============================
  // Fretboard Tooltip (JS-managed, fixed position)
  // =============================
  let _fretTooltipEl = null;

  function getFretTooltip() {
      if (!_fretTooltipEl) {
          _fretTooltipEl = document.createElement('div');
          _fretTooltipEl.id = 'chorduction-fret-tooltip';
          _fretTooltipEl.style.cssText = [
              'position:fixed', 'z-index:999999', 'display:none',
              'background:#181818', 'border:1px solid #444', 'border-radius:8px',
              'padding:8px', 'box-shadow:0 6px 20px rgba(0,0,0,0.85)',
              'pointer-events:none', 'text-align:center'
          ].join(';');
          document.body.appendChild(_fretTooltipEl);
      }
      return _fretTooltipEl;
  }

  function getChordNotes(chordName) {
      if (!chordName || chordName === 'N') return '';
      const roots = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const flat2sharp = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
      // Normalize root
      let root = chordName.match(/^[A-G][#b]?/)?.[0] || '';
      root = flat2sharp[root] || root;
      const rootIdx = roots.indexOf(root);
      if (rootIdx === -1) return '';
      const quality = chordName.slice(root.length === chordName.match(/^[A-G][#b]?/)?.[0].length ? root.length : 1);
      // Intervals by quality (semitones from root)
      let intervals = [0, 4, 7]; // major
      if (/^m(?!aj|7b5)/.test(quality)) intervals = [0, 3, 7];
      else if (/dim7/.test(quality)) intervals = [0, 3, 6, 9];
      else if (/dim/.test(quality)) intervals = [0, 3, 6];
      else if (/aug/.test(quality)) intervals = [0, 4, 8];
      else if (/maj7/.test(quality)) intervals = [0, 4, 7, 11];
      else if (/m7b5/.test(quality)) intervals = [0, 3, 6, 10];
      else if (/m7/.test(quality)) intervals = [0, 3, 7, 10];
      else if (/7/.test(quality)) intervals = [0, 4, 7, 10];
      else if (/sus4/.test(quality)) intervals = [0, 5, 7];
      else if (/sus2/.test(quality)) intervals = [0, 2, 7];
      const notes = intervals.map(i => roots[(rootIdx + i) % 12]);
      return notes.join(' · ');
  }

  function showFretTooltip(chipEl, chordName) {
      const tip = getFretTooltip();
      tip.innerHTML = '';
      // Chord name header
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:14px; font-weight:700; color:#1db954; margin-bottom:4px; font-family:ui-monospace,monospace;';
      lbl.textContent = chordName;
      tip.appendChild(lbl);
      // Notes line
      const notes = getChordNotes(chordName);
      if (notes) {
          const notesEl = document.createElement('div');
          notesEl.style.cssText = 'font-size:11px; color:#aaa; margin-bottom:6px; font-family:ui-monospace,monospace;';
          notesEl.textContent = notes;
          tip.appendChild(notesEl);
      }
      // Fretboard diagram (optional)
      if (CONFIG.SHOW_FRETBOARD_DIAGRAMS) {
          const diagram = generateFretboardDiagram(chordName);
          if (diagram) tip.appendChild(diagram);
      }
      tip.style.display = 'block';
      const r = chipEl.getBoundingClientRect();
      const tw = tip.offsetWidth || 140;
      let left = r.left + r.width / 2 - tw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
      tip.style.left = left + 'px';
      tip.style.top = (r.bottom + 6) + 'px';
  }

  function hideFretTooltip() {
      const tip = document.getElementById('chorduction-fret-tooltip');
      if (tip) tip.style.display = 'none';
  }

  // =============================
  // Chord Consolidation (simplification by level)
  // =============================
  function consolidateChords(chords, level) {
      if (!chords || !chords.length) return chords;

      function simplifyName(chord, lvl) {
          if (!chord || chord === 'N') return chord;
          if (lvl === 1) {
              // Basics only: keep root + major/minor quality only
              // Order matters: most specific patterns first
              return chord
                  .replace(/maj7|maj9|maj11|maj13|M7/g, '')
                  .replace(/m7b5/g, 'dim')
                  .replace(/m7|m9|m11|m13/g, 'm')
                  .replace(/dim7/g, 'dim')
                  .replace(/[0-9]+/g, '')      // strip any remaining numeric extensions (7,9,11,13)
                  .replace(/sus[24]|add[0-9]+|aug|\+/g, '')
                  .replace(/\s+/g, '')
                  || chord;
          }
          if (lvl === 2) {
              // 7ths vocabulary: keep 7ths, fold 9/11/13 down to 7
              return chord
                  .replace(/maj9|maj11|maj13/g, 'maj7')
                  .replace(/m9|m11|m13/g, 'm7')
                  .replace(/m7b5/g, 'm7b5')    // keep half-dim as-is
                  .replace(/(?<!maj|m)(9|11|13)/g, '7')  // fold C9/C11/C13 → C7
                  .replace(/sus[24]|add[0-9]+/g, '')
                  .replace(/\s+/g, '')
                  || chord;
          }
          return chord; // Level 3: full extensions, no change
      }

      // Pass 1: simplify chord names according to level
      const simplified = chords.map(c => ({ ...c, chord: simplifyName(c.chord, level) }));

      // Pass 2: merge only consecutive identical chords.
      // Duration-based merging is removed — bar-level detection already produces
      // one chord per bar; aggressive duration filtering causes all chords to collapse
      // at tempos > 120 BPM. Name simplification (Level 1: C7→C) naturally increases
      // consecutive merges without needing a duration threshold.
      const result = [];
      for (const c of simplified) {
          if (result.length > 0 && result[result.length - 1].chord === c.chord) {
              result[result.length - 1] = { ...result[result.length - 1], endMs: c.endMs };
          } else {
              result.push({ ...c });
          }
      }
      return result;
  }

  // =============================
  // Re-Render on Notation / Transpose Change
  // =============================
  function reRenderChords() {
      if (!currentAnalysis?.rawChords?.length) return;
      const transposed = currentAnalysis.rawChords.map(c => ({
          ...c, chord: Transposer.transpose(c.chord, CONFIG.TRANSPOSE_SEMITONES)
      }));
      const displayed = CONFIG.CHORD_NOTATION !== 'standard'
          ? transposed.map(c => ({
              ...c, chord: ChordNotation.convert(c.chord, CONFIG.CHORD_NOTATION, currentAnalysis.key)
          }))
          : transposed;
      const consolidated = consolidateChords(displayed, CONFIG.CHORD_SIMPLIFICATION);
      const synced = syncChordsToLyrics(consolidated, currentAnalysis.lyrics);
      currentAnalysis.chords = synced;
      updateChordDisplay(synced, currentAnalysis.lyrics, currentAnalysis.key);
      // Update transpose display label in panel if open
      const tv = document.getElementById('transpose-value');
      if (tv) tv.textContent = Transposer.getDisplay(CONFIG.TRANSPOSE_SEMITONES) || '0';
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

          // Process chord detection (returns rawChords in standard notation, no transposition)
          const result = detector.processAnalysis(analysis);

          // Apply transposition
          const transposedChords = result.rawChords.map(c => ({
              ...c, chord: Transposer.transpose(c.chord, CONFIG.TRANSPOSE_SEMITONES)
          }));

          // Apply notation conversion
          const displayChords = CONFIG.CHORD_NOTATION !== 'standard'
              ? transposedChords.map(c => ({
                  ...c, chord: ChordNotation.convert(c.chord, CONFIG.CHORD_NOTATION, result.key)
              }))
              : transposedChords;

          // Sync both display and raw chords to lyrics
          const syncedChords = syncChordsToLyrics(displayChords, lyricsResult.lines);
          const rawSynced = syncChordsToLyrics(result.rawChords, lyricsResult.lines);

          currentAnalysis = {
              chords: syncedChords,
              rawChords: rawSynced,
              key: result.key,
              lyrics: lyricsResult.lines,
              sections: analysis.sections || [],
              bars: result.bars || [],
              tempo: result.tempo
          };

          // Update display
          updateChordDisplay(syncedChords, lyricsResult.lines, result.key);

          log.info(`Analysis complete: ${syncedChords.length} chords in key ${result.key} @ ${Math.round(result.tempo)} BPM`);
  
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
              // Reset all guards so the new track always gets a fresh analysis
              currentAnalysis = null;
              lastAttemptedTrackId = null;
              lastAnalysisStartMs = 0;
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
