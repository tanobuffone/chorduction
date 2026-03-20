/**
 * @fileoverview Named cache instances for the extension.
 * @module cache/cache-manager
 */

import { SmartCache } from './smart-cache.js';

/**
 * @param {{ ttl?: number, capacity?: number }} [options]
 * @returns {{ analysis: SmartCache<string,any>, lyrics: SmartCache<string,any>, timeline: SmartCache<string,any> }}
 */
export function createCaches({ ttl = 600_000, capacity = 20 } = {}) {
  return {
    analysis: new SmartCache({ name: 'analysis', ttl, capacity }),
    lyrics:   new SmartCache({ name: 'lyrics',   ttl, capacity }),
    timeline: new SmartCache({ name: 'timeline', ttl, capacity }),
  };
}
