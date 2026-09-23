'use strict';
// Harmony sanity check: builds a track's Song (no rendering) and lists moments where two sustained
// pitched notes (>= minDur beats, overlapping >= minOverlap beats) form a minor 2nd / minor 9th.
// Usage: node tools/clashcheck.js <track id> [minDur=0.9]
const { listItems } = require('../lib/registry');
const T = require('../lib/theory');
const PERC = /kick|snare|hat|shaker|wood|block|tri|crash|ride|cym|tom|timp|swell|sweep|brush|rim|clap|heart|creak|static|drop|gong|riser|hit|clock|vinyl/i;
function check(id, minDur = 0.9, minOverlap = 0.5) {
  const it = listItems()[id]; const song = it.mod.build();
  const notes = [];
  for (const p of song.parts) {
    if (PERC.test(p.name)) continue;
    for (const e of p.events) {
      const ms = Array.isArray(e.m) ? e.m : [e.m];
      const d = e.d * (e.leg === undefined ? 0.95 : Math.min(1, e.leg));
      if (d < minDur) continue;
      for (const m of ms) if (typeof m === 'number') notes.push({ part: p.name, b: e.b, e: e.b + d, m });
    }
  }
  notes.sort((a, b) => a.b - b.b);
  const out = [];
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length && notes[j].b < notes[i].e; j++) {
    const a = notes[i], b = notes[j];
    const ov = Math.min(a.e, b.e) - Math.max(a.b, b.b);
    if (ov < minOverlap) continue;
    const iv = Math.abs(a.m - b.m);
    if (iv === 1 || iv === 13 || iv === 25) out.push(`${(Math.max(a.b, b.b) / song.meter + 1).toFixed(2).padStart(6)} bar  ${T.noteName(a.m)}(${a.part}) vs ${T.noteName(b.m)}(${b.part})  overlap ${ov.toFixed(2)}b`);
  }
  return out;
}
if (require.main === module) {
  const ids = process.argv.slice(2).filter((x) => !/^\d/.test(x));
  for (const id of ids) { const r = check(id, parseFloat(process.argv.find((x) => /^\d/.test(x)) || 0.9)); console.log(`== ${id}: ${r.length} minor-2nd/9th overlaps`); for (const l of r.slice(0, 40)) console.log('  ' + l); }
}
module.exports = { check };
