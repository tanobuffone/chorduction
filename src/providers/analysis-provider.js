/**
 * @fileoverview Spotify Audio Analysis API provider.
 * @module providers/analysis-provider
 */

/**
 * @param {string} trackId
 * @param {{
 *   accessToken: string,
 *   cache: import('../cache/smart-cache.js').SmartCache<string,any>,
 *   timeoutMs?: number,
 *   logger?: import('../utils/logger.js').Logger,
 * }} opts
 * @returns {Promise<Object|null>}
 */
export async function fetchAudioAnalysis(trackId, { accessToken, cache, timeoutMs = 15000, logger }) {
  if (!trackId) { return null; }

  const cached = cache.get(trackId);
  if (cached) { logger?.debug(`[Analysis] Cache hit: ${trackId}`); return cached; }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger?.info(`[Analysis] Fetching: ${trackId}`);
    const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (res.status === 429) {
      logger?.warn('[Analysis] Rate limited (429) — using cache or manual fallback');
      return null;
    }
    if (!res.ok) { logger?.warn(`[Analysis] HTTP ${res.status}`); return null; }

    const data = await res.json();
    if (data?.segments?.length) {
      cache.set(trackId, data);
      logger?.debug(`[Analysis] Fetched OK: ${data.segments.length} segments`);
      return data;
    }
  } catch (e) {
    clearTimeout(tid);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Failed to fetch') || msg.includes('CORS')) {
      logger?.warn('[Analysis] Blocked by CORS — expected in web player');
    } else {
      logger?.warn('[Analysis] Fetch error:', msg);
    }
  }
  return null;
}

/**
 * Extract Spotify track ID from a URI or URL.
 * @param {string|null|undefined} uri
 * @returns {string|null}
 */
export function spotifyIdFromUri(uri) {
  if (!uri) { return null; }
  const m = uri.match(/spotify:track:([A-Za-z0-9]+)|open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  return m ? (m[1] ?? m[2]) : null;
}
