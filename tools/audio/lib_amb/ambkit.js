'use strict';
// Ambience toolkit: everything here produces EXACTLY PERIODIC buffers of n samples, so a bed can be
// tiled end-to-start without a seam:
//  - noise is a cyclic buffer; every IIR filter runs two laps around it (the 2nd lap is the steady state)
//  - modulators have an integer number of cycles per loop (or are circularly smoothed noise)
//  - discrete events are added with wrap-around; reverb is a circular convolution (tail folded to start)
const C = require('../lib/core');
const FX = require('../lib/fx');
const { SR, TAU, zeros, RNG, Biquad } = C;

// ---------------------------------------------------------------- periodic processing primitives
// run a stateful step(i) for two laps; return the second lap
function circ(n, makeStep) {
  const step = makeStep();
  for (let i = 0; i < n; i++) step(i);
  const out = zeros(n);
  for (let i = 0; i < n; i++) out[i] = step(i);
  return out;
}
const white = (n, rng) => C.noiseWhite(n, rng);
function pink(n, rng) {
  const w = white(n, rng);
  return circ(n, () => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    return (i) => {
      const x = w[i];
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      const y = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
      return y;
    };
  });
}
// "brown" noise = white through a one-pole lowpass at fc (6 dB/oct above fc)
function brown(n, rng, fc = 40) {
  const w = white(n, rng);
  const a = 1 - Math.exp(-TAU * fc / SR);
  const g = Math.sqrt(2 / a); // roughly unit-ish level
  return circ(n, () => { let y = 0; return (i) => (y += a * (w[i] - y)) * g; });
}
// circular biquad chain: specs [['hp',300,0.7],['peak',2000,0.8,3],...]
function chain(buf, specs) {
  const fs = specs.map((s) => new Biquad(s[0], s[1], s[2] === undefined ? 0.7071 : s[2], s[3] || 0));
  const k = fs.length;
  return circ(buf.length, () => (i) => { let v = buf[i]; for (let j = 0; j < k; j++) v = fs[j].process(v); return v; });
}
// circular modulated state-variable filter (Simper). fc: Float32Array (periodic) or number. mode lp|bp|hp
function svf(buf, fc, q, mode = 'lp') {
  const n = buf.length;
  const kq = 1 / q;
  return circ(n, () => {
    let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
    const setF = (f) => { const g = Math.tan(Math.PI * Math.min(Math.max(f, 10), SR * 0.45) / SR); a1 = 1 / (1 + g * (g + kq)); a2 = g * a1; a3 = g * a2; };
    if (typeof fc === 'number') setF(fc);
    return (i) => {
      if (typeof fc !== 'number' && (i & 7) === 0) setF(fc[i]);
      const v0 = buf[i];
      const v3 = v0 - ic2;
      const v1 = a1 * ic1 + a2 * v3;
      const v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
      return mode === 'lp' ? v2 : mode === 'bp' ? v1 : v0 - kq * v1 - v2;
    };
  });
}
// smooth periodic random signal with ~unit standard deviation (noise through 2 circular one-poles)
function smooth(n, rng, fc) {
  const w = white(n, rng);
  const a = 1 - Math.exp(-TAU * fc / SR);
  const o = circ(n, () => { let y1 = 0, y2 = 0; return (i) => { y1 += a * (w[i] - y1); y2 += a * (y1 - y2); return y2; }; });
  let s = 0; for (let i = 0; i < n; i++) s += o[i] * o[i];
  const sd = Math.sqrt(s / n) || 1;
  for (let i = 0; i < n; i++) o[i] /= sd;
  return o;
}
// periodic LFO with integer cycles per loop, normalised to max |v| = 1
function lfo(n, rng, minCyc = 1, maxCyc = 5, terms = 3) {
  const o = FX.periodicLFO(n, rng, minCyc, maxCyc, terms);
  let m = 1e-9; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(o[i]));
  for (let i = 0; i < n; i++) o[i] /= m;
  return o;
}
// frequency snapped so that it completes an integer number of cycles in n samples
const snapHz = (f, n) => Math.max(1, Math.round(f * n / SR)) * SR / n;

function rms(buf) { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / Math.max(1, buf.length)); }
function normRms(st, target = 0.05) {
  const r = Math.sqrt((rms(st.L) ** 2 + rms(st.R) ** 2) / 2) || 1;
  C.scaleBuf(st.L, target / r); C.scaleBuf(st.R, target / r);
  return st;
}
function normPeak(st, target = 0.25) {
  const p = Math.max(C.peakOf(st.L), C.peakOf(st.R)) || 1;
  C.scaleBuf(st.L, target / p); C.scaleBuf(st.R, target / p);
  return st;
}
function mulEnv(buf, env, depthDb = null) {
  for (let i = 0; i < buf.length; i++) buf[i] *= depthDb === null ? env[i] : Math.pow(10, depthDb * env[i] / 20);
  return buf;
}
// wrapped, panned add of a mono Float32Array or stereo {L,R} event
function place(L, R, src, pos, pan = 0, gain = 1) {
  if (src.L) { FX.addWrapped(L, src.L, pos, gain); FX.addWrapped(R, src.R, pos, gain); return; }
  const [gl, gr] = C.panGains(pan);
  FX.addWrapped(L, src, pos, gain * gl * Math.SQRT2); FX.addWrapped(R, src, pos, gain * gr * Math.SQRT2);
}
// circular stereo convolution reverb (IR from FX.makeIR), in place: out = dry*x + wet*rev(x)
function circReverb(L, R, irOpts, wet = 0.3, dry = 1) {
  const n = L.length;
  const ir = FX.makeIR(irOpts);
  const cross = irOpts.cross === undefined ? 0.3 : irOpts.cross;
  const a = zeros(n), b = zeros(n);
  for (let i = 0; i < n; i++) { a[i] = L[i] * (1 - cross) + R[i] * cross; b[i] = R[i] * (1 - cross) + L[i] * cross; }
  const y = C.convolveStereo(a, b, ir.L, ir.R);
  const oL = zeros(n), oR = zeros(n);
  for (let i = 0; i < y.L.length; i++) { const k = i % n; oL[k] += y.L[i]; oR[k] += y.R[i]; }
  for (let i = 0; i < n; i++) { L[i] = L[i] * dry + oL[i] * wet; R[i] = R[i] * dry + oR[i] * wet; }
}
function stereoOf(fn) { return { L: fn(0), R: fn(1) }; }
// gentle soft-clip of rare peaks: values above ~t are compressed smoothly (in place)
function softClip(st, t) { for (const B of [st.L, st.R]) for (let i = 0; i < B.length; i++) B[i] = t * Math.tanh(B[i] / t); return st; }

// ---------------------------------------------------------------- event generators (short buffers)
// glassy tick of a raindrop hitting a window
function tick(rng, o = {}) {
  const f = o.f || rng.uni(2200, 6000), q = o.q || rng.uni(1.5, 5), dec = o.dec || rng.uni(0.002, 0.007);
  const len = Math.round((dec * 7 + 0.006) * SR);
  const b = zeros(len);
  const ex = Math.max(2, Math.round(rng.uni(0.00015, 0.0007) * SR));
  for (let i = 0; i < ex; i++) b[i] = rng.bi() * (1 - i / ex);
  const bp = new Biquad('bp', f, q);
  for (let i = 0; i < len; i++) b[i] = bp.process(b[i]);
  // short tonal ring of the glass / water skin
  const tf = f * rng.uni(0.45, 0.8), tone = o.tone === undefined ? rng.uni(0.1, 0.45) : o.tone;
  let ph = rng.next();
  for (let i = 0; i < len; i++) { const t = i / SR; b[i] += tone * Math.sin(TAU * ph) * Math.exp(-t / dec) * Math.min(1, i / 8); ph += tf / SR; }
  const p = C.peakOf(b) || 1;
  C.scaleBuf(b, 1 / p);
  return b;
}
// bubbly water "plink" with the characteristic upward chirp
function plink(rng, o = {}) {
  const f0 = o.f || rng.uni(700, 1700), dec = o.dec || rng.uni(0.02, 0.06), chirp = o.chirp === undefined ? rng.uni(0.15, 0.45) : o.chirp;
  const len = Math.round((dec * 6 + 0.01) * SR);
  const b = zeros(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = f0 * (1 + chirp * (1 - Math.exp(-t / 0.018)));
    b[i] = Math.sin(TAU * ph) * Math.exp(-t / dec) * Math.min(1, i / 30);
    ph += f / SR;
  }
  // tiny impact at the start
  for (let i = 0; i < 40 && i < len; i++) b[i] += rng.bi() * 0.25 * (1 - i / 40);
  return b;
}
// short noisy splat (big drop on a sill / puddle)
function splat(rng, o = {}) {
  const dur = o.dur || rng.uni(0.008, 0.028), fc = o.fc || rng.uni(900, 2600);
  const len = Math.round((dur * 3 + 0.005) * SR);
  const b = zeros(len);
  for (let i = 0; i < len; i++) { const t = i / SR; b[i] = rng.bi() * (t < 0.001 ? t / 0.001 : Math.exp(-(t - 0.001) / (dur / 2.5))); }
  new Biquad('bp', fc, 0.9).run(b); new Biquad('lp', fc * 2.2, 0.7).run(b);
  const p = C.peakOf(b) || 1; C.scaleBuf(b, 1 / p);
  return b;
}
// distant rolling thunder, stereo, dur seconds
function thunder(rng, dur, o = {}) {
  const n = Math.round(dur * SR);
  const lpf = o.lpf || 320;
  const envL = zeros(n), envR = zeros(n);
  const K = o.bursts || rng.int(10, 18);
  for (let k = 0; k < K; k++) {
    const tk = dur * 0.78 * Math.pow(rng.next(), 1.7) + (k === 0 ? 0 : 0.15);
    const ak = (k === 0 ? 1 : 0.35 + 0.65 * Math.pow(rng.next(), 1.3)) * Math.exp(-tk / (dur * 0.38));
    const att = rng.uni(0.06, 0.3), dec = rng.uni(0.35, 1.4);
    const pan = rng.uni(-0.6, 0.6);
    const s = Math.round(tk * SR);
    for (let i = s; i < n; i++) {
      const t = (i - s) / SR;
      const e = t < att ? Math.sin(0.5 * Math.PI * t / att) ** 2 : Math.exp(-(t - att) / dec);
      if (e < 1e-4 && t > att) break;
      envL[i] += ak * e * (1 - 0.4 * pan); envR[i] += ak * e * (1 + 0.4 * pan);
    }
  }
  // slow global onset (distant thunder never starts with a crack)
  const on = Math.round(0.25 * SR);
  for (let i = 0; i < on; i++) { const g = Math.sin(0.5 * Math.PI * i / on) ** 2; envL[i] *= g; envR[i] *= g; }
  const src = (ch) => {
    const w = zeros(n); for (let i = 0; i < n; i++) w[i] = rng.gauss() * 0.5;
    const lo = Float32Array.from(w);
    new Biquad('lp', lpf, 0.7).run(lo); new Biquad('lp', lpf * 1.15, 0.7).run(lo); new Biquad('hp', 28, 0.7).run(lo);
    const sub = Float32Array.from(w); new Biquad('lp', 70, 0.7).run(sub); new Biquad('lp', 70, 0.7).run(sub);
    const mid = Float32Array.from(w); new Biquad('bp', lpf * 3.2, 0.8).run(mid);
    const env = ch ? envR : envL;
    const out = zeros(n);
    const sg = o.sub === undefined ? 1.2 : o.sub;
    for (let i = 0; i < n; i++) out[i] = (lo[i] * 1.0 + sub[i] * sg) * env[i] + mid[i] * 0.12 * env[i] * env[i];
    return out;
  };
  const st = { L: src(0), R: src(1) };
  C.fadeOut(st.L, Math.round(0.5 * SR)); C.fadeOut(st.R, Math.round(0.5 * SR));
  return normPeak(st, 1);
}
// wood creak via stick-slip friction: impulse train with wandering rate through resonances
function creak(rng, dur, o = {}) {
  const n = Math.round(dur * SR);
  const exc = zeros(n);
  const r0 = o.rate || rng.uni(70, 160);
  const res = o.res || [rng.uni(260, 420), rng.uni(700, 1000), rng.uni(1500, 2300)];
  let t = 0; let k = 0;
  while (t < dur) {
    const x = t / dur;
    // rate glides up then down (strain / release), with jitter
    const rate = r0 * (0.75 + 0.5 * Math.sin(Math.PI * x)) * (1 + 0.08 * rng.gauss());
    const i = Math.round(t * SR);
    if (i < n) exc[i] += (0.6 + 0.4 * rng.next()) * (rng.chance(0.1) ? 0.3 : 1);
    t += 1 / Math.max(20, rate); k++;
  }
  const out = zeros(n);
  const gains = [1, 0.55, 0.25], qs = [14, 11, 8];
  res.forEach((f, j) => { const b = Float32Array.from(exc); new Biquad('bp', f, qs[j]).run(b); new Biquad('bp', f, qs[j]).run(b); for (let i = 0; i < n; i++) out[i] += b[i] * gains[j]; });
  // envelope: soft in, sustain, soft out
  for (let i = 0; i < n; i++) { const x = i / n; out[i] *= Math.min(1, x / 0.12) * Math.min(1, (1 - x) / 0.2) * (0.7 + 0.3 * Math.sin(Math.PI * x)); }
  const p = C.peakOf(out) || 1; C.scaleBuf(out, 1 / p);
  return out;
}
// one cricket chirp: nPulses tone pulses at carrier f
function chirp(rng, f, nPulses, pulsePeriod, pulseLen) {
  const len = Math.round((nPulses * pulsePeriod + pulseLen + 0.01) * SR);
  const b = zeros(len);
  for (let p = 0; p < nPulses; p++) {
    const s = Math.round(p * pulsePeriod * SR + rng.gauss(0, 0.0008) * SR);
    const m = Math.round(pulseLen * SR);
    const a = (0.75 + 0.25 * rng.next()) * (p === 0 ? 0.8 : 1);
    let ph = rng.next();
    for (let i = 0; i < m; i++) {
      const x = i / m;
      const e = Math.sin(Math.PI * x) ** 2;
      const ff = f * (1 - 0.025 * x);
      if (s + i >= 0 && s + i < len) b[s + i] += Math.sin(TAU * ph) * e * a;
      ph += ff / SR;
    }
  }
  return b;
}
// tiny static / electrical click
function zap(rng, o = {}) {
  const len = Math.round((o.len || rng.uni(0.001, 0.004)) * SR);
  const b = zeros(len + 64);
  for (let i = 0; i < len; i++) b[i] = rng.bi() * Math.exp(-i / (len * 0.3));
  new Biquad('bp', o.f || rng.uni(1200, 5000), 0.8).run(b);
  const p = C.peakOf(b) || 1; C.scaleBuf(b, 1 / p);
  return b;
}

// ---------------------------------------------------------------- composite layers
// scatter events over a loop: rate per second, density modulated by env (0..1), fn(rng, t) -> {buf, pan, gain}
function scatter(n, rng, rate, make, o = {}) {
  const L = zeros(n), R = zeros(n);
  const dur = n / SR;
  let t = 0;
  const env = o.env || null;
  while (true) {
    t += -Math.log(1 - rng.next()) / rate;
    if (t >= dur) break;
    const i = Math.floor(t * SR);
    if (env && rng.next() > env[i]) continue;
    const ev = make(rng, t);
    if (!ev) continue;
    place(L, R, ev.buf, i, ev.pan || 0, ev.gain === undefined ? 1 : ev.gain);
  }
  return { L, R };
}
// harmonic hum with frequencies snapped to the loop; parts [[mult, amp, detuneHz?], ...]
function hum(n, f0, parts, rng) {
  const out = zeros(n);
  for (const [mul, amp, dHz] of parts) {
    const f = snapHz(f0 * mul + (dHz || 0), n);
    const ph = rng.next();
    const w = TAU * f / SR;
    // stable recursive oscillator (exactly periodic because f is snapped)
    for (let i = 0; i < n; i++) out[i] += amp * Math.sin(w * i + TAU * ph);
  }
  return out;
}

module.exports = {
  circ, white, pink, brown, chain, svf, smooth, lfo, snapHz, rms, normRms, normPeak, mulEnv, place, circReverb, stereoOf, softClip,
  tick, plink, splat, thunder, creak, chirp, zap, scatter, hum,
};
