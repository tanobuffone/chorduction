/**
 * @fileoverview File export dispatcher — triggers browser download.
 * @module export/file-exporter
 */

import { toTxt }      from './formatters/txt-formatter.js';
import { toJson }     from './formatters/json-formatter.js';
import { toChordPro } from './formatters/chordpro-formatter.js';

/** @type {Record<string, (data: import('../types.js').ExportData) => string>} */
const FORMATTERS = {
  txt:      toTxt,
  json:     toJson,
  chordpro: toChordPro,
};

/**
 * Export chord data as a downloadable file.
 * @param {import('../types.js').ExportData} data
 * @param {'txt'|'json'|'chordpro'} format
 * @returns {boolean} true on success
 */
export function exportFile(data, format) {
  const formatter = FORMATTERS[format];
  if (!formatter) { throw new Error(`Unknown export format: ${format}`); }

  const safeTitle = (data.meta?.title ?? 'song').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const exts = { txt: 'txt', json: 'json', chordpro: 'cho' };
  const filename = `${safeTitle}_chords.${exts[format]}`;
  const mimeTypes = { txt: 'text/plain', json: 'application/json', chordpro: 'text/plain' };

  const content = formatter(data);
  _download(content, filename, mimeTypes[format] ?? 'text/plain');
  return true;
}

/**
 * Register a custom formatter.
 * @param {string} format
 * @param {(data: import('../types.js').ExportData) => string} fn
 */
export function registerFormatter(format, fn) {
  FORMATTERS[format] = fn;
}

/**
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function _download(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
