'use strict';
// ITU-R BS.1770-4 loudness (integrated, gated), momentary max, and 4x-oversampled true peak.
const { SR } = require('./core');

function kCoeffs(sr) {
  // pre-filter (high shelf) and RLB high-pass, derived from analog prototypes (as in libebur128)
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan(Math.PI * f0 / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const pb = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0];
  const pa = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan(Math.PI * f0 / sr);
  a0 = 1 + K / Q + K * K;
  const rb = [1, -2, 1];
  const ra = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
  return { pb, pa, rb, ra };
}
function kWeight(x, sr = SR) {
  const { pb, pa, rb, ra } = kCoeffs(sr);
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const s = pb[0] * v + pb[1] * x1 + pb[2] * x2 - pa[1] * y1 - pa[2] * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = s;
    const r = rb[0] * s + rb[1] * z1 + rb[2] * z2 - ra[1] * (y[i - 1] || 0) - ra[2] * (y[i - 2] || 0);
    z2 = z1; z1 = s;
    y[i] = r;
  }
  return y;
}
// block powers (400 ms, 100 ms hop) of K-weighted channel sum
function blockPowers(chans, a = 0, b) {
  b = b === undefined ? chans[0].length : b;
  const kw = chans.map((c) => kWeight(c.subarray ? c.subarray(a, b) : c.slice(a, b)));
  const n = b - a;
  const blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  // prefix sums of squares
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { let s = 0; for (const k of kw) s += k[i] * k[i]; pre[i + 1] = pre[i] + s; }
  const out = [];
  for (let s = 0; s + blk <= n; s += hop) out.push((pre[s + blk] - pre[s]) / blk);
  if (out.length === 0 && n > 0) out.push(pre[n] / n);
  return out;
}
const toLU = (p) => -0.691 + 10 * Math.log10(p + 1e-20);
function integrated(chans, a, b) {
  const bp = blockPowers(chans, a, b);
  const abs = bp.filter((p) => toLU(p) > -70);
  if (!abs.length) return -Infinity;
  const mean1 = abs.reduce((s, p) => s + p, 0) / abs.length;
  const rel = toLU(mean1) - 10;
  const g = abs.filter((p) => toLU(p) > rel);
  if (!g.length) return -Infinity;
  return toLU(g.reduce((s, p) => s + p, 0) / g.length);
}
function momentaryMax(chans, a, b) {
  const bp = blockPowers(chans, a, b);
  let m = -Infinity; for (const p of bp) m = Math.max(m, toLU(p));
  return m;
}
// 4x oversampled true peak using windowed-sinc polyphase interpolation
let TP_KERNEL = null;
function tpKernel() {
  if (TP_KERNEL) return TP_KERNEL;
  const taps = 12; // zero crossings each side
  const ph = [];
  for (let p = 1; p < 4; p++) {
    const frac = p / 4; const k = new Float64Array(2 * taps);
    for (let j = -taps + 1; j <= taps; j++) {
      const x = j - frac; // distance from sample (i + j) to point (i + frac)
      const s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.42 + 0.5 * Math.cos(Math.PI * x / (taps + 1)) + 0.08 * Math.cos(2 * Math.PI * x / (taps + 1));
      k[j + taps - 1] = s * w;
    }
    ph.push(k);
  }
  TP_KERNEL = { taps, ph };
  return TP_KERNEL;
}
function truePeak(chans) {
  const { taps, ph } = tpKernel();
  let peak = 0;
  for (const x of chans) {
    const n = x.length;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(x[i]); if (a > peak) peak = a;
      if (a < peak * 0.5 && i > 0) continue; // cheap skip: inter-sample overs only near large samples
      for (const k of ph) {
        let s = 0;
        for (let j = -taps + 1; j <= taps; j++) { const idx = i + j; if (idx >= 0 && idx < n) s += x[idx] * k[j + taps - 1]; }
        const as = Math.abs(s); if (as > peak) peak = as;
      }
    }
  }
  return 20 * Math.log10(peak + 1e-12);
}
function samplePeakDb(chans) { let p = 0; for (const c of chans) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > p) p = a; } return 20 * Math.log10(p + 1e-12); }

module.exports = { kWeight, integrated, momentaryMax, truePeak, samplePeakDb };
