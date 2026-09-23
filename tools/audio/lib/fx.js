'use strict';
// Effects: synthetic-IR convolution reverb, chorus, delay, compressor, lookahead limiter,
// saturation, wow/flutter, autopan/tremolo, vinyl crackle and helpers for periodic (loopable) beds.
const C = require('./core');
const { SR, TAU, clamp, zeros, Biquad, RNG, dbToGain } = C;

// ---------------------------------------------------------------- reverb
const irCache = new Map();
// Synthetic stereo impulse response: early reflections + frequency dependent exponential tail.
function makeIR(o = {}) {
  const p = Object.assign({
    t60: 2.2, predelay: 0.02, er: 0.35, erTime: 0.07, erCount: 14, width: 1.0,
    hp: 140, lp: 9000, lowMul: 1.15, hiMul: 0.55, airMul: 0.3, build: 0.018, seed: 4242, len: 0,
  }, o);
  const key = JSON.stringify(p);
  if (irCache.has(key)) return irCache.get(key);
  const len = Math.round((p.len || Math.min(8, p.t60 * 1.25 + p.predelay + 0.1)) * SR);
  const rng = new RNG(p.seed);
  const out = [zeros(len), zeros(len)];
  const pd = Math.round(p.predelay * SR);
  const bands = [ // [lo, hi, t60 multiplier]
    [0, 250, p.lowMul], [250, 1500, 1.0], [1500, 5000, p.hiMul], [5000, 0, p.airMul],
  ];
  for (let ch = 0; ch < 2; ch++) {
    const tail = zeros(len);
    for (const [lo, hi, mul] of bands) {
      const nz = zeros(len);
      for (let i = pd; i < len; i++) nz[i] = rng.gauss() * 0.5;
      if (lo > 0) { new Biquad('hp', lo, 0.7071).run(nz); new Biquad('hp', lo, 0.7071).run(nz); }
      if (hi > 0) { new Biquad('lp', hi, 0.7071).run(nz); new Biquad('lp', hi, 0.7071).run(nz); }
      const t60 = Math.max(0.05, p.t60 * mul);
      const k = 6.9078 / t60;
      for (let i = pd; i < len; i++) {
        const t = (i - pd) / SR;
        const build = 1 - Math.exp(-t / p.build);
        nz[i] *= Math.exp(-k * t) * build;
      }
      for (let i = 0; i < len; i++) tail[i] += nz[i];
    }
    // early reflections
    const er = zeros(len);
    for (let k = 0; k < p.erCount; k++) {
      const t = p.predelay * 0.4 + rng.uni(0.002, p.erTime) * Math.pow(rng.next(), 0.6);
      const idx = Math.round(t * SR);
      if (idx >= len) continue;
      const a = p.er * (0.4 + 0.6 * rng.next()) * Math.exp(-t / (p.erTime * 1.2)) * (rng.chance(0.5) ? 1 : -1);
      er[idx] += a;
    }
    new Biquad('lp', 6000, 0.7071).run(er);
    // normalise tail energy, then add er
    let e = 0; for (let i = 0; i < len; i++) e += tail[i] * tail[i];
    const g = 1 / Math.sqrt(e + 1e-12);
    for (let i = 0; i < len; i++) out[ch][i] = tail[i] * g + er[i];
    if (p.hp > 0) { new Biquad('hp', p.hp, 0.7071).run(out[ch]); new Biquad('hp', p.hp, 0.7071).run(out[ch]); }
    if (p.lp > 0) new Biquad('lp', p.lp, 0.7071).run(out[ch]);
    // fade end
    C.fadeOut(out[ch], Math.round(0.05 * SR));
  }
  // width via M/S
  if (p.width !== 1) {
    for (let i = 0; i < len; i++) {
      const m = (out[0][i] + out[1][i]) * 0.5, s = (out[0][i] - out[1][i]) * 0.5 * p.width;
      out[0][i] = m + s; out[1][i] = m - s;
    }
  }
  // final energy normalisation (average of channels = 1)
  let e = 0; for (let ch = 0; ch < 2; ch++) for (let i = 0; i < len; i++) e += out[ch][i] * out[ch][i];
  const g = 1 / Math.sqrt(e / 2 + 1e-12);
  for (let ch = 0; ch < 2; ch++) C.scaleBuf(out[ch], g);
  const ir = { L: out[0], R: out[1] };
  irCache.set(key, ir);
  return ir;
}
// Convolution reverb; input stereo, returns wet stereo of length inLen (tail truncated to outLen)
function reverb(L, R, irOpts = {}, outLen) {
  const ir = makeIR(irOpts);
  const cross = irOpts.cross === undefined ? 0.3 : irOpts.cross;
  const n = L.length;
  const a = zeros(n), b = zeros(n);
  for (let i = 0; i < n; i++) { a[i] = L[i] * (1 - cross) + R[i] * cross; b[i] = R[i] * (1 - cross) + L[i] * cross; }
  return C.convolveStereo(a, b, ir.L, ir.R, outLen || n);
}

// ---------------------------------------------------------------- LFO helpers
// quantise an LFO rate so that it completes an integer number of cycles per period (seconds)
function qRate(rate, period) { if (!period) return rate; const k = Math.max(1, Math.round(rate * period)); return k / period; }

// ---------------------------------------------------------------- modulated delay effects
function readFrac(buf, pos) {
  const i = Math.floor(pos); const f = pos - i;
  if (i < 0 || i + 1 >= buf.length) return 0;
  return buf[i] + (buf[i + 1] - buf[i]) * f;
}
// Stereo chorus (in-place). t0 = timeline time (s) of the loop start (LFO phase reference)
function chorus(L, R, o = {}) {
  const p = Object.assign({ rate: 0.5, depth: 0.0025, base: 0.014, voices: 3, mix: 0.4, t0: 0, period: 0, spread: 1 }, o);
  const n = L.length;
  const inL = Float32Array.from(L), inR = Float32Array.from(R);
  const rates = [], phs = [];
  for (let v = 0; v < p.voices; v++) { rates.push(qRate(p.rate * (1 + 0.23 * v), p.period)); phs.push(v / p.voices); }
  const bs = p.base * SR, dp = p.depth * SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR - p.t0;
    let wl = 0, wr = 0;
    for (let v = 0; v < p.voices; v++) {
      const ph = rates[v] * t + phs[v];
      const dl = bs * (1 + 0.15 * v) + dp * Math.sin(TAU * ph);
      const dr = bs * (1 + 0.15 * v) + dp * Math.sin(TAU * (ph + 0.25 * p.spread));
      wl += readFrac(inL, i - dl); wr += readFrac(inR, i - dr);
    }
    wl /= p.voices; wr /= p.voices;
    L[i] = inL[i] * (1 - p.mix * 0.5) + wl * p.mix;
    R[i] = inR[i] * (1 - p.mix * 0.5) + wr * p.mix;
  }
}
// Wow & flutter (tape/vinyl pitch wobble) in place; periodic with the loop.
function wow(L, R, o = {}) {
  const p = Object.assign({ wowRate: 0.55, wowDepth: 0.0022, flutRate: 6.5, flutDepth: 0.0004, t0: 0, period: 0, seed: 9 }, o);
  const n = L.length;
  const rng = new RNG(p.seed);
  const comps = [
    [qRate(p.wowRate, p.period), p.wowDepth * 0.7, rng.next()],
    [qRate(p.wowRate * 0.37, p.period), p.wowDepth * 0.5, rng.next()],
    [qRate(p.flutRate, p.period), p.flutDepth, rng.next()],
  ];
  let maxA = 0;
  const amps = comps.map(([f, d]) => { const A = d * SR / (TAU * f); maxA += A; return A; });
  const D0 = maxA + 4;
  const inL = Float32Array.from(L), inR = Float32Array.from(R);
  for (let i = 0; i < n; i++) {
    const t = i / SR - p.t0;
    let d = D0;
    for (let k = 0; k < comps.length; k++) d += amps[k] * Math.sin(TAU * (comps[k][0] * t + comps[k][2]));
    L[i] = readFrac(inL, i - d); R[i] = readFrac(inR, i - d);
  }
  // compensate constant delay D0 by shifting left
  const sh = Math.round(D0);
  L.copyWithin(0, sh); R.copyWithin(0, sh);
  L.fill(0, n - sh); R.fill(0, n - sh);
}
// Stereo auto-pan / tremolo, in place
function autopan(L, R, o = {}) {
  const p = Object.assign({ rate: 4.5, depth: 0.35, t0: 0, period: 0, mode: 'pan' }, o);
  const f = qRate(p.rate, p.period);
  for (let i = 0; i < L.length; i++) {
    const s = Math.sin(TAU * f * (i / SR - p.t0));
    if (p.mode === 'pan') { L[i] *= 1 - p.depth * (0.5 + 0.5 * s); R[i] *= 1 - p.depth * (0.5 - 0.5 * s); }
    else { const g = 1 - p.depth * (0.5 + 0.5 * s); L[i] *= g; R[i] *= g; }
  }
}
// Stereo feedback delay. Returns wet signal (same length). time in seconds.
function delay(L, R, o = {}) {
  const p = Object.assign({ time: 0.375, timeR: 0, fb: 0.35, lp: 4500, hp: 250, pingpong: true }, o);
  const n = L.length;
  const dL = Math.max(1, Math.round(p.time * SR)), dR = Math.max(1, Math.round((p.timeR || p.time) * SR));
  const outL = zeros(n), outR = zeros(n);
  const lpL = new C.OnePole(p.lp), lpR = new C.OnePole(p.lp), hpL = new C.OnePole(p.hp), hpR = new C.OnePole(p.hp);
  const bufL = new Float32Array(dL), bufR = new Float32Array(dR);
  let iL = 0, iR = 0;
  for (let i = 0; i < n; i++) {
    const yl = bufL[iL], yr = bufR[iR];
    outL[i] = yl; outR[i] = yr;
    let fl, fr;
    if (p.pingpong) { fl = (L[i] + R[i]) * 0.5 + yr * p.fb; fr = yl * p.fb; }
    else { fl = L[i] + yl * p.fb; fr = R[i] + yr * p.fb; }
    fl = hpL.hp(lpL.lp(fl)); fr = hpR.hp(lpR.lp(fr));
    bufL[iL] = fl; bufR[iR] = fr;
    iL = (iL + 1) % dL; iR = (iR + 1) % dR;
  }
  return { L: outL, R: outR };
}

// ---------------------------------------------------------------- dynamics
function compress(L, R, o = {}) {
  const p = Object.assign({ thr: -18, ratio: 3, attack: 0.008, release: 0.15, knee: 6, makeup: 0, mix: 1 }, o);
  const aA = Math.exp(-1 / (p.attack * SR)), aR = Math.exp(-1 / (p.release * SR));
  let env = 0; const mk = dbToGain(p.makeup);
  let grMax = 0;
  for (let i = 0; i < L.length; i++) {
    const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    env = x > env ? aA * env + (1 - aA) * x : aR * env + (1 - aR) * x;
    const lv = 20 * Math.log10(env + 1e-9);
    let over = lv - p.thr, gr = 0;
    if (over > p.knee / 2) gr = over * (1 - 1 / p.ratio);
    else if (over > -p.knee / 2) { const q = over + p.knee / 2; gr = (1 - 1 / p.ratio) * q * q / (2 * p.knee); }
    if (gr > grMax) grMax = gr;
    const g = Math.pow(10, -gr / 20) * mk;
    L[i] = L[i] * (1 - p.mix + p.mix * g); R[i] = R[i] * (1 - p.mix + p.mix * g);
  }
  return grMax;
}
// Look-ahead brickwall limiter (no added latency). ceiling in dBFS (sample peak)
function limiter(L, R, o = {}) {
  const p = Object.assign({ ceiling: -2.3, lookahead: 0.004, release: 0.09 }, o);
  const n = L.length;
  const c = dbToGain(p.ceiling);
  const LA = Math.max(1, Math.round(p.lookahead * SR));
  const req = new Float32Array(n);
  let anyOver = false;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    req[i] = a > c ? c / a : 1;
    if (a > c) anyOver = true;
  }
  if (!anyOver) return 0;
  // h[k] = min(req[k-LA..k]) via monotonic deque
  const h = new Float32Array(n);
  const dq = new Int32Array(n); let head = 0, tail = 0;
  for (let k = 0; k < n; k++) {
    while (tail > head && req[dq[tail - 1]] >= req[k]) tail--;
    dq[tail++] = k;
    while (dq[head] < k - LA) head++;
    h[k] = req[dq[head]];
  }
  // release smoothing (never above h)
  const rc = Math.exp(-1 / (p.release * SR));
  let g = 1;
  for (let k = 0; k < n; k++) { g = 1 - (1 - g) * rc; if (h[k] < g) g = h[k]; h[k] = g; }
  // forward-looking boxcar average of h over [n, n+LA]
  let sum = 0; for (let j = 0; j <= LA && j < n; j++) sum += h[j];
  let minG = 1;
  for (let i = 0; i < n; i++) {
    const G = sum / (LA + 1);
    L[i] *= G; R[i] *= G;
    if (G < minG) minG = G;
    sum -= h[i];
    sum += i + LA + 1 < n ? h[i + LA + 1] : 1;
  }
  return -20 * Math.log10(minG);
}

// ---------------------------------------------------------------- saturation
function saturate(buf, drive = 1.5, mix = 1, asym = 0) {
  const d = Math.max(0.01, drive);
  const off = Math.tanh(d * asym);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (Math.tanh(d * (x + asym)) - off) / d;
    buf[i] = x + (y - x) * mix;
  }
  if (asym) { const dc = new C.DCBlock(10); for (let i = 0; i < buf.length; i++) buf[i] = dc.process(buf[i]); }
  return buf;
}

// ---------------------------------------------------------------- periodic (loop-safe) generators
// run a stateful per-sample function twice around a cyclic buffer so the output is exactly periodic
function circular(buf, makeProc) {
  const proc = makeProc();
  for (let i = 0; i < buf.length; i++) proc(buf[i]);
  const out = zeros(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = proc(buf[i]);
  return out;
}
function addWrapped(dst, src, pos, gain = 1) {
  const n = dst.length; let p = ((Math.round(pos) % n) + n) % n;
  for (let i = 0; i < src.length; i++) { dst[p] += src[i] * gain; p++; if (p >= n) p = 0; }
}
// smooth periodic random function (values roughly in [-1,1]) with integer cycles per period
function periodicLFO(n, rng, minCyc = 1, maxCyc = 6, terms = 4) {
  const o = zeros(n);
  const comps = [];
  for (let k = 0; k < terms; k++) comps.push([rng.int(minCyc, maxCyc), rng.next(), 1 / (k + 1)]);
  let norm = 0; for (const c of comps) norm += c[2];
  for (let i = 0; i < n; i++) {
    let v = 0; const t = i / n;
    for (const [cyc, ph, a] of comps) v += a * Math.sin(TAU * (cyc * t + ph));
    o[i] = v / norm;
  }
  return o;
}
// vinyl crackle bed (periodic, length n): returns {L,R}
function vinylCrackle(n, rng, o = {}) {
  const p = Object.assign({ pops: 2.2, crackles: 60, popLevel: 0.25, crackleLevel: 0.035, hiss: 0.004, rumble: 0 }, o);
  const L = zeros(n), R = zeros(n);
  const dur = n / SR;
  const click = (len, fc, amp, rr) => {
    const b = zeros(len);
    for (let i = 0; i < len; i++) b[i] = rr.bi() * Math.exp(-i / (len * 0.25));
    new Biquad('bp', fc, 1.2).run(b);
    new Biquad('hp', 700, 0.7).run(b);
    return C.scaleBuf(b, amp);
  };
  const nPops = Math.round(p.pops * dur);
  for (let k = 0; k < nPops; k++) {
    const amp = p.popLevel * Math.pow(rng.next(), 2.2) * (rng.chance(0.5) ? 1 : -1);
    const b = click(rng.int(40, 140), rng.uni(1200, 4200), amp * 4, rng);
    const pos = rng.next() * n, pan = rng.uni(-0.5, 0.5);
    addWrapped(L, b, pos, 1 - pan * 0.5); addWrapped(R, b, pos, 1 + pan * 0.5);
  }
  const nCr = Math.round(p.crackles * dur);
  for (let k = 0; k < nCr; k++) {
    const amp = p.crackleLevel * Math.pow(rng.next(), 3) * (rng.chance(0.5) ? 1 : -1);
    const b = click(rng.int(6, 24), rng.uni(2500, 7000), amp * 3, rng);
    const pos = rng.next() * n;
    if (rng.chance(0.5)) addWrapped(L, b, pos); else addWrapped(R, b, pos);
  }
  if (p.hiss > 0) {
    for (const ch of [L, R]) {
      const w = C.noiseWhite(n, rng);
      const hp = circular(w, () => { const b = new Biquad('hp', 3000, 0.6); const l = new Biquad('lp', 9000, 0.6); return (x) => l.process(b.process(x)); });
      for (let i = 0; i < n; i++) ch[i] += hp[i] * p.hiss;
    }
  }
  return { L, R };
}

module.exports = { makeIR, reverb, qRate, chorus, wow, autopan, delay, compress, limiter, saturate, circular, addWrapped, periodicLFO, vinylCrackle, readFrac };
