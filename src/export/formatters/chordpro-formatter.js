/**
 * @fileoverview ChordPro (.cho) formatter with section markers.
 * @module export/formatters/chordpro-formatter
 */

/**
 * @param {import('../../types.js').ExportData} data
 * @returns {string}
 */
export function toChordPro(data) {
  const { chords, meta, sections, lyrics } = data;
  let out = `{title: ${meta.title}}\n`;
  out += `{artist: ${meta.artist}}\n`;
  out += `{key: ${meta.key ?? 'C'}}\n`;
  if (meta.tempo) { out += `{tempo: ${meta.tempo}}\n`; }
  out += `\n`;

  if (sections?.length && lyrics?.length) {
    // Interleave section markers with lyric lines + chord markers
    let sIdx = 0;
    let cIdx = 0;
    let inChorus = false;

    for (const lyric of lyrics) {
      // Advance section pointer
      while (sIdx < sections.length - 1 && lyric.startMs >= sections[sIdx].endTime * 1000) { sIdx++; }
      const sec = sections[sIdx];

      if (sec) {
        const isFirstBeat = lyric.startMs >= sec.startTime * 1000 && lyric.startMs < (sec.startTime + 1) * 1000;
        if (isFirstBeat) {
          if (inChorus && sec.type !== 'chorus') { out += `{end_of_chorus}\n`; inChorus = false; }
          if (sec.type === 'chorus' && !inChorus) { out += `{start_of_chorus}\n`; inChorus = true; }
          else if (sec.type !== 'chorus') {
            const label = sec.type[0].toUpperCase() + sec.type.slice(1);
            const rep   = sec.repetitionIndex > 1 ? ` ${sec.repetitionIndex}` : '';
            out += `{comment: ${label}${rep}}\n`;
          }
        }
      }

      // Collect chords that land on this lyric line
      const chordMarkers = [];
      while (cIdx < chords.length && chords[cIdx].startMs <= (lyric.startMs + 500)) {
        chordMarkers.push(`[${chords[cIdx].chord}]`);
        cIdx++;
      }

      out += chordMarkers.join('') + lyric.text + '\n';
    }
    if (inChorus) { out += `{end_of_chorus}\n`; }
  } else {
    // No lyrics: just chord markers
    for (const chord of chords ?? []) { out += `[${chord.chord}]`; }
    out += '\n';
  }

  return out;
}
