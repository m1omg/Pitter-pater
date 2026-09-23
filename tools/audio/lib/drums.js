'use strict';
// Percussion synthesis. Each maker returns an instrument {tail, render(note)} where note.vel, note.seed
// and note.p (per-hit params) are used; note.m may set pitch for tuned drums (toms, timpani, blocks).
const C = require('./core');
const FX = require('./fx');
const { SR, TAU, clamp, zeros, RNG, Biquad, mtof } = C;
const P = (d, o) => Object.assign({}, d, o || {});

function env(n, a, t60) { const e = zeros(n); const k = Math.pow(10, -3 / (t60 * SR)); let v = 1; const na = Math.max(1, Math.round(a * SR)); for (let i = 0; i < n; i++) { e[i] = v * (i < na ? i / na : 1); v *= k; } return e; }
function noiseBuf(n, rng) { return C.noiseWhite(n, rng); }

function makeKick(o) {
  const cfg = P({ f0: 48, f1: 135, pdecay: 0.032, decay: 0.42, click: 0.35, drive: 1.6, gain: 1, lp: 7000, sub: 0 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round((x.decay * 1.3 + 0.05) * SR);
      const out = zeros(n); let ph = 0;
      const e = env(n, 0.0015, x.decay);
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const f = x.f0 + (x.f1 - x.f0) * Math.exp(-t / x.pdecay);
        out[i] = Math.sin(TAU * ph) * e[i];
        ph += f / SR;
      }
      if (x.sub) { let p2 = 0; for (let i = 0; i < n; i++) { out[i] += Math.sin(TAU * p2) * x.sub * e[i] * Math.min(1, i / 400); p2 += x.f0 / SR; } }
      // click
      const cl = Math.round(0.006 * SR); const ck = zeros(cl);
      for (let i = 0; i < cl; i++) ck[i] = rng.bi() * Math.exp(-i / (0.0012 * SR));
      new Biquad('bp', 3200, 0.8).run(ck);
      for (let i = 0; i < cl; i++) out[i] += ck[i] * x.click * 1.5;
      FX.saturate(out, x.drive, 1);
      new Biquad('lp', x.lp, 0.7).run(out);
      C.scaleBuf(out, 0.75 * x.gain * Math.pow(vel, 1.2));
      C.fadeOut(out, 200);
      return out;
    },
  };
}
function makeSnare(o) {
  const cfg = P({ f: 185, body: 0.6, noise: 0.85, decay: 0.17, bdecay: 0.07, hp: 1100, lp: 9000, gain: 1, ring: 0, drive: 1.2, snap: 1 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round((x.decay * 1.4 + 0.05) * SR);
      const out = zeros(n);
      let p1 = 0, p2 = 0;
      const eb = env(n, 0.0008, x.bdecay);
      for (let i = 0; i < n; i++) {
        const t = i / SR; const pf = 1 + 0.25 * Math.exp(-t / 0.012);
        out[i] = (Math.sin(TAU * p1) * 0.65 + Math.sin(TAU * p2) * 0.35) * eb[i] * x.body;
        p1 += x.f * pf / SR; p2 += x.f * 1.78 * pf / SR;
      }
      const nz = noiseBuf(n, rng);
      new Biquad('hp', x.hp, 0.7).run(nz); new Biquad('lp', x.lp, 0.7).run(nz);
      const en = env(n, 0.0005, x.decay * (0.8 + 0.3 * vel));
      for (let i = 0; i < n; i++) out[i] += nz[i] * en[i] * x.noise * (0.7 + 0.3 * x.snap * vel);
      if (x.ring) { let p3 = 0; const er = env(n, 0.001, 0.22); for (let i = 0; i < n; i++) { out[i] += Math.sin(TAU * p3) * er[i] * x.ring; p3 += 880 / SR; } }
      FX.saturate(out, x.drive, 1);
      C.scaleBuf(out, 0.6 * x.gain * Math.pow(vel, 1.1));
      C.fadeOut(out, 200);
      return out;
    },
  };
}
// brush tap / slap
function makeBrush(o) {
  const cfg = P({ decay: 0.11, attack: 0.004, fc: 3800, q: 0.6, gain: 1 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round((x.decay * 1.5 + 0.03) * SR);
      const out = noiseBuf(n, rng);
      new Biquad('bp', x.fc, x.q).run(out); new Biquad('hp', 900, 0.7).run(out);
      const e = env(n, x.attack, x.decay);
      for (let i = 0; i < n; i++) out[i] *= e[i];
      // tiny body thump
      let ph = 0; for (let i = 0; i < Math.min(n, 2000); i++) { out[i] += Math.sin(TAU * ph) * Math.exp(-i / (0.01 * SR)) * 0.25; ph += 200 / SR; }
      C.scaleBuf(out, 0.6 * x.gain * vel);
      C.fadeOut(out, 100);
      return out;
    },
  };
}
// brush sweep: a swishing noise over the note duration
function makeSweep(o) {
  const cfg = P({ fc: 4500, gain: 1 }, o);
  return {
    tail: 0.05,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round((note.dur + 0.05) * SR);
      const out = noiseBuf(n, rng);
      const f = new C.SVF(x.fc, 0.9);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        if ((i & 15) === 0) f.set(x.fc * (0.7 + 0.5 * Math.sin(Math.PI * t)), 0.9);
        f.process(out[i]);
        out[i] = f.band * Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin(TAU * t * 2 + 1));
      }
      new Biquad('hp', 1200, 0.7).run(out);
      C.scaleBuf(out, 0.5 * x.gain * vel);
      return out;
    },
  };
}
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(n, rng, scale = 1) {
  const out = zeros(n);
  for (const f of HAT_FREQS) { const s = C.oscPulse(n, f * scale * (1 + rng.uni(-0.01, 0.01)), 0.5, rng.next()); for (let i = 0; i < n; i++) out[i] += s[i]; }
  return out;
}
function makeHat(o) {
  const cfg = P({ decay: 0.045, open: false, fc: 9000, metal: 0.5, gain: 1, lp: 14000 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const dec = x.open ? Math.max(0.25, x.decay) : x.decay * (0.8 + 0.4 * vel);
      const n = Math.round((dec * 1.5 + 0.02) * SR);
      const nz = noiseBuf(n, rng);
      const mt = metal(n, rng, 1.8);
      const out = zeros(n);
      for (let i = 0; i < n; i++) out[i] = nz[i] * (1 - x.metal) + mt[i] * 0.15 * x.metal;
      new Biquad('bp', x.fc, 0.9).run(out); new Biquad('hp', 6000, 0.7).run(out); new Biquad('lp', x.lp, 0.7).run(out);
      const e = env(n, 0.0005, dec);
      for (let i = 0; i < n; i++) out[i] *= e[i];
      C.scaleBuf(out, 0.9 * x.gain * vel);
      C.fadeOut(out, 64);
      return out;
    },
  };
}
function makeShaker(o) {
  const cfg = P({ decay: 0.07, attack: 0.012, fc: 6500, gain: 1 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round((x.decay * 1.6 + x.attack + 0.02) * SR);
      const out = noiseBuf(n, rng);
      new Biquad('bp', x.fc, 1.1).run(out); new Biquad('hp', 3500, 0.7).run(out);
      const na = Math.round(x.attack * SR); const k = Math.pow(10, -3 / (x.decay * SR));
      let v = 1;
      for (let i = 0; i < n; i++) { const a = i < na ? Math.pow(i / na, 2) : (v *= k); out[i] *= a; }
      // granular grit
      for (let i = 0; i < n; i++) out[i] *= 0.7 + 0.6 * (rng.next() < 0.3 ? 1 : 0.3);
      C.scaleBuf(out, 0.55 * x.gain * vel);
      C.fadeOut(out, 64);
      return out;
    },
  };
}
// wood block / clock tick / rim: two damped modes + click
function makeBlock(o) {
  const cfg = P({ f: 950, ratio: 2.62, decay: 0.06, click: 0.4, gain: 1, second: 0.35 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const f = note.m !== undefined ? mtof(note.m) : x.f;
      const n = Math.round((x.decay * 1.6 + 0.02) * SR);
      const out = zeros(n);
      C.addModes(out, [{ f, a: 1, t60: x.decay }, { f: f * x.ratio, a: x.second, t60: x.decay * 0.5 }, { f: f * 4.1, a: 0.1, t60: x.decay * 0.25 }]);
      const cl = Math.round(0.003 * SR);
      for (let i = 0; i < cl && i < n; i++) out[i] += rng.bi() * (1 - i / cl) * x.click;
      new Biquad('hp', f * 0.5, 0.7).run(out);
      C.scaleBuf(out, 0.45 * x.gain * vel);
      C.fadeOut(out, 64);
      return out;
    },
  };
}
function makeTom(o) {
  const cfg = P({ f: 110, bend: 0.5, decay: 0.45, noise: 0.25, drive: 1.4, gain: 1 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const f0 = note.m !== undefined ? mtof(note.m) : x.f;
      const n = Math.round((x.decay * 1.3 + 0.05) * SR);
      const out = zeros(n); let p1 = 0, p2 = 0;
      const e = env(n, 0.001, x.decay);
      for (let i = 0; i < n; i++) {
        const t = i / SR; const f = f0 * (1 + x.bend * Math.exp(-t / 0.05));
        out[i] = (Math.sin(TAU * p1) + 0.3 * Math.sin(TAU * p2)) * e[i];
        p1 += f / SR; p2 += f * 1.58 / SR;
      }
      const nz = noiseBuf(Math.round(0.04 * SR), rng); new Biquad('bp', 1500, 0.8).run(nz);
      for (let i = 0; i < nz.length && i < n; i++) out[i] += nz[i] * Math.exp(-i / (0.008 * SR)) * x.noise;
      FX.saturate(out, x.drive, 1);
      C.scaleBuf(out, 0.6 * x.gain * vel);
      C.fadeOut(out, 128);
      return out;
    },
  };
}
function makeClap(o) {
  const cfg = P({ fc: 1400, decay: 0.14, gain: 1, bursts: 4 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round((x.decay * 1.5 + 0.06) * SR);
      const nz = noiseBuf(n, rng);
      new Biquad('bp', x.fc, 1.0).run(nz); new Biquad('hp', 600, 0.7).run(nz);
      const out = zeros(n);
      const offs = [0, 0.009, 0.018, 0.029].slice(0, x.bursts);
      for (const o2 of offs) { const s = Math.round(o2 * SR); for (let i = s; i < n; i++) out[i] += nz[i] * Math.exp(-(i - s) / (0.0035 * SR)) * 0.8; }
      const s = Math.round(offs[offs.length - 1] * SR); for (let i = s; i < n; i++) out[i] += nz[i] * Math.exp(-(i - s) / (x.decay / 6.9 * SR));
      C.scaleBuf(out, 0.6 * x.gain * vel);
      C.fadeOut(out, 128);
      return out;
    },
  };
}
// crash / ride / splash cymbals
function makeCymbal(o) {
  const cfg = P({ decay: 2.2, kind: 'crash', gain: 1, lp: 13000, swell: 0 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const dec = x.decay * (0.7 + 0.4 * vel);
      const n = Math.round((dec * 1.2 + 0.05) * SR);
      const out = zeros(n);
      const nz = noiseBuf(n, rng);
      new Biquad('hp', x.kind === 'ride' ? 5000 : 3500, 0.7).run(nz);
      const e = env(n, 0.001, dec);
      for (let i = 0; i < n; i++) out[i] = nz[i] * e[i] * (x.kind === 'ride' ? 0.35 : 0.7);
      const modes = [];
      const cnt = 36;
      for (let k = 0; k < cnt; k++) {
        const f = 350 * Math.pow(2, rng.uni(0, 5.2));
        modes.push({ f, a: rng.uni(0.2, 1) * (f < 2000 ? 0.5 : 1) / Math.sqrt(cnt), t60: dec * rng.uni(0.3, 1.0) * (f > 8000 ? 0.6 : 1), ph: rng.next() * TAU });
      }
      if (x.kind === 'ride') { modes.push({ f: 3150, a: 0.5, t60: dec * 0.9 }, { f: 4870, a: 0.3, t60: dec * 0.7 }); }
      const md = zeros(n); C.addModes(md, modes);
      for (let i = 0; i < n; i++) out[i] += md[i] * (x.kind === 'ride' ? 0.8 : 0.5);
      new Biquad('lp', x.lp, 0.7).run(out);
      // bloom: crash swells slightly after impact
      if (x.kind === 'crash') { const na = Math.round(0.012 * SR); for (let i = 0; i < na && i < n; i++) out[i] *= 0.6 + 0.4 * i / na; }
      C.scaleBuf(out, 0.5 * x.gain * vel);
      C.fadeOut(out, 2000);
      return out;
    },
  };
}
// reversed cymbal / noise swell of note.dur seconds ending at the note's end
function makeSwell(o) {
  const cfg = P({ gain: 1, fc0: 1500, fc1: 9000, noise: 1, metal: 0.4 }, o);
  return {
    tail: 0.05,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round(note.dur * SR);
      const out = noiseBuf(n, rng);
      const mt = metal(n, rng, 2.3);
      const f = new C.SVF(1000, 0.8);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        if ((i & 15) === 0) f.set(x.fc0 * Math.pow(x.fc1 / x.fc0, t), 0.8);
        f.process(out[i] * x.noise + mt[i] * 0.08 * x.metal);
        out[i] = (f.band * 0.7 + f.high * 0.3) * Math.pow(t, 2.5);
      }
      C.fadeOut(out, 300);
      C.scaleBuf(out, 0.5 * x.gain * vel);
      return out;
    },
  };
}
function makeTimpani(o) {
  const cfg = P({ decay: 2.2, gain: 1, mallet: 0.3 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const f0 = mtof(note.m !== undefined ? note.m : 45);
      const n = Math.round((x.decay * 1.1 + 0.05) * SR);
      const out = zeros(n);
      C.addModes(out, [
        { f: f0, a: 1, t60: x.decay }, { f: f0 * 1.504, a: 0.6, t60: x.decay * 0.7 }, { f: f0 * 1.742, a: 0.35, t60: x.decay * 0.5 },
        { f: f0 * 2.0, a: 0.3, t60: x.decay * 0.45 }, { f: f0 * 2.245, a: 0.15, t60: x.decay * 0.35 }, { f: f0 * 0.6, a: 0.25, t60: 0.25 },
      ]);
      const nl = Math.round(0.03 * SR); const nz = noiseBuf(nl, rng); new Biquad('lp', 900, 0.7).run(nz);
      for (let i = 0; i < nl; i++) out[i] += nz[i] * Math.exp(-i / (0.006 * SR)) * x.mallet;
      const na = Math.round(0.003 * SR); for (let i = 0; i < na; i++) out[i] *= i / na;
      C.scaleBuf(out, 0.5 * x.gain * Math.pow(vel, 1.1));
      C.fadeOut(out, 500);
      return out;
    },
  };
}
// heartbeat: lub-dub low thumps
function makeHeart(o) {
  const cfg = P({ gain: 1, gap: 0.16, f: 48 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1);
      const n = Math.round((x.gap + 0.45) * SR);
      const out = zeros(n);
      const thump = (start, amp, f) => {
        let ph = 0; const s = Math.round(start * SR);
        for (let i = 0; i < Math.round(0.28 * SR) && s + i < n; i++) {
          const t = i / SR; const e = (1 - Math.exp(-t / 0.008)) * Math.exp(-t / 0.06);
          out[s + i] += Math.sin(TAU * ph) * e * amp; ph += f * (1 + 0.6 * Math.exp(-t / 0.03)) / SR;
        }
      };
      thump(0, 1, x.f); thump(x.gap, 0.7, x.f * 1.15);
      new Biquad('lp', 180, 0.7).run(out);
      FX.saturate(out, 1.5, 1);
      C.scaleBuf(out, 0.9 * x.gain * vel);
      return out;
    },
  };
}
// triangle (the percussion instrument)
function makeTriangle(o) {
  const cfg = P({ decay: 2.5, gain: 1, f: 1250 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1);
      const n = Math.round((x.decay * 1.1) * SR); const out = zeros(n); const f = x.f;
      C.addModes(out, [{ f, a: 0.5, t60: x.decay }, { f: f * 2.76, a: 0.4, t60: x.decay * 0.8 }, { f: f * 4.1, a: 0.35, t60: x.decay * 0.7 }, { f: f * 5.9, a: 0.25, t60: x.decay * 0.6 }, { f: f * 7.6, a: 0.15, t60: x.decay * 0.5 }]);
      C.scaleBuf(out, 0.3 * x.gain * vel); C.fadeOut(out, 400);
      return out;
    },
  };
}
// tam-tam / gong: dense inharmonic, slow bloom
function makeGong(o) {
  const cfg = P({ decay: 5, gain: 1, f: 70, bloom: 0.35 }, o);
  return {
    tail: 0,
    render(note) {
      const x = Object.assign({}, cfg, note.p || {}); const vel = clamp(note.vel, 0.05, 1); const rng = new RNG(note.seed);
      const n = Math.round(x.decay * 1.1 * SR); const out = zeros(n);
      const modes = [];
      for (let k = 0; k < 60; k++) { const f = x.f * Math.pow(2, rng.uni(0, 6)); modes.push({ f, a: rng.uni(0.3, 1) / (1 + f / 2500), t60: x.decay * rng.uni(0.4, 1) * (f > 3000 ? 0.5 : 1), ph: rng.next() * TAU }); }
      C.addModes(out, modes);
      // bloom: high partials grow after hit
      const hp = Float32Array.from(out); new Biquad('hp', 1500, 0.7).run(hp);
      for (let i = 0; i < n; i++) { const t = i / SR; const b = x.bloom * (1 - Math.exp(-t / 0.5)) * Math.exp(-t / (x.decay * 0.3)); out[i] = out[i] * (0.6 + 0.4 * Math.min(1, t / 0.05)) + hp[i] * b * 3; }
      C.scaleBuf(out, 0.4 * x.gain * vel / Math.sqrt(10)); C.fadeOut(out, 2000);
      return out;
    },
  };
}

module.exports = {
  kick: makeKick, snare: makeSnare, brush: makeBrush, sweep: makeSweep, hat: makeHat, shaker: makeShaker, block: makeBlock,
  tom: makeTom, clap: makeClap, cymbal: makeCymbal, swell: makeSwell, timpani: makeTimpani, heart: makeHeart, triangle: makeTriangle, gong: makeGong,
};
