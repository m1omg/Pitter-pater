'use strict';
// Render a single item to tools/audio/out/<id>.wav (+ <id>.json metadata).
// Usage: node render_item.js <id>
const fs = require('fs');
const path = require('path');
const C = require('./lib/core');
const LU = require('./lib/loudness');
const S = require('./lib/song');
const { listItems, ROOT, loadErrors } = require('./lib/registry');

const OUT = path.join(ROOT, 'out');

function finishSfx(id, def) {
  let res = def.fn();
  let L, R;
  if (res instanceof Float32Array) { L = res; R = res; }
  else { L = res.L; R = res.R || res.L; }
  L = Float32Array.from(L); R = Float32Array.from(R);
  // DC / rumble removal
  for (const B of [L, R]) { new C.Biquad('hp', def.hp || 25, 0.7071).run(B); }
  // trim trailing silence (below -70 dB of peak), keep a little air
  const pk = Math.max(C.peakOf(L), C.peakOf(R)) || 1;
  let e = L.length; const thr = pk * Math.pow(10, -70 / 20);
  while (e > 1 && Math.abs(L[e - 1]) < thr && Math.abs(R[e - 1]) < thr) e--;
  e = Math.min(L.length, e + Math.round(0.01 * C.SR));
  L = L.slice(0, e); R = R.slice(0, e);
  // trim leading silence
  let s = 0; while (s < L.length - 1 && Math.abs(L[s]) < pk * 1e-4 && Math.abs(R[s]) < pk * 1e-4) s++;
  L = L.slice(s); R = R.slice(s);
  C.fadeOut(L, Math.min(Math.round(0.006 * C.SR), L.length >> 2)); C.fadeOut(R, Math.min(Math.round(0.006 * C.SR), R.length >> 2));
  // normalise to target sample peak
  const target = def.peak === undefined ? -6 : def.peak;
  const p2 = Math.max(C.peakOf(L), C.peakOf(R));
  const g = Math.pow(10, target / 20) / (p2 || 1);
  C.scaleBuf(L, g); if (R !== L) C.scaleBuf(R, g);
  // mono if channels identical
  let mono = true; for (let i = 0; i < L.length; i++) if (Math.abs(L[i] - R[i]) > 1e-6) { mono = false; break; }
  const chans = mono ? [L] : [L, R];
  const stats = { peak: LU.samplePeakDb(chans), tp: LU.truePeak(chans), mMax: LU.momentaryMax(chans.length === 1 ? [L, L] : chans), lufs: LU.integrated(chans.length === 1 ? [L, L] : chans) };
  return { chans, meta: { id, type: 'sfx', loop: false, loopStart: 0, loopEnd: 0, duration: L.length / C.SR, channels: chans.length, stats } };
}

function renderId(id) {
  const items = listItems();
  const it = items[id];
  if (!it) throw new Error('unknown id ' + id + (loadErrors.length ? ' (load errors: ' + loadErrors.join('; ') + ')' : ''));
  const t0 = Date.now();
  let chans, meta;
  if (it.kind === 'sfx') {
    ({ chans, meta } = finishSfx(id, it.def));
  } else {
    const song = it.mod.build();
    const r = S.render(song);
    chans = [r.L, r.R];
    meta = { id, type: it.type, partRel: r.partRel, loop: r.loop, loopStart: r.loopStart, loopEnd: r.loopEnd, loopStartS: r.loopStartS, loopEndS: r.loopEndS, duration: r.duration, channels: 2, stats: r.stats, log: r.log };
  }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  C.writeWav(path.join(OUT, id + '.wav'), chans);
  meta.renderMs = Date.now() - t0;
  fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(meta, null, 1));
  return meta;
}

if (require.main === module) {
  const id = process.argv[2];
  try {
    const m = renderId(id);
    const s = m.stats;
    console.log(`${id}: ${m.duration.toFixed(2)}s loop=${m.loop} [${m.loopStart.toFixed(3)}, ${m.loopEnd.toFixed(3)}] lufs=${s.lufs.toFixed(2)} tp=${s.tp.toFixed(2)}${s.seamErrDb !== undefined && s.seamErrDb !== null ? ' seamErr=' + s.seamErrDb.toFixed(0) + 'dB' : ''} (${m.renderMs} ms)` + (m.log && m.log.some((x) => x.startsWith('WARN')) ? ' ' + m.log.filter((x) => x.startsWith('WARN')).join(';') : ''));
  } catch (e) {
    console.error('FAILED ' + id + ': ' + (e.stack || e));
    process.exit(1);
  }
}
module.exports = { renderId };
