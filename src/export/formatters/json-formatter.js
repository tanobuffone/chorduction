/**
 * @fileoverview JSON v2 chord sheet formatter.
 * @module export/formatters/json-formatter
 */

/**
 * @param {import('../../types.js').ExportData} data
 * @returns {string}
 */
export function toJson(data) {
  const payload = {
    meta: {
      ...data.meta,
      schemaVersion:      '2.0',
      chorductionVersion: data.meta.version ?? __VERSION__,
      exportedAt:         new Date().toISOString(),
    },
    chords:   data.chords   ?? [],
    sections: data.sections ?? [],
    lyrics:   data.lyrics   ?? [],
  };
  return JSON.stringify(payload, null, 2);
}
