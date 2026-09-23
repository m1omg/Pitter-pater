'use strict';
// Melodic instruments. Each instrument is an object { render(note) -> Float32Array | {L,R}, tail, phrase? }.
// note = { m (midi, may be fractional), f (Hz), dur (gate seconds), vel (0..1), seed, p (extra params) }
// Phrase instruments (mono/legato leads) implement renderPhrase(notes) where notes have t (s, relative).
const C = require('./core');
const FX = require('./fx');
const { SR, TAU, clamp, zeros, RNG, Biquad, SVF, OnePole, mtof, cents, addModes, fsin } = C;

const P = (defaults, o) => Object.assign({}, defaults, o || {});
const fOf = (note) => note.f || mtof(note.m);
const mOf = (note) => (note.m !== undefined ? note.m : C.ftom(note.f));

function attackRamp(buf, n) { n = Math.min(n, buf.length); for (let i = 0; i < n; i++) buf[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / n); }
function tailFade(buf, n) { C.fadeOut(buf, Math.min(n, buf.length)); }
function hp(buf, f, q = 0.7071) { return new Biquad('hp', f, q).run(buf); }
function lp(buf, f, q = 0.7071) { return new Biquad('lp', f, q).run(buf); }
function peq(buf, f, q, db) { return new Biquad('peak', f, q, db).run(buf); }

// per-sample frequency array with vibrato / drift / optional scoop
function vibFreq(n, f0, o = {}) {
  const p = P({ depth: 0, rate: 5.5, delay: 0.25, ramp: 0.4, drift: 0, scoop: 0, scoopT: 0.05, rng: null, ph: 0, jitter: 0 }, o);
  const out = new Float32Array(n);
  const rng = p.rng || new RNG(1);
  let drift = 0, dv = 0;
  const vr = p.rate * (1 + (p.rng ? rng.gauss(0, 0.04) : 0));
  let jit = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let c = 0;
    if (p.depth) {
      const e = t < p.delay ? 0 : Math.min(1, (t - p.delay) / p.ramp);
      c += p.depth * e * Math.sin(TAU * vr * t + p.ph);
    }
    if (p.drift) {
      if ((i & 63) === 0) { dv = dv * 0.97 + rng.gauss(0, 0.02); }
      drift = drift * 0.99995 + dv * 0.0005;
      c += p.drift * clamp(drift * 8, -1, 1);
    }
    if (p.jitter) { if ((i & 31) === 0) jit = rng.gauss(0, p.jitter); c += jit; }
    if (p.scoop && t < p.scoopT * 3) c += p.scoop * Math.exp(-t / p.scoopT);
    out[i] = f0 * Math.pow(2, c / 1200);
  }
  return out;
}

// ======================================================================= PIANO (felt / soft)
// Additive: inharmonic partials, two detuned string components per partial (prompt + aftersound),
// velocity-dependent brightness, hammer-position comb, felt thump & mechanical noise, damper release.
function makePiano(o) {
  const cfg = P({ felt: 0.65, bright: 0.5, width: 0.55, decay: 1.0, release: 0.28, unison: 0.9, noise: 1.0, hammerPos: 0.137, gain: 1, maxDur: 9, tone: 0 }, o);
  return {
    tail: cfg.release * 2 + 0.2,
    render(note) {
      const m = mOf(note), f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const t60f = clamp(15 * Math.pow(2, -(m - 45) / 16), 1.3, 24) * x.decay;
      const gate = note.dur;
      const undamped = m >= 89;
      const relT = undamped ? Math.min(t60f * 0.6, 3) : x.release * (1 + 0.6 * clamp((60 - m) / 30, 0, 1));
      const len = Math.min(gate + relT * 1.6 + 0.08, t60f * 1.05 + 0.1, x.maxDur + relT);
      const n = Math.max(64, Math.round(len * SR));
      const L = zeros(n), R = zeros(n);
      const B = 0.00028 * Math.pow(2, (m - 60) / 19);
      const felt = x.felt;
      const tilt = 0.55 + (1 - vel) * 0.55 + felt * 0.35 - x.bright * 0.3;
      const fc = (900 + 4200 * vel * vel) * (1.3 - felt * 0.5) * (0.6 + x.bright) * (1 + 0.3 * x.tone);
      const maxF = Math.min(C.NYQ * 0.9, 5000 + 9000 * vel * (1 - felt * 0.5));
      const modesA = [], modesB = [];
      let norm = 0;
      const unis = x.unison * (0.6 + 0.4 * rng.next());
      for (let k = 1; k <= 60; k++) {
        const fk = k * f0 * Math.sqrt(1 + B * k * k);
        if (fk > maxF) break;
        let a = Math.pow(k, -tilt) / Math.sqrt(1 + Math.pow(fk / fc, 2.4));
        a *= 0.2 + 0.8 * Math.abs(Math.sin(Math.PI * k * x.hammerPos));
        a /= Math.sqrt(1 + Math.pow(120 / fk, 2)); // soundboard radiates the deep fundamentals weakly
        const t60k = t60f / (1 + 0.09 * (k - 1) * (1 + felt)) / (1 + fk / 4200);
        const relK = relT / (1 + 0.04 * k);
        const ph = rng.uni(-0.3, 0.3);
        const d = unis * (rng.next() - 0.5);
        modesA.push({ f: fk * cents(-d / 2 - unis * 0.25), a: a * 0.62, t60: t60k * 0.33, ph, t60rel: undamped ? t60k * 0.33 : relK });
        modesB.push({ f: fk * cents(d / 2 + unis * 0.25), a: a * 0.38, t60: t60k, ph: ph + 0.1, t60rel: undamped ? t60k : relK });
        norm += a * a;
      }
      norm = 1 / Math.sqrt(norm + 1e-9);
      for (const md of modesA) md.a *= norm; for (const md of modesB) md.a *= norm;
      const relAt = Math.round(gate * SR);
      const A = zeros(n), Bb = zeros(n);
      addModes(A, modesA, { relAt }); addModes(Bb, modesB, { relAt });
      const w = x.width;
      for (let i = 0; i < n; i++) { L[i] = A[i] * (0.5 + 0.5 * w) + Bb[i] * (0.5 - 0.5 * w); R[i] = A[i] * (0.5 - 0.5 * w) + Bb[i] * (0.5 + 0.5 * w); }
      // attack shaping (felt is softer)
      const atk = Math.round((0.0015 + 0.004 * (1 - vel) + 0.004 * felt) * SR);
      attackRamp(L, atk); attackRamp(R, atk);
      // hammer / felt thump and mechanical noise
      if (x.noise > 0) {
        const nl = Math.round(0.05 * SR);
        const nz = zeros(nl);
        for (let i = 0; i < nl; i++) nz[i] = rng.bi() * Math.exp(-i / (0.006 * SR));
        lp(nz, 900 + 2200 * vel * (1 - felt * 0.5)); hp(nz, 120);
        const th = zeros(nl);
        const tf = 60 + f0 * 0.12;
        for (let i = 0; i < nl; i++) th[i] = Math.sin(TAU * tf * i / SR) * Math.exp(-i / (0.012 * SR));
        const g = 0.05 * x.noise * (0.4 + vel) * (0.6 + felt);
        for (let i = 0; i < nl && i < n; i++) { const v = (nz[i] * 0.55 + th[i] * 0.6) * g; L[i] += v; R[i] += v; }
        // key release thud (felt dampers)
        if (!undamped && relAt < n - nl && gate > 0.1) {
          for (let i = 0; i < nl && relAt + i < n; i++) { const v = th[i] * 0.12 * g; L[relAt + i] += v; R[relAt + i] += v; }
        }
      }
      const amp = Math.pow(vel, 1.25) * 0.55 * x.gain;
      for (let i = 0; i < n; i++) { L[i] *= amp; R[i] *= amp; }
      tailFade(L, 256); tailFade(R, 256);
      return { L, R };
    },
  };
}

// ======================================================================= RHODES (FM electric piano)
function makeRhodes(o) {
  const cfg = P({ bark: 0.6, bell: 0.55, decay: 1, release: 0.16, gain: 1, drive: 0.25 }, o);
  return {
    tail: cfg.release * 2.5 + 0.1,
    render(note) {
      const m = mOf(note), f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const tau = clamp(2.6 * Math.pow(2, -(m - 48) / 20), 0.5, 4) * x.decay;
      const len = Math.min(note.dur + x.release * 3 + 0.05, tau * 5);
      const n = Math.round(len * SR);
      const out = zeros(n);
      const ks = clamp(1 - (m - 60) / 40, 0.35, 1.2); // key scaling of indices
      const I1a = (0.35 + 1.9 * vel * vel * x.bark) * ks, I1b = 0.18 * ks;
      const I2a = x.bell * (0.8 + 2.2 * vel) * ks;
      const gate = Math.round(note.dur * SR);
      const rk = Math.exp(-1 / (x.release * SR / 4.6));
      const det = cents(rng.uni(-1.5, 1.5));
      let ph1 = 0, phm = 0, ph2 = 0, phm2 = 0, rel = 1;
      const d1 = f0 / SR, dm = f0 * det / SR, d2 = f0 * 1.0006 / SR, dm2 = f0 * 13.97 / SR;
      const kTau = Math.exp(-1 / (tau * SR)), kI = Math.exp(-1 / (0.22 * SR)), kB = Math.exp(-1 / (0.035 * SR)), kBa = Math.exp(-1 / (0.28 * SR));
      const kFast = Math.exp(-1 / (0.12 * SR));
      let env = 1, eI = 1, eB = 1, eBa = 1, eF = 1;
      const bellAmp = 0.22 + 0.25 * vel;
      for (let i = 0; i < n; i++) {
        if (i >= gate) rel *= rk;
        const I1 = I1a * eI + I1b;
        const mod = fsin(phm) * I1 / TAU;
        const s1 = fsin(ph1 + mod);
        const mod2 = fsin(phm2) * I2a * eB / TAU;
        const s2 = fsin(ph2 + mod2) * bellAmp * eBa;
        const a = (env * 0.8 + eF * 0.2) * rel;
        out[i] = (s1 + s2) * a;
        ph1 += d1; phm += dm; ph2 += d2; phm2 += dm2;
        if (ph1 > 1) ph1 -= 1; if (phm > 1) phm -= 1; if (ph2 > 1) ph2 -= 1; if (phm2 > 1) phm2 -= 1;
        env *= kTau; eI *= kI; eB *= kB; eBa *= kBa; eF *= kFast;
        if (rel < 1e-5) { break; }
      }
      // pickup nonlinearity: gentle asymmetric saturation adds even harmonics ("bark")
      const dr = x.drive * (0.5 + vel);
      for (let i = 0; i < n; i++) { const v = out[i]; out[i] = v + dr * 0.35 * v * v - dr * 0.12 * v * v * v; }
      hp(out, 40);
      attackRamp(out, Math.round(0.0012 * SR));
      const amp = Math.pow(vel, 1.1) * 0.42 * x.gain;
      C.scaleBuf(out, amp);
      tailFade(out, 200);
      return out;
    },
  };
}

// ======================================================================= MODAL PERCUSSION (bells, box, glock...)
// modes: [ratio, amp, t60 multiplier, velocity->amp exponent]
const MODAL_DEFS = {
  musicbox: { modes: [[1, 1, 1, 0], [2.005, 0.07, 0.35, 0.5], [3.93, 0.05, 0.22, 1], [6.267, 0.3, 0.16, 1.2], [12.1, 0.07, 0.07, 1.5], [17.55, 0.05, 0.045, 1.5]],
    t60: (m) => clamp(3.0 * Math.pow(2, -(m - 72) / 20), 0.7, 4.2), detune: 5, twin: 0.45, click: [0.04, 5200, 0.0012], attack: 0.0005, gain: 0.5 },
  celesta: { modes: [[1, 1, 1, 0], [2.0, 0.05, 0.4, 0.5], [3.0, 0.08, 0.2, 1], [4.07, 0.12, 0.12, 1.2], [6.8, 0.03, 0.06, 1.5]],
    t60: (m) => clamp(2.2 * Math.pow(2, -(m - 72) / 22), 0.6, 3.2), detune: 1.5, twin: 0, click: [0.02, 2400, 0.003], attack: 0.0012, gain: 0.55 },
  glock: { modes: [[1, 1, 1, 0], [2.756, 0.32, 0.35, 0.8], [5.404, 0.14, 0.14, 1.2], [8.933, 0.06, 0.07, 1.5]],
    t60: (m) => clamp(3.2 * Math.pow(2, -(m - 84) / 24), 1.0, 4.5), detune: 1, twin: 0, click: [0.05, 7000, 0.0015], attack: 0.0004, gain: 0.45 },
  toypiano: { modes: [[1, 1, 1, 0], [2.0, 0.1, 0.4, 0.6], [3.08, 0.12, 0.18, 1], [6.267, 0.28, 0.12, 1.1], [9.1, 0.05, 0.06, 1.3], [17.55, 0.04, 0.035, 1.5]],
    t60: (m) => clamp(1.6 * Math.pow(2, -(m - 72) / 22), 0.45, 2.2), detune: 9, twin: 0.3, click: [0.07, 1300, 0.008], attack: 0.0006, gain: 0.5 },
  xylo: { modes: [[1, 1, 1, 0], [3.0, 0.22, 0.28, 1], [6.3, 0.06, 0.1, 1.4], [10.2, 0.02, 0.05, 1.5]],
    t60: (m) => clamp(0.9 * Math.pow(2, -(m - 72) / 22), 0.22, 1.3), detune: 2, twin: 0, click: [0.09, 2600, 0.004], attack: 0.0003, gain: 0.55 },
  marimba: { modes: [[1, 1, 1, 0], [3.93, 0.1, 0.25, 1], [9.2, 0.02, 0.08, 1.5]],
    t60: (m) => clamp(1.8 * Math.pow(2, -(m - 60) / 24), 0.4, 2.4), detune: 1, twin: 0, click: [0.04, 1500, 0.004], attack: 0.0015, gain: 0.6 },
  vibes: { modes: [[1, 1, 1, 0], [4.0, 0.08, 0.2, 1], [10.0, 0.015, 0.06, 1.5]],
    t60: (m) => clamp(4.0 * Math.pow(2, -(m - 72) / 26), 1.4, 5), detune: 0.5, twin: 0, click: [0.025, 3000, 0.002], attack: 0.001, gain: 0.5, trem: [5.2, 0.35] },
  chime: { modes: [[1, 1, 1, 0], [2.76, 0.5, 0.6, 0.6], [5.40, 0.3, 0.4, 1], [8.93, 0.16, 0.25, 1.2], [13.34, 0.06, 0.15, 1.3]],
    t60: (m) => clamp(6 * Math.pow(2, -(m - 72) / 24), 2.5, 9), detune: 3, twin: 0.2, click: [0.02, 6000, 0.001], attack: 0.0006, gain: 0.35 },
  bell: { modes: [[0.5, 0.35, 1.6, 0], [1, 1, 1, 0], [1.19, 0.45, 0.8, 0.6], [1.5, 0.3, 0.7, 0.8], [2.0, 0.45, 0.5, 1], [2.51, 0.18, 0.35, 1.1], [2.99, 0.2, 0.3, 1.2], [4.08, 0.08, 0.2, 1.4]],
    t60: (m) => clamp(7 * Math.pow(2, -(m - 60) / 24), 2.5, 12), detune: 1, twin: 0.5, click: [0.05, 2500, 0.004], attack: 0.0008, gain: 0.35 },
  kalimba: { modes: [[1, 1, 1, 0], [5.9, 0.12, 0.1, 1.2], [15.4, 0.03, 0.04, 1.4]],
    t60: (m) => clamp(1.6 * Math.pow(2, -(m - 72) / 22), 0.4, 2.2), detune: 3, twin: 0, click: [0.06, 1800, 0.003], attack: 0.0008, gain: 0.6 },
};
function makeModal(kind, o) {
  const def = MODAL_DEFS[kind];
  const cfg = P({ decay: 1, bright: 1, gain: 1, detune: def.detune, release: 0 }, o);
  return {
    tail: 0.1,
    render(note) {
      const m = mOf(note), f0raw = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const f0 = f0raw * cents(rng.gauss(0, x.detune * 0.5));
      const T = def.t60(m) * x.decay;
      let len = T * 1.05 + 0.05;
      if (x.release > 0) len = Math.min(len, note.dur + x.release * 1.5 + 0.05);
      const n = Math.round(Math.min(len, 12) * SR);
      const out = zeros(n);
      const modes = [];
      for (const [r, a, tm, ve] of def.modes) {
        const fr = f0 * r;
        if (fr > C.NYQ * 0.92) continue;
        const bright = r > 1.5 ? x.bright : 1;
        modes.push({ f: fr, a: a * Math.pow(vel, ve * 0.8) * bright, t60: Math.max(0.02, T * tm), ph: 0, t60rel: x.release > 0 ? x.release : undefined });
      }
      const relAt = x.release > 0 ? Math.round(note.dur * SR) : undefined;
      addModes(out, modes, { relAt });
      if (def.twin && rng.chance(def.twin)) {
        const tw = zeros(n);
        const d = cents(rng.uni(1.5, 4) * (rng.chance(0.5) ? 1 : -1));
        addModes(tw, modes.slice(0, 2).map((md) => Object.assign({}, md, { f: md.f * d, a: md.a * 0.45 })), { relAt });
        for (let i = 0; i < n; i++) out[i] += tw[i];
      }
      // mallet / pin click
      const [cl, cf, ct] = def.click;
      if (cl > 0) {
        const nl = Math.min(n, Math.round(ct * 8 * SR) + 64);
        const ck = zeros(nl);
        for (let i = 0; i < nl; i++) ck[i] = rng.bi() * Math.exp(-i / (ct * SR));
        new Biquad('bp', cf, 1.1).run(ck);
        const g = cl * 2.5 * (0.4 + vel) * (x.clickGain === undefined ? 1 : x.clickGain);
        for (let i = 0; i < nl; i++) out[i] += ck[i] * g;
      }
      if (def.trem) {
        const [tr, td] = def.trem; const ph = rng.next();
        for (let i = 0; i < n; i++) out[i] *= 1 - td * (0.5 + 0.5 * Math.sin(TAU * (tr * i / SR + ph)));
      }
      attackRamp(out, Math.max(2, Math.round(def.attack * SR)));
      C.scaleBuf(out, def.gain * x.gain * Math.pow(vel, 0.9));
      tailFade(out, 300);
      return out;
    },
  };
}

// ======================================================================= KARPLUS-STRONG PLUCKS
const BODY = {
  none: [],
  uke: [['peak', 260, 1.6, 4], ['peak', 520, 2.0, 2], ['peak', 1900, 1.2, 2], ['lp', 6500, 0.7]],
  nylon: [['peak', 110, 1.4, 3], ['peak', 230, 1.8, 3], ['peak', 480, 2, 1.5], ['highshelf', 3500, 0.7, -3], ['lp', 7000, 0.7]],
  guitar: [['peak', 105, 1.2, 4], ['peak', 210, 1.6, 3], ['peak', 400, 2, -2], ['peak', 2500, 1, 2], ['lp', 8500, 0.7]],
  harp: [['peak', 200, 0.9, 2], ['highshelf', 3000, 0.7, -2]],
  violin: [['peak', 290, 1.8, 5], ['peak', 480, 2, 2], ['peak', 1100, 1.5, -3], ['peak', 2800, 1.2, 3], ['lp', 6000, 0.7]],
  cello: [['peak', 110, 1.4, 4], ['peak', 220, 1.6, 3], ['peak', 700, 1.5, -2], ['lp', 3500, 0.7]],
  upright: [['peak', 90, 1.2, 4], ['peak', 190, 1.4, 2], ['peak', 800, 1.2, -3], ['lp', 2600, 0.7]],
};
function ksCore(f0, n, o, rng, gateN) {
  // o: {t60, damp (0..0.95 lowpass pole in loop), bright (excitation), pick (0..0.5), exc: 'noise'|'soft', muteT}
  const out = zeros(n);
  const N = SR / f0;
  const a = clamp(o.damp, 0, 0.97);
  const w = TAU * f0 / SR;
  // one-pole lowpass H = (1-a)/(1-a z^-1): phase delay at w
  const phi = Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w));
  const lpDelay = phi / w;
  const Hmag = (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w) + a * a);
  let total = N - lpDelay;
  let Nint = Math.floor(total - 0.5); if (Nint < 2) Nint = 2;
  let d = total - Nint; // in [0.5,1.5)
  const Cap = (1 - d) / (1 + d);
  const target = Math.pow(10, -3 / (o.t60 * f0));
  let g = Math.min(0.99999, target / Hmag);
  const gMute = Math.min(g, Math.pow(10, -3 / (Math.max(0.02, o.muteT) * f0)) / Hmag);
  const size = Nint + 4;
  const dl = new Float32Array(size);
  // excitation
  const exLen = Math.max(4, Math.round(N));
  const ex = new Float32Array(exLen);
  if (o.exc === 'soft') {
    for (let i = 0; i < exLen; i++) { const t = i / exLen; ex[i] = (t < o.pick ? t / o.pick : (1 - t) / (1 - o.pick)) + 0.15 * rng.bi(); }
  } else {
    for (let i = 0; i < exLen; i++) ex[i] = rng.bi();
  }
  // brightness filter on excitation
  const lpA = 1 - Math.exp(-TAU * clamp(o.bright, 80, 16000) / SR);
  let y = 0; for (let pass = 0; pass < 2; pass++) for (let i = 0; i < exLen; i++) { y += lpA * (ex[i] - y); ex[i] = y; }
  // pick position comb
  const pd = Math.max(1, Math.round(o.pick * exLen));
  const ex2 = new Float32Array(exLen);
  for (let i = 0; i < exLen; i++) ex2[i] = ex[i] - (i >= pd ? ex[i - pd] : 0) * 0.9;
  let mean = 0; for (let i = 0; i < exLen; i++) mean += ex2[i]; mean /= exLen;
  let rms = 0; for (let i = 0; i < exLen; i++) { ex2[i] -= mean; rms += ex2[i] * ex2[i]; }
  rms = Math.sqrt(rms / exLen) + 1e-9;
  for (let i = 0; i < exLen; i++) ex2[i] /= rms;
  let wp = 0; let lpState = 0; let apX1 = 0, apY1 = 0;
  for (let i = 0; i < n; i++) {
    let rd = wp - Nint; if (rd < 0) rd += size;
    const v = dl[rd];
    // fractional allpass
    const apY = Cap * v + apX1 - Cap * apY1; apX1 = v; apY1 = apY;
    lpState = (1 - a) * apY + a * lpState;
    const gg = i < gateN ? g : gMute;
    const inp = i < exLen ? ex2[i] : 0;
    const s = inp + gg * lpState;
    dl[wp] = s; wp++; if (wp >= size) wp = 0;
    out[i] = s;
  }
  return out;
}
function makePluck(kind, o) {
  const presets = {
    uke: { t60: 1.6, damp: 0.25, bright: 3200, pick: 0.2, exc: 'noise', body: 'uke', muteT: 0.12, gain: 0.5, thump: 0.15 },
    nylon: { t60: 2.8, damp: 0.3, bright: 2400, pick: 0.17, exc: 'noise', body: 'nylon', muteT: 0.15, gain: 0.5, thump: 0.12 },
    guitar: { t60: 3.5, damp: 0.12, bright: 5200, pick: 0.13, exc: 'noise', body: 'guitar', muteT: 0.1, gain: 0.45, thump: 0.08 },
    harp: { t60: 4.5, damp: 0.22, bright: 1800, pick: 0.3, exc: 'soft', body: 'harp', muteT: 1.5, gain: 0.55, thump: 0.05 },
    pizz: { t60: 0.55, damp: 0.35, bright: 1600, pick: 0.25, exc: 'soft', body: 'violin', muteT: 0.25, gain: 0.6, thump: 0.25, ens: 2 },
    upright: { t60: 2.2, damp: 0.45, bright: 700, pick: 0.22, exc: 'soft', body: 'upright', muteT: 0.09, gain: 0.42, thump: 0.5, sub: 0.55 },
  };
  const cfg = P(presets[kind], o);
  return {
    tail: cfg.muteT * 2 + 0.05,
    render(note) {
      const m = mOf(note), f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const t60 = x.t60 * clamp(Math.pow(2, -(m - 60) / 30), 0.4, 2.2);
      const len = Math.min(note.dur + x.muteT * 2 + 0.05, t60 * 1.2 + 0.05);
      const n = Math.round(len * SR);
      const gateN = Math.round(note.dur * SR);
      const ens = x.ens || 1;
      let out = zeros(n);
      for (let e = 0; e < ens; e++) {
        const fe = f0 * (ens > 1 ? cents(rng.gauss(0, 4)) : 1);
        const off = e === 0 ? 0 : Math.round(rng.uni(0.003, 0.012) * SR);
        const s = ksCore(fe, n - off, { t60, damp: x.damp, bright: x.bright * (0.45 + 0.75 * vel), pick: x.pick * rng.uni(0.85, 1.15), exc: x.exc, muteT: x.muteT }, rng, gateN - off);
        for (let i = 0; i < s.length; i++) out[i + off] += s[i] / ens;
      }
      // finger/pluck thump
      if (x.thump) {
        const tl = Math.min(n, Math.round(0.03 * SR)); const tf = Math.min(f0 * 1.5, 220);
        for (let i = 0; i < tl; i++) out[i] += Math.sin(TAU * tf * i / SR) * Math.exp(-i / (0.006 * SR)) * x.thump * 0.6;
      }
      if (x.sub) { // round sine reinforcement for bass
        let ph = 0; const kk = Math.exp(-1 / (t60 * 0.5 * SR)); let e1 = 1; const rk = Math.exp(-1 / (x.muteT * SR / 3)); let rel = 1;
        for (let i = 0; i < n; i++) { if (i > gateN) rel *= rk; out[i] += Math.sin(TAU * ph) * x.sub * e1 * rel * Math.min(1, i / 60); ph += f0 / SR; e1 *= kk; }
      }
      C.eqBuf(out, BODY[x.body] || []);
      hp(out, Math.max(30, f0 * 0.5));
      C.scaleBuf(out, x.gain * Math.pow(vel, 1.0) * 0.5);
      tailFade(out, 200);
      return out;
    },
  };
}

// ======================================================================= PADS / STRINGS / CHOIR
function sawEnsemble(n, f0, voices, spreadC, rng, vib, stereoSpread, driftC = 3) {
  const L = zeros(n), R = zeros(n);
  for (let v = 0; v < voices; v++) {
    const det = voices === 1 ? 0 : spreadC * (2 * v / (voices - 1) - 1) + rng.gauss(0, spreadC * 0.15);
    const fr = vibFreq(n, f0 * cents(det), { depth: vib.depth * (0.8 + 0.4 * rng.next()), rate: vib.rate * (0.9 + 0.2 * rng.next()), delay: vib.delay, ramp: vib.ramp, drift: driftC, rng: rng.fork(v), ph: rng.next() * TAU });
    const s = C.oscSaw(n, fr, rng.next());
    const pan = voices === 1 ? 0 : stereoSpread * (2 * ((v * 0.618) % 1) - 1);
    const [gl, gr] = C.panGains(pan);
    for (let i = 0; i < n; i++) { L[i] += s[i] * gl; R[i] += s[i] * gr; }
  }
  const g = 1 / Math.sqrt(voices);
  C.scaleBuf(L, g); C.scaleBuf(R, g);
  return { L, R };
}
function makeStrings(o) {
  const cfg = P({ voices: 6, spread: 9, attack: 0.22, release: 0.55, vib: 11, vibRate: 5.2, vibDelay: 0.3, lp: 3800, body: 'violin', gain: 1, bow: 0.02, bright: 0.5, sub: 0 }, o);
  return {
    tail: cfg.release * 2 + 0.1,
    render(note) {
      const m = mOf(note), f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const len = note.dur + x.release * 2 + 0.05;
      const n = Math.round(len * SR);
      const { L, R } = sawEnsemble(n, f0, x.voices, x.spread, rng, { depth: x.vib, rate: x.vibRate, delay: x.vibDelay, ramp: 0.5 }, 0.7);
      const env = C.adsr(n, x.attack, 0.3, 0.9, x.release, note.dur, { curve: 'sine' });
      // bow-dependent brightness: filter cutoff follows envelope & velocity
      const fL = new SVF(1000, 0.6), fR = new SVF(1000, 0.6);
      const kt = Math.pow(f0 / 261.6, 0.35);
      const base = x.lp * kt * (0.55 + 0.6 * vel) * (0.7 + 0.6 * x.bright);
      for (let i = 0; i < n; i++) {
        if ((i & 15) === 0) { const fc = 250 + base * (0.35 + 0.65 * env[i]); fL.set(fc, 0.6); fR.set(fc, 0.6); }
        L[i] = fL.process(L[i]) * env[i]; R[i] = fR.process(R[i]) * env[i];
      }
      if (x.bow > 0) {
        const nz = C.noiseWhite(n, rng); new Biquad('bp', 3200, 0.8).run(nz);
        for (let i = 0; i < n; i++) { const v = nz[i] * env[i] * x.bow * vel; L[i] += v; R[i] += v; }
      }
      if (x.sub > 0) { let ph = 0; for (let i = 0; i < n; i++) { const v = Math.sin(TAU * ph) * x.sub * env[i]; L[i] += v; R[i] += v; ph += f0 / SR; } }
      C.eqBuf(L, BODY[x.body] || []); C.eqBuf(R, BODY[x.body] || []);
      const amp = 0.33 * x.gain * (0.35 + 0.65 * vel);
      C.scaleBuf(L, amp); C.scaleBuf(R, amp);
      return { L, R };
    },
  };
}
function makePad(o) {
  const cfg = P({ voices: 4, spread: 12, attack: 0.8, release: 1.6, lp: 1400, q: 0.8, gain: 1, sub: 0.25, vib: 3, tri: 0.3, sweep: 0 }, o);
  return {
    tail: cfg.release * 2 + 0.1,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 2 + 0.05) * SR);
      const { L, R } = sawEnsemble(n, f0, x.voices, x.spread, rng, { depth: x.vib, rate: 4.4, delay: 0.5, ramp: 1 }, 0.9, 2);
      if (x.tri > 0) { const t = C.oscTri(n, f0 * 0.5 * cents(rng.gauss(0, 2))); for (let i = 0; i < n; i++) { L[i] += t[i] * x.tri; R[i] += t[i] * x.tri; } }
      if (x.sub > 0) { let ph = 0; for (let i = 0; i < n; i++) { const v = Math.sin(TAU * ph) * x.sub; L[i] += v; R[i] += v; ph += f0 * 0.5 / SR; } }
      const env = C.adsr(n, x.attack, 1.0, 0.85, x.release, note.dur, { curve: 'sine' });
      const fL = new SVF(1000, x.q), fR = new SVF(1000, x.q);
      const kt = Math.pow(f0 / 261.6, 0.3);
      for (let i = 0; i < n; i++) {
        if ((i & 15) === 0) { const fc = x.lp * kt * (0.6 + 0.4 * env[i]) * (1 + x.sweep * Math.sin(TAU * 0.1 * i / SR)); fL.set(fc, x.q); fR.set(fc, x.q); }
        L[i] = fL.process(L[i]) * env[i]; R[i] = fR.process(R[i]) * env[i];
      }
      const amp = 0.3 * x.gain * (0.4 + 0.6 * vel);
      C.scaleBuf(L, amp); C.scaleBuf(R, amp);
      return { L, R };
    },
  };
}
const VOWELS = {
  oo: [[310, 1.0, 55], [760, 0.3, 80], [2300, 0.08, 120], [3000, 0.04, 150]],
  oh: [[430, 1.0, 65], [820, 0.45, 80], [2600, 0.1, 110], [3200, 0.05, 150]],
  ah: [[760, 1.0, 85], [1180, 0.6, 95], [2700, 0.22, 120], [3600, 0.09, 140]],
  mm: [[260, 1.0, 50], [1200, 0.05, 150], [2400, 0.02, 200]],
  ee: [[290, 1.0, 55], [2250, 0.35, 110], [2950, 0.25, 140], [3700, 0.1, 160]],
};
function makeChoir(o) {
  const cfg = P({ vowel: 'oo', voices: 5, spread: 11, attack: 0.45, release: 1.0, vib: 16, breath: 0.12, gain: 1, lp: 3800 }, o);
  return {
    tail: cfg.release * 2 + 0.1,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 2 + 0.05) * SR);
      const srcL = zeros(n), srcR = zeros(n);
      for (let v = 0; v < x.voices; v++) {
        const det = x.spread * (2 * v / Math.max(1, x.voices - 1) - 1) + rng.gauss(0, 2);
        const fr = vibFreq(n, f0 * cents(det), { depth: x.vib * (0.7 + 0.6 * rng.next()), rate: 4.8 + rng.uni(-0.5, 0.6), delay: 0.2 + rng.uni(0, 0.3), ramp: 0.6, drift: 4, jitter: 1.5, rng: rng.fork(v), ph: rng.next() * TAU });
        const s = C.oscSaw(n, fr, rng.next());
        const pan = (v % 2 ? 1 : -1) * (0.2 + 0.5 * rng.next());
        const [gl, gr] = C.panGains(pan);
        for (let i = 0; i < n; i++) { srcL[i] += s[i] * gl; srcR[i] += s[i] * gr; }
      }
      // glottal tilt
      lp(srcL, 1800, 0.6); lp(srcR, 1800, 0.6);
      const env = C.adsr(n, x.attack, 0.8, 0.9, x.release, note.dur, { curve: 'sine' });
      // breath noise
      const nzL = C.noiseWhite(n, rng), nzR = C.noiseWhite(n, rng);
      for (let i = 0; i < n; i++) { srcL[i] += nzL[i] * x.breath; srcR[i] += nzR[i] * x.breath; }
      const fm = VOWELS[x.vowel];
      const L = zeros(n), R = zeros(n);
      // raise F1 for high notes (singers tune F1 near f0)
      for (const [F, A, BW] of fm) {
        const Fe = Math.max(F, F === fm[0][0] ? f0 * 1.05 : F);
        const q = Fe / BW;
        const bl = new Biquad('bp', Fe, q), br = new Biquad('bp', Fe, q);
        for (let i = 0; i < n; i++) { L[i] += bl.process(srcL[i]) * A; R[i] += br.process(srcR[i]) * A; }
      }
      // a little unfiltered body so the fundamental speaks
      const lb = new Biquad('lp', Math.min(900, f0 * 2.2), 0.7), rb = new Biquad('lp', Math.min(900, f0 * 2.2), 0.7);
      for (let i = 0; i < n; i++) { L[i] = (L[i] * 2.2 + lb.process(srcL[i]) * 0.25) * env[i]; R[i] = (R[i] * 2.2 + rb.process(srcR[i]) * 0.25) * env[i]; }
      lp(L, x.lp); lp(R, x.lp);
      const amp = 0.28 * x.gain * (0.4 + 0.6 * vel) / Math.sqrt(x.voices);
      C.scaleBuf(L, amp); C.scaleBuf(R, amp);
      return { L, R };
    },
  };
}

// ======================================================================= ORGAN
function makeOrgan(o) {
  // drawbars: 16' 5 1/3' 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1'
  const cfg = P({ bars: [6, 0, 8, 5, 2, 3, 0, 0, 1], click: 0.3, perc: 0.3, attack: 0.006, release: 0.06, gain: 1, drive: 0 }, o);
  const ratios = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8];
  return {
    tail: cfg.release * 3 + 0.05,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 3 + 0.02) * SR);
      const out = zeros(n);
      let tot = 0;
      for (let k = 0; k < 9; k++) {
        const lvl = x.bars[k] / 8; if (!lvl) continue;
        const fk = f0 * ratios[k]; if (fk > C.NYQ * 0.9) continue;
        const a = lvl * lvl; tot += a;
        let ph = rng.next();
        for (let i = 0; i < n; i++) { out[i] += fsin(ph) * a; ph += fk / SR; }
      }
      C.scaleBuf(out, 1 / Math.max(1, tot * 0.6));
      if (x.perc) { let ph = 0; const k = Math.exp(-1 / (0.18 * SR)); let e = 1; for (let i = 0; i < n; i++) { out[i] += Math.sin(TAU * ph) * e * x.perc; ph += f0 * 3 / SR; e *= k; } }
      const env = C.adsr(n, x.attack, 0.01, 1, x.release, note.dur);
      for (let i = 0; i < n; i++) out[i] *= env[i];
      if (x.click) { const cl = Math.round(0.004 * SR); for (let i = 0; i < cl && i < n; i++) out[i] += rng.bi() * x.click * 0.3 * (1 - i / cl); }
      if (x.drive) FX.saturate(out, 1 + x.drive * 3, 1);
      C.scaleBuf(out, 0.3 * x.gain * (0.6 + 0.4 * vel));
      lp(out, 7000);
      return out;
    },
  };
}

// ======================================================================= BASSES & SYNTHS
function makeSineBass(o) {
  const cfg = P({ attack: 0.006, decay: 0.5, sustain: 0.65, release: 0.09, h2: 0.18, h3: 0.05, drive: 1.3, thump: 30, gain: 1, glide: 0 }, o);
  return {
    tail: cfg.release * 3,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 3 + 0.02) * SR);
      const out = zeros(n); let ph = 0;
      const env = C.adsr(n, x.attack, x.decay, x.sustain, x.release, note.dur, { curve: 'sine' });
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = f0 * Math.pow(2, (x.thump * Math.exp(-t / 0.025)) / 1200);
        const s = Math.sin(TAU * ph) + x.h2 * Math.sin(2 * TAU * ph + 0.3) + x.h3 * Math.sin(3 * TAU * ph);
        out[i] = Math.tanh(s * x.drive) / Math.tanh(x.drive) * env[i];
        ph += f / SR; if (ph > 1) ph -= 1;
      }
      C.scaleBuf(out, 0.5 * x.gain * (0.5 + 0.5 * vel));
      return out;
    },
  };
}
function makeSynthBass(o) {
  const cfg = P({ saw: 1, sq: 0.5, sub: 0.6, cutoff: 380, envAmt: 1800, fdecay: 0.14, q: 1.4, attack: 0.003, decay: 0.3, sustain: 0.7, release: 0.06, drive: 1.6, gain: 1, detune: 7, pw: 0.5 }, o);
  return {
    tail: cfg.release * 3,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 3 + 0.02) * SR);
      const a = C.oscSaw(n, f0 * cents(-x.detune / 2), rng.next());
      const b = C.oscSaw(n, f0 * cents(x.detune / 2), rng.next());
      const sq = C.oscPulse(n, f0, x.pw, rng.next());
      const sub = C.oscSine(n, f0 / 2);
      const env = C.adsr(n, x.attack, x.decay, x.sustain, x.release, note.dur);
      const f = new SVF(500, x.q);
      const out = zeros(n);
      for (let i = 0; i < n; i++) {
        if ((i & 7) === 0) { const t = i / SR; f.set(x.cutoff + x.envAmt * vel * Math.exp(-t / x.fdecay), x.q); }
        const s = (a[i] + b[i]) * 0.5 * x.saw + sq[i] * x.sq;
        let y = f.process(s) + sub[i] * x.sub;
        y = Math.tanh(y * x.drive) / Math.tanh(x.drive);
        out[i] = y * env[i];
      }
      C.scaleBuf(out, 0.42 * x.gain * (0.55 + 0.45 * vel));
      return out;
    },
  };
}
// brass-like: saw stack through envelope-following lowpass (+ FM blat) - tuba / horn / stabs
function makeBrass(o) {
  const cfg = P({ voices: 2, spread: 6, attack: 0.045, decay: 0.25, sustain: 0.75, release: 0.12, bright: 1, fm: 0.35, scoop: -40, gain: 1, lpBase: 350, lpEnv: 2600, body: 0 }, o);
  return {
    tail: cfg.release * 3,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 3 + 0.02) * SR);
      const env = C.adsr(n, x.attack, x.decay, x.sustain, x.release, note.dur, { curve: 'exp' });
      const out = zeros(n);
      for (let v = 0; v < x.voices; v++) {
        const det = x.voices > 1 ? x.spread * (2 * v / (x.voices - 1) - 1) : 0;
        const fr = vibFreq(n, f0 * cents(det), { depth: 7, rate: 5, delay: 0.3, ramp: 0.3, scoop: x.scoop, scoopT: 0.03, rng: rng.fork(v), ph: rng.next() * TAU });
        const s = C.oscSaw(n, fr, rng.next());
        for (let i = 0; i < n; i++) out[i] += s[i] / x.voices;
      }
      if (x.fm > 0) { // FM 1:1 blat layer
        let pc = 0, pm = 0;
        for (let i = 0; i < n; i++) { const I = x.fm * 3 * env[i] * vel; out[i] += 0.5 * Math.sin(TAU * pc + I * Math.sin(TAU * pm)); pc += f0 / SR; pm += f0 / SR; }
      }
      const f = new SVF(500, 0.9);
      const kt = Math.pow(f0 / 130, 0.5);
      for (let i = 0; i < n; i++) {
        if ((i & 7) === 0) f.set((x.lpBase + x.lpEnv * x.bright * env[i] * vel) * kt, 0.9);
        out[i] = f.process(out[i]) * env[i];
      }
      if (x.body) peq(out, 800, 0.8, x.body);
      C.scaleBuf(out, 0.45 * x.gain * (0.45 + 0.55 * vel));
      return out;
    },
  };
}

// ======================================================================= PHRASE (mono legato) INSTRUMENTS
// Build continuous control signals for a monophonic phrase.
function phraseControls(notes, o) {
  const p = P({ glide: 0.05, attack: 0.03, release: 0.12, vib: 12, vibRate: 5.3, vibDelay: 0.25, vibRamp: 0.35, scoop: 0, reattack: 0.35, jitter: 0 }, o);
  const last = notes[notes.length - 1];
  const n = Math.round((last.t + last.dur + p.release * 3 + 0.02) * SR);
  const freq = new Float32Array(n), amp = new Float32Array(n), vibEnv = new Float32Array(n), accent = new Float32Array(n);
  let ni = 0; let curF = notes[0].f;
  const on = notes.map((nt) => Math.round(nt.t * SR));
  const rng = new RNG(notes[0].seed || 3);
  let jit = 0;
  for (let i = 0; i < n; i++) {
    while (ni + 1 < notes.length && i >= on[ni + 1]) ni++;
    const nt = notes[ni];
    const tIn = (i - on[ni]) / SR;
    // pitch: glide on slurred notes
    let tf = nt.f;
    if (ni > 0 && nt.slur && tIn < p.glide * 4) {
      const pf = notes[ni - 1].f; const k = 1 - Math.exp(-tIn / (p.glide / 3));
      tf = pf * Math.pow(nt.f / pf, Math.min(1, k));
    } else if (!nt.slur && p.scoop && tIn < 0.2) tf = nt.f * Math.pow(2, p.scoop * Math.exp(-tIn / 0.035) / 1200);
    if (p.jitter) { if ((i & 63) === 0) jit = rng.gauss(0, p.jitter); tf *= Math.pow(2, jit / 1200); }
    curF = tf; freq[i] = curF;
    // amplitude
    const noteEnd = nt.t + nt.dur;
    const t = i / SR;
    let a;
    const lvl = nt.vel;
    if (t < noteEnd) {
      const att = nt.slur ? p.attack * 1.5 : p.attack;
      a = lvl * Math.min(1, tIn / att);
      if (!nt.slur && ni > 0) { const prev = notes[ni - 1]; if (prev.t + prev.dur >= nt.t - 0.01) a = lvl * (1 - p.reattack * Math.exp(-tIn / 0.03)); }
    } else {
      a = lvl * Math.exp(-(t - noteEnd) / (p.release / 2.3));
      if (ni + 1 < notes.length && on[ni + 1] - i < 1) a = 0;
    }
    amp[i] = a;
    vibEnv[i] = tIn < p.vibDelay ? 0 : Math.min(1, (tIn - p.vibDelay) / p.vibRamp);
    accent[i] = Math.exp(-tIn / 0.06) * (nt.slur ? 0.3 : 1);
  }
  // smooth amplitude (bellows / breath inertia)
  const sm = new OnePole(60); for (let i = 0; i < n; i++) amp[i] = sm.lp(amp[i]);
  // continuous vibrato
  let vph = rng.next();
  for (let i = 0; i < n; i++) { freq[i] *= Math.pow(2, (p.vib * vibEnv[i] * Math.sin(TAU * vph)) / 1200); vph += p.vibRate / SR; }
  return { n, freq, amp, vibEnv, accent };
}
function makeFlute(o) {
  const cfg = P({ breath: 0.08, chiff: 0.25, h2: 0.22, h3: 0.08, h4: 0.03, vib: 14, vibRate: 5.0, glide: 0.045, attack: 0.06, release: 0.12, gain: 1, lp: 7000, kind: 'flute', scoop: -25 }, o);
  return {
    phrase: true, tail: cfg.release * 3,
    renderPhrase(notes) {
      const x = cfg;
      const ctl = phraseControls(notes, { glide: x.glide, attack: x.attack, release: x.release, vib: x.vib, vibRate: x.vibRate, vibDelay: 0.22, vibRamp: 0.4, scoop: x.scoop, reattack: 0.45, jitter: 1.5 });
      const { n, freq, amp, accent } = ctl;
      const rng = new RNG(notes[0].seed);
      const out = zeros(n);
      let ph = 0;
      const nz = C.noiseWhite(n, rng);
      const bp = new SVF(1000, 2.5);
      const hs = new Biquad('hp', 2500, 0.7);
      for (let i = 0; i < n; i++) {
        const f = freq[i];
        const s = Math.sin(TAU * ph) + x.h2 * Math.sin(2 * TAU * ph + 0.4) + x.h3 * Math.sin(3 * TAU * ph + 1.1) + x.h4 * Math.sin(4 * TAU * ph);
        if ((i & 15) === 0) bp.set(Math.min(f * 2, 9000), 2.5);
        const breathTone = bp.process(nz[i]) * 0.5 + hs.process(nz[i]) * 0.3;
        const ch = accent[i] * x.chiff;
        out[i] = amp[i] * (s * (1 - 0.15 * ch) + breathTone * (x.breath + ch));
        ph += f / SR; if (ph > 1) ph -= 1;
      }
      lp(out, x.lp);
      C.scaleBuf(out, 0.35 * x.gain);
      return out;
    },
  };
}
function makeChipLead(o) {
  const cfg = P({ pw: 0.25, vib: 22, vibRate: 5.8, vibDelay: 0.16, glide: 0.035, attack: 0.004, release: 0.05, gain: 1, lp: 9000, tri: 0, echo: 0, duty2: 0 }, o);
  return {
    phrase: true, tail: cfg.release * 3,
    renderPhrase(notes) {
      const x = cfg;
      const ctl = phraseControls(notes, { glide: x.glide, attack: x.attack, release: x.release, vib: x.vib, vibRate: x.vibRate, vibDelay: x.vibDelay, vibRamp: 0.15, reattack: 0.8 });
      const { n, freq, amp } = ctl;
      const pwa = typeof x.pw === 'number' ? x.pw : 0.25;
      let out;
      if (x.tri) out = C.oscTri(n, freq); else out = C.oscPulse(n, freq, pwa, 0);
      if (x.duty2) { const b = C.oscPulse(n, freq, 0.125, 0.3); for (let i = 0; i < n; i++) out[i] = out[i] * (1 - x.duty2) + b[i] * x.duty2; }
      for (let i = 0; i < n; i++) out[i] *= amp[i];
      lp(out, x.lp); hp(out, 60);
      C.scaleBuf(out, 0.22 * x.gain);
      return out;
    },
  };
}
function makeAccordion(o) {
  const cfg = P({ musette: 11, reeds: 3, attack: 0.045, release: 0.09, gain: 1, glide: 0.02, vib: 0, bright: 1 }, o);
  // polyphonic per-note accordion (chords & melody)
  return {
    tail: cfg.release * 3,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((note.dur + x.release * 3 + 0.02) * SR);
      const out = zeros(n);
      const dets = x.reeds === 3 ? [0, x.musette, -x.musette * 0.8] : x.reeds === 2 ? [0, x.musette] : [0];
      for (let r = 0; r < dets.length; r++) {
        const fr = vibFreq(n, f0 * cents(dets[r]), { drift: 1.5, rng: rng.fork(r) });
        // reed: asymmetric pulse (rich odd+even)
        const s = C.oscPulse(n, fr, 0.32 + 0.06 * r, rng.next());
        const sw = C.oscSaw(n, fr, rng.next());
        for (let i = 0; i < n; i++) out[i] += (s[i] * 0.55 + sw[i] * 0.45) / dets.length;
      }
      // reed chamber formant
      peq(out, 1250, 1.2, 5 * x.bright); peq(out, 2900, 2, 3 * x.bright); lp(out, 5200 * (0.6 + 0.4 * x.bright)); hp(out, 120);
      const env = C.adsr(n, x.attack, 0.2, 0.92, x.release, note.dur, { curve: 'sine' });
      for (let i = 0; i < n; i++) out[i] *= env[i];
      C.scaleBuf(out, 0.2 * x.gain * (0.5 + 0.5 * vel));
      return out;
    },
  };
}
// plain soft sine/tri "lead" (whistle-like tones, drops)
function makeWhistle(o) {
  const cfg = P({ breath: 0.05, vib: 18, vibRate: 5.6, glide: 0.07, attack: 0.04, release: 0.1, gain: 1, scoop: -60 }, o);
  return {
    phrase: true, tail: cfg.release * 3,
    renderPhrase(notes) {
      const x = cfg;
      const ctl = phraseControls(notes, { glide: x.glide, attack: x.attack, release: x.release, vib: x.vib, vibRate: x.vibRate, vibDelay: 0.18, vibRamp: 0.3, scoop: x.scoop, reattack: 0.6, jitter: 3 });
      const { n, freq, amp } = ctl;
      const rng = new RNG(notes[0].seed);
      const out = zeros(n); let ph = 0;
      const nz = C.noiseWhite(n, rng); const bp = new SVF(2000, 4);
      for (let i = 0; i < n; i++) {
        const f = freq[i];
        if ((i & 15) === 0) bp.set(Math.min(f, 12000), 4);
        out[i] = amp[i] * (Math.sin(TAU * ph) + 0.04 * Math.sin(2 * TAU * ph) + bp.process(nz[i]) * x.breath * 3);
        ph += f / SR; if (ph > 1) ph -= 1;
      }
      C.scaleBuf(out, 0.3 * x.gain);
      return out;
    },
  };
}
// Soft plucky "pluck synth" (for bouncy plucks / chip arps)
function makeSynthPluck(o) {
  const cfg = P({ wave: 'saw', cutoff: 600, envAmt: 4000, fdecay: 0.09, decay: 0.35, q: 1.2, gain: 1, pw: 0.5, release: 0.05 }, o);
  return {
    tail: 0.1,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const len = Math.min(note.dur + x.release * 3, x.decay * 3) + 0.02;
      const n = Math.round(len * SR);
      const s = x.wave === 'saw' ? C.oscSaw(n, f0, rng.next()) : x.wave === 'tri' ? C.oscTri(n, f0, 0) : C.oscPulse(n, f0, x.pw, rng.next());
      const f = new SVF(500, x.q);
      const gate = Math.round(note.dur * SR); const rk = Math.exp(-1 / (x.release * SR / 4.6)); let rel = 1;
      const kd = Math.exp(-1 / (x.decay * SR / 4.6)); let e = 1;
      for (let i = 0; i < n; i++) {
        if ((i & 7) === 0) f.set(x.cutoff + x.envAmt * vel * Math.exp(-i / SR / x.fdecay), x.q);
        if (i > gate) rel *= rk;
        s[i] = f.process(s[i]) * e * rel * Math.min(1, i / 40);
        e *= kd;
      }
      C.scaleBuf(s, 0.35 * x.gain * (0.5 + 0.5 * vel));
      return s;
    },
  };
}
// tuned water-drop "plink" (upward chirp)
function makeDrop(o) {
  const cfg = P({ chirp: 0.25, decay: 0.09, gain: 1 }, o);
  return {
    tail: 0.05,
    render(note) {
      const f0 = fOf(note), vel = clamp(note.vel, 0.05, 1);
      const rng = new RNG(note.seed);
      const x = Object.assign({}, cfg, note.p || {});
      const n = Math.round((x.decay * 4 + 0.02) * SR);
      const out = zeros(n); let ph = 0;
      const ch = x.chirp * rng.uni(0.7, 1.3);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = f0 * (1 + ch * (1 - Math.exp(-t / 0.018)));
        out[i] = Math.sin(TAU * ph) * Math.exp(-t / x.decay) * Math.min(1, i / 20);
        ph += f / SR;
      }
      C.scaleBuf(out, 0.3 * x.gain * vel);
      return out;
    },
  };
}

module.exports = {
  vibFreq, phraseControls, BODY, ksCore,
  piano: makePiano, rhodes: makeRhodes, modal: makeModal, MODAL_DEFS, pluck: makePluck,
  strings: makeStrings, pad: makePad, choir: makeChoir, organ: makeOrgan,
  sineBass: makeSineBass, synthBass: makeSynthBass, brass: makeBrass,
  flute: makeFlute, chipLead: makeChipLead, accordion: makeAccordion, whistle: makeWhistle, synthPluck: makeSynthPluck, drop: makeDrop,
};
