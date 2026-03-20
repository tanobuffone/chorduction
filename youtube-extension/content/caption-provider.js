/**
 * @fileoverview Fetches YouTube captions from ytInitialPlayerResponse.
 */

/**
 * @returns {{ title: string, artist: string, videoId: string }}
 */
export function getYouTubeMeta() {
  const title   = document.title.replace(' - YouTube', '').trim();
  const channel = document.querySelector('#channel-name a, ytd-channel-name a')?.textContent?.trim() ?? 'Unknown';
  const videoId = new URLSearchParams(window.location.search).get('v') ?? '';
  return { title, artist: channel, videoId };
}

/**
 * Fetch captions from YouTube's embedded player data.
 * @param {string} [lang]
 * @returns {Promise<Array<{startMs:number, text:string}>>}
 */
export async function fetchYouTubeCaptions(lang = 'en') {
  try {
    // @ts-ignore — injected by YouTube
    const pr = window.ytInitialPlayerResponse;
    const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) { return []; }

    // Prefer manual over auto-generated, matching language
    const track = tracks.find(t => t.kind !== 'asr' && t.languageCode?.startsWith(lang))
               ?? tracks.find(t => t.languageCode?.startsWith(lang))
               ?? tracks[0];
    if (!track?.baseUrl) { return []; }

    const res  = await fetch(track.baseUrl + '&fmt=json3');
    const data = await res.json();

    return (data.events ?? [])
      .filter(/** @param {any} e */ e => e.segs)
      .map(/** @param {any} e */ e => ({
        startMs: e.tStartMs ?? 0,
        text:    e.segs.map(/** @param {any} s */ s => s.utf8).join('').trim(),
      }))
      .filter(/** @param {any} l */ l => l.text);
  } catch {
    return [];
  }
}

/**
 * Fallback: search LRCLIB by title + artist.
 * @param {string} artist @param {string} title @param {number} durationMs
 * @returns {Promise<Array<{startMs:number, text:string}>>}
 */
export async function fetchLRCLIBFallback(artist, title, durationMs) {
  try {
    const params = new URLSearchParams({ track_name: title, artist_name: artist, duration: String(Math.floor(durationMs / 1000)) });
    const res = await fetch(`https://lrclib.net/api/get?${params}`, { headers: { 'User-Agent': 'Chorduction-YT/7.0.0' } });
    if (!res.ok) { return []; }
    const data = await res.json();
    if (!data?.syncedLyrics) { return []; }
    return data.syncedLyrics.trim().split('\n').flatMap(/** @param {string} line */ line => {
      const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (!m) { return []; }
      const ms = (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + (m[3].length === 2 ? parseInt(m[3]) * 10 : parseInt(m[3]));
      const text = m[4].trim();
      return text ? [{ startMs: ms, text }] : [];
    });
  } catch {
    return [];
  }
}
