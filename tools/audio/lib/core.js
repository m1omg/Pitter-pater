'use strict';
// Core DSP primitives for the PITTER-PATTER offline synth.
// Everything is written from scratch: RNG, WAV writer, filters, oscillators,
// envelopes, FFT and FFT convolution. Sample rate is fixed at 44.1 kHz.

const fs = require('fs');

const SR = 44100;
const TAU = Math.PI * 2;
const NYQ = SR / 2;

// ---------------------------------------------------------------- math utils
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const dbToGain = (db) => Math.pow(10, db / 20);
const gainToDb = (g) => 20 * Math.log10(Math.max(1e-12, Math.abs(g)));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const ftom = (f) => 69 + 12 * Math.log2(f / 440);
const cents = (c) => Math.pow(2, c / 1200);
const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ---------------------------------------------------------------- RNG
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // final avalanche
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
const seedOf = (...parts) => hashStr(parts.map(String).join('|'));

class RNG {
  constructor(seed = 12345) {
    this.s = (seed >>> 0) || 0x9e3779b9;
    this._spare = null;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uni(a = 0, b = 1) { return a + (b - a) * this.next(); }
  bi() { return this.next() * 2 - 1; }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  gauss(mu = 0, sigma = 1) {
    if (this._spare !== null) { const v = this._spare; this._spare = null; return mu + sigma * v; }
    let u, v, s;
    do { u = this.bi(); v = this.bi(); s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    this._spare = v * m;
    return mu + sigma * u * m;
  }
  fork(tag) { return new RNG(seedOf(this.s, tag)); }
}

// ---------------------------------------------------------------- buffers
const zeros = (n) => new Float32Array(Math.max(0, Math.ceil(n)));
function stereo(n) { return { L: zeros(n), R: zeros(n) }; }
function secs(n) { return Math.round(n * SR); }

function addInto(dst, src, offset = 0, gain = 1) {
  const o = Math.round(offset);
  let i0 = 0;
  if (o < 0) i0 = -o;
  const n = Math.min(src.length, dst.length - o);
  for (let i = i0; i < n; i++) dst[o + i] += src[i] * gain;
}
function scaleBuf(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }
function peakOf(buf) { let p = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; } return p; }
function rmsOf(buf, a = 0, b = buf.length) { let s = 0; for (let i = a; i < b; i++) s += buf[i] * buf[i]; return Math.sqrt(s / Math.max(1, b - a)); }
function reverseBuf(buf) { const o = new Float32Array(buf.length); for (let i = 0; i < buf.length; i++) o[i] = buf[buf.length - 1 - i]; return o; }
function concatBufs(list) {
  let n = 0; for (const b of list) n += b.length;
  const o = new Float32Array(n); let p = 0;
  for (const b of list) { o.set(b, p); p += b.length; }
  return o;
}
// equal-power pan gains, p in [-1,1]; center gives 0.7071 per side
function panGains(p) {
  const th = (clamp(p, -1, 1) + 1) * Math.PI / 4;
  return [Math.cos(th), Math.sin(th)];
}
function fadeIn(buf, n) { n = Math.min(n, buf.length); for (let i = 0; i < n; i++) buf[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / n); }
function fadeOut(buf, n) { n = Math.min(n, buf.length); const L = buf.length; for (let i = 0; i < n; i++) buf[L - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / n); }

// ---------------------------------------------------------------- WAV
function writeWav(path, chans, sr = SR, bits = 32) {
  const nch = chans.length, n = chans[0].length;
  const bps = bits / 8;
  const dataBytes = n * nch * bps;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(bits === 32 ? 3 : 1, 20); buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * nch * bps, 28);
  buf.writeUInt16LE(nch * bps, 32); buf.writeUInt16LE(bits, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40);
  let p = 44;
  if (bits === 32) {
    for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) { buf.writeFloatLE(chans[c][i], p); p += 4; }
  } else {
    const rng = new RNG(777);
    for (let i = 0; i < n; i++) for (let c = 0; c < nch; c++) {
      const d = (rng.next() - rng.next()) / 32768; // TPDF dither
      const v = clamp(Math.round((chans[c][i] + d) * 32767), -32768, 32767);
      buf.writeInt16LE(v, p); p += 2;
    }
  }
  fs.writeFileSync(path, buf);
}

// ---------------------------------------------------------------- filters
// RBJ biquad, transposed direct form II.
class Biquad {
  constructor(type = 'lp', f = 1000, q = 0.7071, db = 0) { this.z1 = 0; this.z2 = 0; this.set(type, f, q, db); }
  set(type, f, q = 0.7071, db = 0) {
    f = clamp(f, 5, NYQ * 0.995);
    const w = TAU * f / SR, cw = Math.cos(w), sw = Math.sin(w);
    const A = Math.pow(10, db / 40);
    const alpha = sw / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break; // 0 dB peak
      case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'ap': b0 = 1 - alpha; b1 = -2 * cw; b2 = 1 + alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'peak': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
      case 'lowshelf': {
        const sa = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cw + sa); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - sa);
        a0 = (A + 1) + (A - 1) * cw + sa; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - sa; break;
      }
      case 'highshelf': {
        const sa = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) + (A - 1) * cw + sa); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - sa);
        a0 = (A + 1) - (A - 1) * cw + sa; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - sa; break;
      }
      default: throw new Error('biquad type ' + type);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  run(buf) { for (let i = 0; i < buf.length; i++) buf[i] = this.process(buf[i]); return buf; }
  reset() { this.z1 = this.z2 = 0; return this; }
}
// apply a chain of biquad specs to a buffer in place: [['lp',8000,0.7],['peak',300,1,3]]
function eqBuf(buf, specs) {
  for (const s of specs) new Biquad(s[0], s[1], s[2] === undefined ? 0.7071 : s[2], s[3] || 0).run(buf);
  return buf;
}

class OnePole {
  constructor(fc = 1000) { this.y = 0; this.setF(fc); }
  setF(fc) { this.a = 1 - Math.exp(-TAU * clamp(fc, 1, NYQ) / SR); return this; }
  lp(x) { return (this.y += this.a * (x - this.y)); }
  hp(x) { return x - this.lp(x); }
}
function onePoleLP(buf, fc) { const f = new OnePole(fc); for (let i = 0; i < buf.length; i++) buf[i] = f.lp(buf[i]); return buf; }
function onePoleHP(buf, fc) { const f = new OnePole(fc); for (let i = 0; i < buf.length; i++) buf[i] = f.hp(buf[i]); return buf; }

// Cytomic/Simper trapezoidal SVF - stable under fast modulation.
class SVF {
  constructor(fc = 1000, q = 0.7071) { this.ic1 = 0; this.ic2 = 0; this.set(fc, q); }
  set(fc, q) {
    const g = Math.tan(Math.PI * clamp(fc, 5, NYQ * 0.98) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
    return this;
  }
  // returns lowpass; band/high available as properties
  process(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.band = v1; this.high = v0 - this.k * v1 - v2; this.low = v2;
    return v2;
  }
}

// DC blocker
class DCBlock { constructor(fc = 12) { this.R = Math.exp(-TAU * fc / SR); this.x1 = 0; this.y1 = 0; } process(x) { const y = x - this.x1 + this.R * this.y1; this.x1 = x; this.y1 = y; return y; } }

// ---------------------------------------------------------------- oscillators
const SINE_N = 8192;
const SINE_T = new Float64Array(SINE_N + 1);
for (let i = 0; i <= SINE_N; i++) SINE_T[i] = Math.sin(TAU * i / SINE_N);
// fast sine of phase in cycles (any real)
function fsin(ph) {
  ph -= Math.floor(ph);
  const x = ph * SINE_N, i = x | 0, fr = x - i;
  return SINE_T[i] + (SINE_T[i + 1] - SINE_T[i]) * fr;
}
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// freq: number or Float32Array of per-sample Hz. Returns Float32Array.
function freqAt(freq, i) { return typeof freq === 'number' ? freq : freq[i]; }
function oscSine(n, freq, ph0 = 0) {
  const o = zeros(n); let ph = ph0;
  for (let i = 0; i < n; i++) { o[i] = fsin(ph); ph += freqAt(freq, i) / SR; }
  return o;
}
function oscSaw(n, freq, ph0 = 0) {
  const o = zeros(n); let ph = ph0 - Math.floor(ph0);
  for (let i = 0; i < n; i++) {
    const dt = freqAt(freq, i) / SR;
    o[i] = 2 * ph - 1 - polyblep(ph, dt);
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return o;
}
function oscPulse(n, freq, pw = 0.5, ph0 = 0) {
  const o = zeros(n); let ph = ph0 - Math.floor(ph0);
  for (let i = 0; i < n; i++) {
    const dt = freqAt(freq, i) / SR;
    const w = typeof pw === 'number' ? pw : pw[i];
    let v = ph < w ? 1 : -1;
    v += polyblep(ph, dt);
    let t2 = ph - w; if (t2 < 0) t2 += 1;
    v -= polyblep(t2, dt);
    o[i] = v;
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return o;
}
// band-limited-ish triangle via integrated polyblep square
function oscTri(n, freq, ph0 = 0) {
  const o = zeros(n); let ph = ph0 - Math.floor(ph0);
  let y = ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph;
  for (let i = 0; i < n; i++) {
    const dt = freqAt(freq, i) / SR;
    let v = ph < 0.5 ? 1 : -1;
    v += polyblep(ph, dt);
    let t2 = ph - 0.5; if (t2 < 0) t2 += 1;
    v -= polyblep(t2, dt);
    y = y * 0.99999 + 4 * dt * v;
    o[i] = y;
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return o;
}
function noiseWhite(n, rng) { const o = zeros(n); for (let i = 0; i < n; i++) o[i] = rng.bi(); return o; }
function noisePink(n, rng) {
  const o = zeros(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bi();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return o;
}
function noiseBrown(n, rng) { const o = zeros(n); let y = 0; for (let i = 0; i < n; i++) { y = (y + 0.02 * rng.bi()) * 0.998; o[i] = y * 3.5; } return o; }

// Damped complex resonator bank: sum of exponentially decaying sinusoids.
// modes: [{f, a, t60, ph}] ; adds into out (Float32Array) starting at index 0
// relAt: sample index where decay switches to t60rel (damper), optional.
function addModes(out, modes, opts = {}) {
  const n = out.length;
  const relAt = opts.relAt === undefined ? n : Math.min(n, Math.max(0, Math.round(opts.relAt)));
  for (const m of modes) {
    if (!(m.f > 0) || m.f >= NYQ * 0.96 || !m.a) continue;
    const w = TAU * m.f / SR;
    const r1 = m.t60 > 0 ? Math.pow(10, -3 / (m.t60 * SR)) : 0;
    const r2 = m.t60rel > 0 ? Math.pow(10, -3 / (m.t60rel * SR)) : r1;
    let re = m.a * Math.cos(m.ph || 0), im = m.a * Math.sin(m.ph || 0);
    let c = Math.cos(w) * r1, s = Math.sin(w) * r1;
    const thr = Math.abs(m.a) * 1e-5;
    let end1 = relAt;
    // estimate samples until inaudible to save time
    if (r1 < 1 && r1 > 0) { const nd = Math.ceil(Math.log(1e-5) / Math.log(r1)); end1 = Math.min(end1, nd); }
    let i = 0;
    for (; i < end1; i++) { out[i] += im; const nr = re * c - im * s; im = re * s + im * c; re = nr; }
    if (i < relAt) continue; // died before release
    c = Math.cos(w) * r2; s = Math.sin(w) * r2;
    let end2 = n;
    if (r2 < 1 && r2 > 0) { const amp = Math.hypot(re, im); if (amp < thr) continue; const nd = Math.ceil(Math.log(thr / amp) / Math.log(r2)); end2 = Math.min(n, i + nd); }
    for (; i < end2; i++) { out[i] += im; const nr = re * c - im * s; im = re * s + im * c; re = nr; }
  }
  return out;
}

// ---------------------------------------------------------------- envelopes
// ADSR, times in seconds, noteLen = gate length in seconds; returns Float32Array (length n)
function adsr(n, a, d, s, r, noteLen, opts = {}) {
  const e = zeros(n);
  const na = Math.max(1, Math.round(a * SR));
  const gate = Math.round(noteLen * SR);
  const dk = d > 0 ? Math.exp(-1 / (d * SR / 4.6)) : 0; // reach ~1% in d
  const rk = r > 0 ? Math.exp(-1 / (r * SR / 4.6)) : 0;
  const curve = opts.curve || 'lin';
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (i < gate) {
      if (i < na) {
        const t = i / na;
        v = curve === 'exp' ? 1 - Math.pow(1 - t, 3) : curve === 'sine' ? Math.sin(t * Math.PI / 2) : t;
      } else {
        v = s + (v - s) * dk;
      }
    } else {
      v *= rk;
    }
    e[i] = v;
  }
  return e;
}
// Breakpoint envelope: pts=[[t,v],...] seconds; holds first/last values
function bpEnv(n, pts, shape = 'lin') {
  const e = zeros(n);
  let k = 0;
  const last = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (t <= pts[0][0]) { e[i] = pts[0][1]; continue; }
    while (k < last && t > pts[k + 1][0]) k++;
    if (k >= last) { e[i] = pts[last][1]; continue; }
    const t0 = pts[k][0], v0 = pts[k][1], t1 = pts[k + 1][0], v1 = pts[k + 1][1];
    let x = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
    if (shape === 'cos') x = 0.5 - 0.5 * Math.cos(Math.PI * x);
    if (shape === 'exp' && v0 > 1e-6 && v1 > 1e-6) e[i] = v0 * Math.pow(v1 / v0, x);
    else e[i] = v0 + (v1 - v0) * x;
  }
  return e;
}
function expDecayEnv(n, t60, attack = 0.002) {
  const e = zeros(n); const r = Math.pow(10, -3 / (t60 * SR)); const na = Math.max(1, Math.round(attack * SR));
  let v = 1;
  for (let i = 0; i < n; i++) { e[i] = v * (i < na ? i / na : 1); v *= r; }
  return e;
}

// ---------------------------------------------------------------- FFT
class FFT {
  constructor(n) {
    if (n & (n - 1)) throw new Error('FFT size must be pow2');
    this.n = n;
    this.cos = new Float64Array(n / 2); this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { this.cos[i] = Math.cos(TAU * i / n); this.sin[i] = -Math.sin(TAU * i / n); }
    this.rev = new Uint32Array(n);
    let bits = 0; while ((1 << bits) < n) bits++;
    for (let i = 0; i < n; i++) { let r = 0, x = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; } this.rev[i] = r; }
  }
  // in-place forward transform (sign -1)
  forward(re, im) { this._t(re, im, false); }
  inverse(re, im) { this._t(re, im, true); const n = this.n; for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; } }
  _t(re, im, inv) {
    const n = this.n, rev = this.rev;
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    const cs = this.cos, sn = this.sin;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cs[k], wi = inv ? -sn[k] : sn[k];
          const a = i + j, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }
}
const nextPow2 = (x) => { let n = 1; while (n < x) n <<= 1; return n; };

// Stereo FFT convolution using the two-real-signals-in-one-complex trick.
// out lengths = inLen + irLen - 1 (or outLen if given)
function convolveStereo(inL, inR, irL, irR, outLen) {
  const M = Math.max(irL.length, irR.length);
  const N = nextPow2(M) * 2;
  const B = N - M + 1;
  const fft = new FFT(N);
  const len = outLen || (inL.length + M - 1);
  const outL = zeros(len), outR = zeros(len);
  // IR spectra
  const hr = new Float64Array(N), hi = new Float64Array(N);
  for (let i = 0; i < irL.length; i++) hr[i] = irL[i];
  for (let i = 0; i < irR.length; i++) hi[i] = irR[i];
  fft.forward(hr, hi);
  const HLr = new Float64Array(N), HLi = new Float64Array(N), HRr = new Float64Array(N), HRi = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const k2 = (N - k) & (N - 1);
    const zr = hr[k], zi = hi[k], cr = hr[k2], ci = -hi[k2];
    HLr[k] = (zr + cr) / 2; HLi[k] = (zi + ci) / 2;
    // (Z - conj)/(2i) : (a+ib)/(2i) = (b - ia)/2
    const dr = zr - cr, di = zi - ci;
    HRr[k] = di / 2; HRi[k] = -dr / 2;
  }
  const re = new Float64Array(N), im = new Float64Array(N);
  const inLen = inL.length;
  for (let start = 0; start < inLen; start += B) {
    re.fill(0); im.fill(0);
    const nb = Math.min(B, inLen - start);
    let any = false;
    for (let i = 0; i < nb; i++) { const a = inL[start + i], b = inR[start + i]; re[i] = a; im[i] = b; if (a !== 0 || b !== 0) any = true; }
    if (!any) continue;
    fft.forward(re, im);
    for (let k = 0; k <= N / 2; k++) {
      const k2 = (N - k) & (N - 1);
      const zr = re[k], zi = im[k], cr = re[k2], ci = -im[k2];
      const xr = (zr + cr) / 2, xi = (zi + ci) / 2; // X_L
      const dr = zr - cr, di = zi - ci; const yr = di / 2, yi = -dr / 2; // X_R
      // W = X_L*H_L + i * X_R*H_R
      const ar = xr * HLr[k] - xi * HLi[k], ai = xr * HLi[k] + xi * HLr[k];
      const br = yr * HRr[k] - yi * HRi[k], bi = yr * HRi[k] + yi * HRr[k];
      const wr = ar - bi, wi = ai + br;
      // bin k2: X_L[k2]=conj(X_L[k]), etc.
      const ar2 = xr * HLr[k2] + xi * HLi[k2], ai2 = xr * HLi[k2] - xi * HLr[k2];
      const br2 = yr * HRr[k2] + yi * HRi[k2], bi2 = yr * HRi[k2] - yi * HRr[k2];
      re[k] = wr; im[k] = wi;
      if (k2 !== k) { re[k2] = ar2 - bi2; im[k2] = ai2 + br2; }
    }
    fft.inverse(re, im);
    const lim = Math.min(N, len - start);
    for (let i = 0; i < lim; i++) { outL[start + i] += re[i]; outR[start + i] += im[i]; }
  }
  return { L: outL, R: outR };
}
function convolveMono(inp, ir, outLen) {
  const r = convolveStereo(inp, inp, ir, ir, outLen);
  return r.L;
}

// magnitude spectrum helper for analysis (Hann window), returns {mag, binHz}
function spectrum(buf, start = 0, n = 16384) {
  const N = nextPow2(n);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N && start + i < buf.length; i++) re[i] = buf[start + i] * (0.5 - 0.5 * Math.cos(TAU * i / N));
  new FFT(N).forward(re, im);
  const mag = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return { mag, binHz: SR / N };
}

module.exports = {
  SR, TAU, NYQ, clamp, lerp, dbToGain, gainToDb, mtof, ftom, cents, smoothstep,
  hashStr, seedOf, RNG,
  zeros, stereo, secs, addInto, scaleBuf, peakOf, rmsOf, reverseBuf, concatBufs, panGains, fadeIn, fadeOut,
  writeWav,
  Biquad, eqBuf, OnePole, onePoleLP, onePoleHP, SVF, DCBlock,
  fsin, polyblep, oscSine, oscSaw, oscPulse, oscTri, noiseWhite, noisePink, noiseBrown, addModes,
  adsr, bpEnv, expDecayEnv,
  FFT, nextPow2, convolveStereo, convolveMono, spectrum,
};
