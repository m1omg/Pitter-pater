'use strict';
// Dialogue text blips: 30-60 ms tonal blips with distinct timbres/pitches. The engine randomises pitch.
const K = require('./_kit');
const { N } = K;

// generic blip: f (Hz), len (s), timbre builder gets (n, freqCurve) -> Float32Array
function blip(o) {
  const len = o.len || 0.045, n = N(len);
  const bend = o.bend || 0; // cents over the blip
  const f = K.fcurve(n, [[0, o.f * Math.pow(2, (o.bendFrom || 0) / 1200)], [len, o.f * Math.pow(2, bend / 1200)]]);
  let s = o.timbre(n, f);
  if (o.lp) K.lp(s, o.lp);
  K.mul(s, K.gate(len, o.a || 0.003, o.r || len * 0.45, len));
  return s;
}

module.exports = {
  // default narrator: soft band-limited square, neutral pitch
  sfx_blip: {
    hp: 120,
    peak: -14,
    fn: () => blip({ f: 659, len: 0.045, lp: 2600, a: 0.003, timbre: (n, f) => K.osc('square', n, f) }),
  },
  // Pim: soft, mid-high, sine with a touch of 2nd harmonic and a tiny upward lilt
  sfx_blip_pim: {
    hp: 150,
    peak: -12,
    fn: () => blip({ f: 988, len: 0.04, bend: 40, a: 0.004, timbre: (n, f) => K.harm(n, f, [[1, 1], [2, 0.14], [3, 0.03]]) }),
  },
  // Biscuit (grumpy cat): lower, slightly raspy sawtooth with a little downward grumble
  sfx_blip_biscuit: {
    hp: 120,
    peak: -10,
    fn: () => blip({
      f: 311, len: 0.052, bend: -70, lp: 2600, a: 0.003,
      timbre: (n, f) => {
        const s = K.osc('saw', n, f);
        const p = K.osc('pulse', n, f, { pw: 0.35, ph: 0.2 });
        const rasp = K.noise(n, 7); K.lp(rasp, 700);
        for (let i = 0; i < n; i++) s[i] = (s[i] * 0.6 + p[i] * 0.4) * (1 + 0.55 * rasp[i]);
        const nz = K.noise(n, 8); K.bp(nz, 2600, 0.9);
        for (let i = 0; i < n; i++) s[i] += nz[i] * 0.1;
        K.pk(s, 900, 1.2, 3);
        return s;
      },
    }),
  },
  // Waffles (goofy dog): bouncy round "boop" - triangle/sine with an upward pitch bounce
  sfx_blip_waffles: {
    hp: 120,
    peak: -13.5,
    fn: () => blip({
      f: 523, len: 0.055, bendFrom: -120, bend: 260, a: 0.004,
      timbre: (n, f) => { const t = K.osc('tri', n, f), s = K.osc('sine', n, f); for (let i = 0; i < n; i++) s[i] = 0.6 * s[i] + 0.5 * t[i]; return s; },
    }),
  },
  // Momo (cloud sheep): airy, soft - high sine + breathy band noise, gentle attack
  sfx_blip_momo: {
    hp: 200,
    peak: -11.5,
    fn: () => blip({
      f: 1175, len: 0.055, bend: 25, a: 0.009, r: 0.025,
      timbre: (n, f) => {
        const s = K.osc('sine', n, f);
        const nz = K.noise(n, 12); K.bp(nz, 2350, 1.4); K.bp(nz, 2350, 1.4);
        for (let i = 0; i < n; i++) s[i] = s[i] * 0.75 + nz[i] * 0.9;
        return s;
      },
    }),
  },
  // Mom: warm low-mid, sine with soft 2nd/3rd harmonics
  sfx_blip_mom: {
    hp: 90,
    peak: -11.5,
    fn: () => blip({ f: 294, len: 0.055, bend: -15, lp: 1800, a: 0.005, timbre: (n, f) => K.harm(n, f, [[1, 1], [2, 0.38], [3, 0.16], [4, 0.05]]) }),
  },
  // big/scary: growly low voice at 110 Hz with formant emphasis (audible on small speakers)
  sfx_blip_low: {
    hp: 60,
    peak: -10,
    fn: () => blip({
      f: 110, len: 0.06, bend: -60, a: 0.004, r: 0.024,
      timbre: (n, f) => {
        const a = K.osc('saw', n, f), b = K.osc('pulse', n, f.map((x) => x * 1.004), { pw: 0.3 });
        const g = K.noise(n, 21); K.lp(g, 220);
        const s = new Float32Array(n);
        for (let i = 0; i < n; i++) s[i] = (a[i] * 0.6 + b[i] * 0.4) * (1 + 0.8 * g[i]);
        const o = K.formants(s, [{ f: 520, bw: 110, g: 1 }, { f: 1050, bw: 160, g: 0.55 }, { f: 2300, bw: 260, g: 0.18 }]);
        for (let i = 0; i < n; i++) o[i] = o[i] * 2.2 + s[i] * 0.12;
        K.hp(o, 80); K.lp(o, 3200);
        return K.sat(o, 1.8);
      },
    }),
  },
  // tiny creatures: very high chirpy sine
  sfx_blip_high: {
    hp: 300,
    peak: -14,
    fn: () => blip({ f: 1976, len: 0.032, bendFrom: -80, bend: 300, a: 0.003, r: 0.014, timbre: (n, f) => K.harm(n, f, [[1, 1], [2, 0.08]]) }),
  },
};
