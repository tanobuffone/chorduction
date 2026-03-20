/**
 * @fileoverview Wraps Spicetify.Player events and state into a clean interface.
 * @module platforms/spicetify/player-adapter
 */

/**
 * @returns {{ title: string, artist: string, uri: string|null, durationMs: number }}
 */
export function getTrackMeta() {
  try {
    const data = Spicetify.Player?.data ?? {};
    const item = data?.item ?? data?.track ?? {};
    const meta = item?.metadata ?? {};
    return {
      title:      meta?.title     ?? item?.name  ?? 'Unknown',
      artist:     item?.artists?.map(/** @param {any} a */ a => a.name).join(', ') ?? meta?.artist_name ?? 'Unknown',
      uri:        meta?.uri       ?? item?.uri   ?? null,
      durationMs: parseInt(meta?.duration ?? item?.duration_ms ?? 0),
    };
  } catch {
    return { title: 'Unknown', artist: 'Unknown', uri: null, durationMs: 0 };
  }
}

/**
 * @returns {string} Bearer token
 */
export function getAccessToken() {
  return Spicetify?.Platform?.AccessToken ?? '';
}

/**
 * @param {import('../../utils/cleanup-manager.js').CleanupManager} cleanup
 * @param {{ onTrackChange: Function, onPlayPause: Function }} handlers
 */
export function registerPlayerListeners(cleanup, handlers) {
  cleanup.addListener(Spicetify.Player, 'ontrackchange', handlers.onTrackChange);
  cleanup.addListener(Spicetify.Player, 'onplaypause',   handlers.onPlayPause);
}
