'use strict';
// Long-term average spectrum in octave bands for a WAV (float32/16-bit) file: node tools/ltas.js file.wav [start] [dur]
const fs = require('fs');
const C = require('../lib/core');
function readWav(p) {
  const b = fs.readFileSync(p);
  let off = 12, fmt = null, data = null;
  while (off < b.length) { const id = b.toString('ascii', off, off + 4), sz = b.readUInt32LE(off + 4); if (id === 'fmt ') fmt = { format: b.readUInt16LE(off + 8), ch: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) }; if (id === 'data') data = [off + 8, sz]; off += 8 + sz + (sz & 1); }
  const n = data[1] / (fmt.bits / 8) / fmt.ch; const ch = []; for (let c = 0; c < fmt.ch; c++) ch.push(new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) { const p2 = data[0] + (i * fmt.ch + c) * (fmt.bits / 8); ch[c][i] = fmt.bits === 32 ? b.readFloatLE(p2) : b.readInt16LE(p2) / 32768; }
  return ch;
}
function ltas(chans, start = 0, dur = 1e9) {
  const N = 8192; const fft = new C.FFT(N); const acc = new Float64Array(N / 2); let cnt = 0;
  const a = Math.round(start * C.SR), e = Math.min(chans[0].length, a + Math.round(dur * C.SR));
  const win = new Float64Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  for (let s = a; s + N <= e; s += N / 2) for (const x of chans) {
    const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft.forward(re, im); for (let k = 0; k < N / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k]; cnt++;
  }
  const bands = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const out = bands.map((fc) => { let s = 0; const lo = fc / Math.SQRT2, hi = fc * Math.SQRT2; for (let k = 1; k < N / 2; k++) { const f = k * C.SR / N; if (f >= lo && f < hi) s += acc[k]; } return 10 * Math.log10(s / cnt + 1e-20); });
  const mx = Math.max(...out);
  return bands.map((b, i) => `${b >= 1000 ? b / 1000 + 'k' : b}:${(out[i] - mx).toFixed(1)}`).join(' ');
}
if (require.main === module) { const ch = readWav(process.argv[2]); console.log(ltas(ch, parseFloat(process.argv[3] || 0), parseFloat(process.argv[4] || 1e9))); }
module.exports = { readWav, ltas };
