/**
 * @fileoverview Lyrics provider orchestrator — tries providers in priority order.
 * @module providers/lyrics-provider-chain
 */

/**
 * Parse LRC-format lyrics string into an array of timed lines.
 * @param {string} lrcText
 * @returns {Array<{startMs: number, text: string}>}
 */
export function parseLRC(lrcText) {
  const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  const lines = /** @type {Array<{startMs:number,text:string}>} */ ([]);
  for (const raw of lrcText.trim().split('\n')) {
    const m = raw.match(re);
    if (!m) { continue; }
    const ms = (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000
             + (m[3].length === 2 ? parseInt(m[3]) * 10 : parseInt(m[3]));
    const text = raw.replace(re, '').trim();
    if (text) { lines.push({ startMs: ms, text }); }
  }
  return lines;
}

/**
 * @param {string} artist
 * @param {string} title
 * @param {number} durationMs
 * @param {number} [timeoutMs]
 * @returns {Promise<Array<{startMs:number,text:string}>|null>}
 */
export async function fetchFromLRCLIB(artist, title, durationMs, timeoutMs = 15000) {
  const params = new URLSearchParams({
    track_name:  title,
    artist_name: artist,
    duration:    String(Math.floor(durationMs / 1000)),
  });
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { 'User-Agent': `Spicetify-Chorduction/${__VERSION__}` },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) { return null; }
    const data = await res.json();
    if (data?.syncedLyrics) {
      const lines = parseLRC(data.syncedLyrics);
      if (lines.length) { return lines; }
    }
  } catch { clearTimeout(tid); }
  return null;
}

/**
 * @param {string} trackId
 * @param {Function} cosmosGet  - Spicetify.CosmosAsync.get
 * @returns {Promise<Array<{startMs:number,text:string}>|null>}
 */
export async function fetchFromSpotifyInternal(trackId, cosmosGet) {
  const urls = [
    `hm://color-lyrics/v2/track/${trackId}?format=json&market=from_token`,
    `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&market=from_token`,
  ];
  for (const url of urls) {
    try {
      const data = await cosmosGet(url);
      if (data?.lyrics?.lines?.length) {
        const lines = data.lyrics.lines
          .map(/** @param {any} l */ l => ({ startMs: parseInt(l.startTimeMs) || 0, text: (l.words ?? '').trim() }))
          .filter(/** @param {any} l */ l => l.text);
        if (lines.length) { return lines; }
      }
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Orchestrate providers with fallback chain.
 * @param {{
 *   artist: string, title: string, durationMs: number, trackId: string,
 *   cosmosGet?: Function,
 *   cache: import('../cache/smart-cache.js').SmartCache<string, any>,
 *   logger?: import('../utils/logger.js').Logger,
 * }} opts
 * @returns {Promise<Array<{startMs:number,text:string}>>}
 */
export async function fetchLyrics({ artist, title, durationMs, trackId, cosmosGet, cache, logger }) {
  const key = `${artist}::${title}`;
  const cached = cache.get(key);
  if (cached) { return cached; }

  // 1. Spotify internal
  if (cosmosGet) {
    const lines = await fetchFromSpotifyInternal(trackId, cosmosGet);
    if (lines?.length) { cache.set(key, lines); return lines; }
  }

  // 2. LRCLIB
  const lrcLines = await fetchFromLRCLIB(artist, title, durationMs);
  if (lrcLines?.length) { cache.set(key, lrcLines); return lrcLines; }

  logger?.debug('[LyricsChain] No lyrics found');
  return [];
}
