#!/usr/bin/env node
'use strict';
// Verifies the packaged audio in game/audio:
//  - base64-decodes every AUDIO_DB.add(...) entry back to .ogg and ffprobes it
//  - measures integrated loudness + true peak with ffmpeg ebur128
//  - decodes to PCM and checks DC offset, sample peak, length, and loop-seam continuity
//  - optional spectrogram PNGs: --spectro=id1,id2 (written to tools/audio/out/spectro)
// Usage: node tools/audio/verify.js [ids...] [--spectro=...] [--json]
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const GAME_AUDIO = path.resolve(ROOT, '..', '..', 'game', 'audio');
const TMP = path.join(ROOT, 'out', 'verify_tmp');
fs.mkdirSync(TMP, { recursive: true });
const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const SR = 44100;

function loadEntries() {
  const entries = {};
  const AUDIO_DB = { add(id, o) { entries[id] = o; } };
  for (const f of fs.readdirSync(GAME_AUDIO)) {
    if (!f.endsWith('.js') || f === 'manifest.js') continue;
    const src = fs.readFileSync(path.join(GAME_AUDIO, f), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('AUDIO_DB', src)(AUDIO_DB);
  }
  const mtxt = fs.readFileSync(path.join(GAME_AUDIO, 'manifest.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  const manifest = new Function(mtxt + '; return AUDIO_MANIFEST;')();
  return { entries, manifest };
}

function readWav(p) {
  const b = fs.readFileSync(p); let off = 12, fmt = null, data = null;
  while (off < b.length) { const id = b.toString('ascii', off, off + 4), sz = b.readUInt32LE(off + 4); if (id === 'fmt ') fmt = { ch: b.readUInt16LE(off + 10), bits: b.readUInt16LE(off + 22) }; if (id === 'data') data = [off + 8, sz]; off += 8 + sz + (sz & 1); }
  const n = data[1] / (fmt.bits / 8) / fmt.ch; const ch = []; for (let c = 0; c < fmt.ch; c++) ch.push(new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) { const q = data[0] + (i * fmt.ch + c) * (fmt.bits / 8); ch[c][i] = fmt.bits === 32 ? b.readFloatLE(q) : b.readInt16LE(q) / 32768; }
  return ch;
}
function ebur(file) {
  let out = '';
  try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stderr || ''); }
  if (!out) out = String(execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1`]));
  const sum = out.slice(out.lastIndexOf('Summary:'));
  const I = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(sum), P = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(sum);
  return { I: I ? parseFloat(I[1]) : NaN, TP: P ? parseFloat(P[1]) : NaN };
}
function decode(file, ch) {
  const buf = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', String(ch), '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const n = f.length / ch; const chans = [];
  for (let c = 0; c < ch; c++) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = f[i * ch + c]; chans.push(a); }
  return chans;
}
function seamCheck(chans, ls, le) {
  // informational: 2nd-difference spike ratio and RMS step right at the joint
  const W = 4096;
  let worst = 0, rmsDiff = 0;
  for (const x of chans) {
    const seg = new Float32Array(2 * W);
    for (let i = 0; i < W; i++) { seg[i] = x[le - W + i]; seg[W + i] = x[ls + i]; }
    const d2 = new Float32Array(2 * W);
    for (let i = 1; i < 2 * W - 1; i++) d2[i] = Math.abs(seg[i + 1] - 2 * seg[i] + seg[i - 1]);
    const ref = Array.from(d2.slice(2, 2 * W - 2)).filter((_, i) => Math.abs(i + 2 - W) > 8).sort((a, b) => a - b);
    const p99 = ref[Math.floor(ref.length * 0.99)] + 1e-7;
    let atSeam = 0; for (let i = W - 2; i <= W + 1; i++) atSeam = Math.max(atSeam, d2[i]);
    worst = Math.max(worst, atSeam / p99);
    const r = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += seg[i] * seg[i]; return Math.sqrt(s / (b - a)) + 1e-9; };
    const n50 = Math.round(0.05 * SR);
    rmsDiff = Math.max(rmsDiff, Math.abs(20 * Math.log10(r(W - n50, W) / r(W, W + n50))));
  }
  // click detector: energy above ~5 kHz (2nd difference) in a 10 ms window centred on the joint,
  // expressed as a percentile of the same measure over 300 random windows of the looped region
  const hfWin = (x, get) => { let e = 0; for (let k = -220; k < 220; k++) { const a = get(k - 1), b = get(k), c = get(k + 1); const d = c - 2 * b + a; e += d * d; } return e; };
  let pct = 0;
  const rng = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })();
  for (const x of chans) {
    const at = (k) => (k < 0 ? x[le + k] : x[ls + k]);
    const eSeam = hfWin(x, at);
    const L = le - ls, vals = [];
    for (let j = 0; j < 300; j++) { const c = ls + 300 + Math.floor(rng() * (L - 600)); vals.push(hfWin(x, (k) => x[c + k])); }
    vals.sort((a, b) => a - b);
    let below = 0; for (const v of vals) if (v < eSeam) below++;
    pct = Math.max(pct, (100 * below) / vals.length);
  }
  return { ratio: worst, rmsDiff, clickPct: pct };
}

function main() {
  const { entries, manifest } = loadEntries();
  let ids = args.filter((a) => !a.startsWith('--'));
  if (!ids.length) ids = Object.keys(manifest);
  const rows = []; let problems = 0;
  for (const id of ids) {
    const m = manifest[id], e = entries[id];
    const row = { id };
    if (!m || !e) { row.err = 'missing ' + (!m ? 'manifest ' : '') + (!e ? 'data' : ''); rows.push(row); problems++; continue; }
    const ogg = path.join(TMP, id + '.ogg');
    fs.writeFileSync(ogg, Buffer.from(e.data, 'base64'));
    const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', ogg]).toString());
    const st = pr.streams[0];
    row.codec = st.codec_name; row.ch = st.channels; row.sr = parseInt(st.sample_rate, 10); row.kB = Math.round(e.data.length / 1024);
    const eb = ebur(ogg); row.lufs = eb.I; row.tp = eb.TP;
    const chans = decode(ogg, row.ch);
    const n = chans[0].length;
    row.dur = n / SR; row.durErr = Math.abs(row.dur - m.duration) * SR; // samples
    let pk = 0, dc = 0; for (const c of chans) { let s = 0; for (let i = 0; i < n; i++) { const a = Math.abs(c[i]); if (a > pk) pk = a; s += c[i]; } dc = Math.max(dc, Math.abs(s / n)); }
    row.peak = 20 * Math.log10(pk + 1e-12); row.dc = dc;
    if (e.loop) {
      if (e.loopStart !== m.loopStart || e.loopEnd !== m.loopEnd) row.err = 'loop points differ between data file and manifest';
      const ls = Math.round(e.loopStart * SR), le = Math.round(e.loopEnd * SR);
      if (le > n) row.err = 'loopEnd beyond decoded length';
      else {
        const sc = seamCheck(chans, ls, le); row.seam = sc.ratio; row.seamRms = sc.rmsDiff; row.clickPct = sc.clickPct;
        // if the pre-encode WAV is still around: HF energy at the decoded joint relative to the original joint
        const wavPath = path.join(ROOT, 'out', id + '.wav');
        if (fs.existsSync(wavPath)) {
          const w = readWav(wavPath);
          const hf = (x) => { let e = 0; const at = (k) => (k < 0 ? x[le + k] : x[ls + k]); for (let k = -220; k < 220; k++) { const d = at(k + 1) - 2 * at(k) + at(k - 1); e += d * d; } return e; };
          let rel = -Infinity;
          for (let c = 0; c < Math.min(w.length, chans.length); c++) rel = Math.max(rel, 10 * Math.log10((hf(chans[c]) + 1e-12) / (hf(w[c]) + 1e-12)));
          row.clickRel = rel;
        }
        // with an intro, the audio right before loopEnd must equal the audio right before loopStart
        if (ls > 2048) {
          let d = 0, pk = 1e-9;
          for (const c of chans) for (let k = 1; k <= 2048; k++) { d = Math.max(d, Math.abs(c[le - k] - c[ls - k])); pk = Math.max(pk, Math.abs(c[ls - k])); }
          row.preErr = 20 * Math.log10(d / pk + 1e-12);
        }
      }
    }
    // flags
    const f = [];
    if (row.codec !== 'vorbis') f.push('codec');
    if (row.sr !== 44100) f.push('rate');
    if (row.durErr > 2) f.push('length');
    if (row.dc > 0.001) f.push('DC');
    if (m.type === 'bgm' && (Math.abs(row.lufs + 18) > 1.05 || row.tp > -1.5)) f.push('loudness');
    if (m.type === 'amb' && Math.abs(row.lufs + 26) > 1.5) f.push('loudness');
    if (m.type === 'jingle' && Math.abs(row.lufs + 16) > 1.5) f.push('loudness');
    if (row.peak > -0.3) f.push('clip');
    if (row.clickRel !== undefined) { if (row.clickRel > 6 && row.clickPct > 95) f.push('seam-click'); }
    // without the pre-encode WAV the percentile alone cannot tell a click from a downbeat onset: info only
    if (row.preErr !== undefined && row.preErr > -12) f.push('seam');
    try { const mj = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', id + '.json'), 'utf8')); if (mj.stats && mj.stats.seamErrDb !== null && mj.stats.seamErrDb !== undefined) { row.wavSeam = mj.stats.seamErrDb; if (row.wavSeam > -60) f.push('wavseam'); } } catch (e) { /* no render meta */ }
    if (row.err) f.push('err');
    row.flags = f.join(',');
    if (f.length) problems++;
    rows.push(row);
  }
  const fmt = (x, d = 1) => (x === undefined || Number.isNaN(x) ? '-' : x.toFixed(d));
  console.log('id'.padEnd(20), 'ch', 'dur(s)'.padStart(7), 'LUFS'.padStart(6), 'TP'.padStart(6), 'peak'.padStart(6), 'DC'.padStart(8), 'seam'.padStart(5), 'dRMS'.padStart(5), 'click%'.padStart(6), 'cRel'.padStart(5), 'pre'.padStart(6), 'wav'.padStart(5), 'kB'.padStart(5), 'flags');
  for (const r of rows) {
    if (r.err && !r.codec) { console.log(r.id.padEnd(20), 'ERROR', r.err); continue; }
    console.log(r.id.padEnd(20), String(r.ch).padStart(2), fmt(r.dur, 2).padStart(7), fmt(r.lufs).padStart(6), fmt(r.tp).padStart(6), fmt(r.peak).padStart(6), r.dc.toExponential(1).padStart(8), fmt(r.seam, 2).padStart(5), fmt(r.seamRms, 1).padStart(5), fmt(r.clickPct, 0).padStart(6), fmt(r.clickRel, 1).padStart(5), fmt(r.preErr, 0).padStart(6), fmt(r.wavSeam, 0).padStart(5), String(r.kB).padStart(5), r.flags + (r.err ? ' ' + r.err : ''));
  }
  console.log(`\n${rows.length} items checked, ${problems} with flags`);
  if (args.includes('--json')) fs.writeFileSync(path.join(ROOT, 'out', 'verify.json'), JSON.stringify(rows, null, 1));
  const spec = opt('spectro', null);
  if (spec) {
    const dir = path.join(ROOT, 'out', 'spectro'); fs.mkdirSync(dir, { recursive: true });
    for (const id of spec.split(',')) {
      const ogg = path.join(TMP, id + '.ogg');
      if (!fs.existsSync(ogg)) { const e = entries[id]; if (!e) continue; fs.writeFileSync(ogg, Buffer.from(e.data, 'base64')); }
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', ogg, '-lavfi', 'showspectrumpic=s=1024x512:legend=1:scale=log:fscale=lin:stop=12000', path.join(dir, id + '.png')]);
      console.log('spectrogram: ' + path.join(dir, id + '.png'));
    }
  }
  fs.rmSync(TMP, { recursive: true, force: true });
}
main();
