/**
 * @fileoverview Chorduction-YT popup panel.
 * Displays the current chord + settings; communicates with the content script
 * via the background service worker (chrome.runtime messaging).
 */

const STORAGE_KEY = 'chorduction_yt_settings';

/** @type {{ showOverlay: boolean, showLyrics: boolean }} */
let settings = { showOverlay: true, showLyrics: true };

// ── Element references ────────────────────────────────────────────────────────
const statusDot     = /** @type {HTMLElement}      */ (document.getElementById('status-dot'));
const statusLabel   = /** @type {HTMLElement}      */ (document.getElementById('status-label'));
const chordDisplay  = /** @type {HTMLElement}      */ (document.getElementById('chord-display'));
const confidenceFill = /** @type {HTMLElement}     */ (document.getElementById('confidence-fill'));
const lyricDisplay  = /** @type {HTMLElement}      */ (document.getElementById('lyric-display'));
const noVideoMsg    = /** @type {HTMLElement}      */ (document.getElementById('no-video-msg'));
const activeContent = /** @type {HTMLElement}      */ (document.getElementById('active-content'));
const toggleOverlay = /** @type {HTMLInputElement} */ (document.getElementById('toggle-overlay'));
const toggleLyrics  = /** @type {HTMLInputElement} */ (document.getElementById('toggle-lyrics'));

// ── Status helpers ────────────────────────────────────────────────────────────
/** @param {'active'|'loading'|'error'|''} state @param {string} text */
function setStatus(state, text) {
  statusDot.className   = `status-dot${state ? ' ' + state : ''}`;
  statusLabel.textContent = text;
}

// ── Chord update ──────────────────────────────────────────────────────────────
/**
 * @param {{ chord: string, confidence: number, lyric?: string }|null} data
 */
function renderChord(data) {
  if (!data) {
    chordDisplay.textContent = '—';
    chordDisplay.classList.add('no-data');
    confidenceFill.style.width = '0%';
    lyricDisplay.textContent   = '';
    return;
  }
  chordDisplay.textContent = data.chord;
  chordDisplay.classList.remove('no-data');
  confidenceFill.style.width = `${Math.round((data.confidence ?? 0) * 100)}%`;
  lyricDisplay.textContent   = data.lyric ?? '';
}

// ── Query active tab ──────────────────────────────────────────────────────────
async function queryActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

/** @returns {Promise<boolean>} */
async function isOnYouTubeWatch() {
  const tab = await queryActiveTab();
  return Boolean(tab?.url?.includes('youtube.com/watch'));
}

// ── Poll analysis data from content script via background ─────────────────────
let _pollId = 0;

function startPolling() {
  stopPolling();
  _poll();
  _pollId = setInterval(_poll, 1500);
}

function stopPolling() {
  if (_pollId) { clearInterval(_pollId); _pollId = 0; }
}

async function _poll() {
  try {
    const tab = await queryActiveTab();
    if (!tab?.id) { return; }

    /** @type {any} */
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_CHORD' }, res => {
        if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); }
        else { resolve(res); }
      });
    });

    if (response?.chord) {
      setStatus('active', 'Detecting chords');
      renderChord(response);
    } else {
      setStatus('loading', 'Waiting for audio…');
      renderChord(null);
    }
  } catch {
    setStatus('error', 'Content script not ready');
    renderChord(null);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  if (result[STORAGE_KEY]) {
    settings = { ...settings, ...result[STORAGE_KEY] };
  }
  toggleOverlay.checked = settings.showOverlay;
  toggleLyrics.checked  = settings.showLyrics;
}

async function saveSettings() {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  // Notify content script of settings change
  const tab = await queryActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_SETTINGS', payload: settings }).catch(() => {});
  }
}

toggleOverlay.addEventListener('change', () => {
  settings.showOverlay = toggleOverlay.checked;
  saveSettings();
});

toggleLyrics.addEventListener('change', () => {
  settings.showLyrics = toggleLyrics.checked;
  saveSettings();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadSettings();

  const onYT = await isOnYouTubeWatch();
  if (!onYT) {
    noVideoMsg.hidden   = false;
    activeContent.hidden = true;
    return;
  }

  noVideoMsg.hidden    = true;
  activeContent.hidden = false;

  setStatus('loading', 'Connecting…');
  startPolling();
}

document.getElementById('report-link')?.addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://github.com/chorduction/chorduction/issues/new' });
});

init();
