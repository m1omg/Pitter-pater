'use strict';
// Shared helpers for SFX design. (Files starting with "_" are ignored by the item registry.)
// All generators return Float32Array (mono) or {L, R} (stereo); lengths are in seconds.
const C = require('../lib/core');
const FX = require('../lib/fx');
const I = require('../lib/inst');
const D = require('../lib/drums');
const { SR, TAU, clamp, RNG, Biquad, SVF } = C;

const N = (sec) => Math.max(1, Math.round(sec * SR));
// lengths: integers >= 64 are sample counts, anything else is seconds
const toN = (len) => (Number.isInteger(len) && len >= 64 ? len : N(len));
const Z = (sec) => new Float32Array(toN(sec));
const at = (v, i) => (typeof v === 'number' ? v : v[Math.min(i, v.length - 1)]);

// ---------------------------------------------------------------- control curves
// piecewise curve through [[t, v], ...]; shape 'lin' | 'cos' | 'exp' (geometric, for frequencies)
function curve(len, pts, shape = 'lin') {
  const n = toN(len);
  const out = new Float32Array(n);
  const last = pts.length - 1;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (t <= pts[0][0]) { out[i] = pts[0][1]; continue; }
    while (k < last && t > pts[k + 1][0]) k++;
    if (k >= last) { out[i] = pts[last][1]; continue; }
    const t0 = pts[k][0], v0 = pts[k][1], t1 = pts[k + 1][0], v1 = pts[k + 1][1];
    let x = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
    if (shape === 'cos') x = 0.5 - 0.5 * Math.cos(Math.PI * x);
    out[i] = shape === 'exp' && v0 > 0 && v1 > 0 ? v0 * Math.pow(v1 / v0, x) : v0 + (v1 - v0) * x;
  }
  return out;
}
const fcurve = (len, pts) => curve(len, pts, 'exp');
const ecurve = (len, pts) => curve(len, pts, 'cos');
// attack (raised cosine, a s) + optional hold + exponential decay reaching -60 dB after t60 s
function ad(len, a, t60, hold = 0) {
  const n = toN(len);
  const e = new Float32Array(n);
  const na = Math.max(1, Math.round(a * SR)), nh = Math.round(hold * SR);
  const k = Math.pow(10, -3 / (Math.max(1e-4, t60) * SR));
  let v = 1;
  for (let i = 0; i < n; i++) {
    if (i < na) e[i] = 0.5 - 0.5 * Math.cos(Math.PI * i / na);
    else if (i < na + nh) e[i] = 1;
    else { v *= k; e[i] = v; }
  }
  return e;
}
// smooth gate: raised-cosine attack a, flat until `dur`-r, raised-cosine release r
function gate(len, a, r, dur) {
  const n = N(len); const e = new Float32Array(n);
  const na = Math.max(1, N(a)), nr = Math.max(1, N(r)), nd = Math.min(n, N(dur));
  for (let i = 0; i < n; i++) {
    let v = 1;
    if (i < na) v = 0.5 - 0.5 * Math.cos(Math.PI * i / na);
    if (i >= nd - nr) v *= i >= nd ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (i - (nd - nr)) / nr);
    e[i] = v;
  }
  return e;
}

// ---------------------------------------------------------------- oscillators
function osc(type, len, freq, o = {}) {
  const n = toN(len);
  switch (type) {
    case 'sine': return C.oscSine(n, freq, o.ph || 0);
    case 'tri': return C.oscTri(n, freq, o.ph || 0);
    case 'saw': return C.oscSaw(n, freq, o.ph || 0);
    case 'square': return C.oscPulse(n, freq, 0.5, o.ph || 0);
    case 'pulse': return C.oscPulse(n, freq, o.pw === undefined ? 0.25 : o.pw, o.ph || 0);
    default: throw new Error('osc ' + type);
  }
}
// sine with harmonics [[k, amp], ...] following a frequency curve (band-limited by construction)
function harm(len, freq, hs, ph0 = 0) {
  const n = toN(len);
  const out = new Float32Array(n); let ph = ph0;
  for (let i = 0; i < n; i++) {
    const f = at(freq, i);
    let v = 0;
    for (const [k, a] of hs) if (f * k < 20000) v += a * C.fsin(ph * k);
    out[i] = v;
    ph += f / SR;
  }
  return out;
}
// 2-operator FM: carrier freq curve, modulator ratio, index (number|curve)
function fm(len, fc, ratio, index, o = {}) {
  const n = toN(len);
  const out = new Float32Array(n); let pc = o.ph || 0, pm = 0;
  for (let i = 0; i < n; i++) {
    const f = at(fc, i);
    out[i] = Math.sin(TAU * pc + at(index, i) * Math.sin(TAU * pm));
    pc += f / SR; pm += f * ratio / SR;
    if (pc > 1) pc -= 1; if (pm > 1) pm -= 1;
  }
  return out;
}
function noise(len, seed = 1, color = 'white') {
  const n = toN(len);
  const r = new RNG(seed);
  if (color === 'pink') return C.noisePink(n, r);
  if (color === 'brown') return C.noiseBrown(n, r);
  return C.noiseWhite(n, r);
}
// sparse random impulses ("crackle"), density per second, returns buffer
function crackle(len, density, seed = 3, amp = 1) {
  const n = N(len); const out = new Float32Array(n); const r = new RNG(seed);
  const cnt = Math.round(density * len);
  for (let k = 0; k < cnt; k++) { const p = Math.floor(r.next() * n); out[p] += amp * r.bi() * Math.pow(r.next(), 1.5); }
  return out;
}

// ---------------------------------------------------------------- filters
const bq = (type) => (buf, f, q = 0.7071, db = 0) => new Biquad(type, f, q, db).run(buf);
const lp = bq('lp'), hp = bq('hp'), bp = bq('bp'), pk = bq('peak'), notch = bq('notch');
const lowshelf = bq('lowshelf'), highshelf = bq('highshelf');
function lp4(buf, f) { lp(buf, f); return lp(buf, f); }
function hp4(buf, f) { hp(buf, f); return hp(buf, f); }
// time-varying state variable filter; fc & q numbers or curves; mode low|band|high|bandn (0 dB peak band)
function svf(buf, fc, q = 0.7071, mode = 'bandn') {
  const f = new SVF(1000, 0.7071); const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    if ((i & 7) === 0) f.set(at(fc, i), at(q, i));
    f.process(buf[i]);
    out[i] = mode === 'low' ? f.low : mode === 'high' ? f.high : mode === 'band' ? f.band : f.band * f.k;
  }
  return out;
}
// formant bank: tracks [{f: num|curve, bw: num, g: num|curve}]; source mono -> mono
function formants(src, tracks) {
  const out = new Float32Array(src.length);
  for (const tr of tracks) {
    const f = new SVF(500, 4);
    for (let i = 0; i < src.length; i++) {
      if ((i & 7) === 0) { const fc = at(tr.f, i); f.set(fc, Math.max(0.5, fc / tr.bw)); }
      f.process(src[i]);
      out[i] += f.band * f.k * at(tr.g, i);
    }
  }
  return out;
}
// resonator bank excited by an input (sum of 2-pole resonators) - for creaks, bells, bodies
function resonate(src, modes) {
  const out = new Float32Array(src.length);
  for (const [f, q, g] of modes) {
    const b = new Biquad('bp', f, q);
    for (let i = 0; i < src.length; i++) out[i] += b.process(src[i]) * g;
  }
  return out;
}

// ---------------------------------------------------------------- buffer ops
function mul(buf, e) { for (let i = 0; i < buf.length; i++) buf[i] *= at(e, i); return buf; }
function gain(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }
function addAt(dst, src, t = 0, g = 1) { C.addInto(dst, src, Math.round(t * SR), g); return dst; }
function sat(buf, drive = 2, asym = 0) { return FX.saturate(buf, drive, 1, asym); }
function ramp(buf, a = 0.002, r = 0.01) {
  const na = Math.min(buf.length, N(a)), nr = Math.min(buf.length, N(r));
  for (let i = 0; i < na; i++) buf[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / na);
  for (let i = 0; i < nr; i++) buf[buf.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / nr);
  return buf;
}
const isSt = (x) => x && x.L !== undefined;
function st(x) { return isSt(x) ? x : { L: x, R: Float32Array.from(x) }; }
// equal-power pan normalised so that centre == unity; mono -> positioned, stereo -> balance. p may be a curve
function pan(x, p = 0) {
  const mono = !isSt(x); const s = st(x); const n = s.L.length;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const th = (clamp(at(p, i), -1, 1) + 1) * Math.PI / 4;
    const gl = Math.cos(th) * Math.SQRT2, gr = Math.sin(th) * Math.SQRT2;
    if (mono) { L[i] = s.L[i] * gl; R[i] = s.L[i] * gr; }
    else { L[i] = s.L[i] * Math.min(1, gl); R[i] = s.R[i] * Math.min(1, gr); }
  }
  return { L, R };
}
// mix layers into a stereo buffer: layers = [[sig, tSec, gain, pan], ...]
function mixSt(len, layers) {
  const n = N(len); const L = new Float32Array(n), R = new Float32Array(n);
  for (const [sig, t = 0, g = 1, p] of layers) {
    const s = p === undefined ? st(sig) : pan(sig, p);
    C.addInto(L, s.L, Math.round(t * SR), g); C.addInto(R, s.R, Math.round(t * SR), g);
  }
  return { L, R };
}
function mix(len, layers) {
  const n = N(len); const out = new Float32Array(n);
  for (const [sig, t = 0, g = 1] of layers) C.addInto(out, isSt(sig) ? sig.L : sig, Math.round(t * SR), g);
  return out;
}
// convolution reverb with dry/wet; pads tail
function verb(x, o = {}) {
  const s = st(x);
  const t60 = o.t60 || 1.0;
  const tail = o.tail === undefined ? Math.min(4, t60 * 1.2 + 0.1) : o.tail;
  const n = s.L.length + N(tail);
  const L = new Float32Array(n), R = new Float32Array(n); L.set(s.L); R.set(s.R);
  const w = FX.reverb(L, R, { t60, predelay: o.predelay === undefined ? 0.012 : o.predelay, hp: o.hp || 220, lp: o.lp || 8000, er: o.er === undefined ? 0.3 : o.er, erTime: o.erTime || 0.05, seed: o.seed || 17, width: o.width || 1 }, n);
  const wet = o.wet === undefined ? 0.2 : o.wet, dry = o.dry === undefined ? 1 : o.dry;
  for (let i = 0; i < n; i++) { L[i] = L[i] * dry + w.L[i] * wet; R[i] = R[i] * dry + w.R[i] * wet; }
  return { L, R };
}

// ---------------------------------------------------------------- tonal building blocks
// struck bell / bar tone from [ratio, amp, t60mul] partials (starts at zero phase: click-free)
function bell(len, f, parts, t60, o = {}) {
  const n = toN(len);
  const out = new Float32Array(n);
  C.addModes(out, parts.filter(([r]) => f * r < 19000).map(([r, a, tm]) => ({ f: f * r, a, t60: Math.max(0.005, t60 * (tm === undefined ? 1 : tm)), ph: 0 })));
  if (o.click) { const ck = noise(0.004, o.seed || 5); bp(ck, o.clickF || 4000, 1); mul(ck, ad(ck.length, 0.0002, 0.003)); addAt(out, ck, 0, o.click); }
  if (o.attack !== 0) ramp(out, o.attack || 0.0006, 0.004);
  return out;
}
const BELL_GLOCK = [[1, 1, 1], [2.756, 0.35, 0.35], [5.404, 0.12, 0.15], [8.933, 0.05, 0.08]];
const BELL_CELESTA = [[1, 1, 1], [2.0, 0.06, 0.4], [3.0, 0.08, 0.2], [4.07, 0.1, 0.12]];
const BELL_HAND = [[1, 1, 1], [2.32, 0.38, 0.5], [3.01, 0.32, 0.42], [4.16, 0.18, 0.3], [5.43, 0.1, 0.24], [6.79, 0.05, 0.18]];
const BELL_TING = [[1, 1, 1], [1.51, 0.5, 0.7], [2.23, 0.4, 0.5], [2.94, 0.25, 0.35], [4.1, 0.12, 0.2]];
const mtof = C.mtof;
// short hollow/wooden knock via modes [[f, amp, t60], ...] plus transient
function knock(len, modes, o = {}) {
  const n = N(len); const out = new Float32Array(n);
  C.addModes(out, modes.map(([f, a, t]) => ({ f, a, t60: t, ph: 0 })));
  const tl = o.tLen || 0.006; const tr = noise(tl + 0.002, o.seed || 9);
  lp(tr, o.tLP || 3000); mul(tr, ad(tr.length, 0.0003, tl));
  addAt(out, tr, 0, o.trans === undefined ? 0.5 : o.trans);
  ramp(out, o.attack || 0.0008, 0.005);
  return out;
}
// pitch-dropping sine thump
function thump(len, f0, f1, pdec, t60, o = {}) {
  const n = N(len);
  const fr = new Float32Array(n);
  for (let i = 0; i < n; i++) fr[i] = f1 + (f0 - f1) * Math.exp(-i / SR / pdec);
  const s = C.oscSine(n, fr);
  mul(s, ad(n, o.a || 0.001, t60));
  return s;
}
// filtered-noise whoosh: band centre follows fcPts (exp), envelope envPts (cos), q
function whoosh(len, fcPts, envPts, q = 1.2, seed = 21, color = 'pink') {
  const n = N(len);
  const src = noise(n, seed, color);
  const out = svf(src, fcurve(n, fcPts), q, 'bandn');
  mul(out, ecurve(n, envPts));
  return out;
}
// render an instrument note list: [[t, midi, dur, vel, pan?, p?], ...] -> stereo
function play(inst, notes, len) {
  const n = N(len); const L = new Float32Array(n), R = new Float32Array(n);
  notes.forEach(([t, m, dur, vel, p = 0, extra], k) => {
    const r = inst.render({ m, dur, vel, seed: 7001 + k * 131, p: extra });
    const s = pan(r, p);
    C.addInto(L, s.L, Math.round(t * SR)); C.addInto(R, s.R, Math.round(t * SR));
  });
  return { L, R };
}
// sparkle: tiny high sine pings scattered between t0..t1
function sparkle(len, t0, t1, count, seed = 41, fLo = 3500, fHi = 9000, amp = 0.3) {
  const n = N(len); const L = new Float32Array(n), R = new Float32Array(n);
  const r = new RNG(seed);
  for (let k = 0; k < count; k++) {
    const t = t0 + (t1 - t0) * Math.pow(r.next(), 0.8);
    const f = fLo * Math.pow(fHi / fLo, r.next());
    const b = bell(0.25, f, [[1, 1, 1], [2.1, 0.2, 0.4]], r.uni(0.05, 0.18));
    const a = amp * r.uni(0.3, 1) * (1 - 0.5 * (t - t0) / Math.max(1e-3, t1 - t0));
    const s = pan(b, r.uni(-0.8, 0.8));
    C.addInto(L, s.L, Math.round(t * SR), a); C.addInto(R, s.R, Math.round(t * SR), a);
  }
  return { L, R };
}

module.exports = {
  C, FX, I, D, SR, TAU, RNG, N, toN, Z, at, curve, fcurve, ecurve, ad, gate, osc, harm, fm, noise, crackle,
  lp, hp, bp, pk, notch, lowshelf, highshelf, lp4, hp4, svf, formants, resonate,
  mul, gain, addAt, sat, ramp, st, pan, mixSt, mix, verb,
  bell, BELL_GLOCK, BELL_CELESTA, BELL_HAND, BELL_TING, mtof, knock, thump, whoosh, play, sparkle,
};
