'use strict';
// amb_wind - wind around the attic (seamless 36 s loop): a broadband rush whose brightness follows the
// gusts, resonant "howl" bands whose pitch rises with gust strength (whistling through gaps), low
// buffeting of the roof, a small wooden-room reverb, and a few soft stick-slip wood creaks placed on
// the strongest gusts.
const S = require('../lib/song');
const C = require('../lib/core');
const A = require('../lib_amb/ambkit');

const LOOP = 36;
// gust strength 0..1 (periodic): slow LFO + a little circular smooth noise, shaped to be peaky
function gustCurve(n) {
  const v = A.lfo(n, new C.RNG(8080), 1, 11, 7);   // irregular sum of slow components
  const f = A.smooth(n, new C.RNG(8083), 0.35);     // slow random wander (unit std)
  const t = A.smooth(n, new C.RNG(8082), 2.5);      // faster turbulence
  return Float32Array.from(v, (x, i) => Math.pow(Math.min(1, Math.max(0.06, 0.52 + 0.3 * x + 0.12 * f[i] + 0.035 * t[i])), 1.2));
}
const room = { t60: 1.1, predelay: 0.012, er: 0.35, hp: 150, lp: 5000, seed: 41 };

module.exports = {
  id: 'amb_wind', type: 'amb',
  build() {
    const song = new S.Song({ id: 'amb_wind', bpm: 60, meter: 1, loopBars: LOOP, loop: true, target: -26, tailSec: 2, seed: 505, hp: 25, master: { lp: 8000 } });
    song.bed('rush', (n, rng) => {
      const g = gustCurve(n);
      const fc = Float32Array.from(g, (v) => 420 + 2200 * Math.pow(v, 1.3));
      const st = A.stereoOf(() => {
        const x = A.svf(A.pink(n, rng), fc, 0.6, 'lp');
        for (let i = 0; i < n; i++) x[i] *= 0.35 + 0.65 * g[i];
        return A.chain(x, [['hp', 90, 0.7], ['hp', 80, 0.7]]);
      });
      A.circReverb(st.L, st.R, room, 0.25);
      return A.normRms(st, 0.05);
    }, { gain: 0 });
    song.bed('howl', (n, rng) => {
      const g = gustCurve(n);
      const bases = [[330, 505, 760], [350, 480, 805]];
      const wts = [1, 0.6, 0.35];
      const st = A.stereoOf((ch) => {
        const src = A.white(n, rng);
        const out = C.zeros(n);
        bases[ch].forEach((b, k) => {
          const wob = A.lfo(n, rng, 2, 9, 3);
          const fc = Float32Array.from(g, (v, i) => b * (0.8 + 0.5 * v) * (1 + 0.05 * wob[i]));
          const y = A.svf(src, fc, 9, 'bp');
          for (let i = 0; i < n; i++) out[i] += y[i] * wts[k];
        });
        for (let i = 0; i < n; i++) out[i] *= Math.pow(g[i], 1.8);
        return out;
      });
      A.circReverb(st.L, st.R, room, 0.3);
      return A.normRms(st, 0.05);
    }, { gain: -7 });
    song.bed('buffet', (n, rng) => {
      const g = gustCurve(n);
      const st = A.stereoOf(() => { const x = A.chain(A.brown(n, rng, 30), [['hp', 45, 0.7], ['hp', 40, 0.7], ['lp', 100, 0.7]]); for (let i = 0; i < n; i++) x[i] *= 0.3 + 0.7 * g[i]; return x; });
      return A.normRms(st, 0.05);
    }, { gain: -16 });
    // soft wood creaks on the strongest gusts
    song.bed('creaks', (n, rng) => {
      const g = gustCurve(n);
      const L = C.zeros(n), R = C.zeros(n);
      // local maxima of the gust curve, strongest first, at least 5 s apart
      const peaks = [];
      const hop = Math.round(0.05 * C.SR);
      for (let i = 0; i < n; i += hop) {
        const a = g[(i - hop + n) % n], b = g[i], c = g[(i + hop) % n];
        if (b >= a && b >= c && b > 0.45) peaks.push([i, b]);
      }
      peaks.sort((x, y) => y[1] - x[1]);
      const chosen = [];
      for (const p of peaks) { if (chosen.every((q) => Math.min(Math.abs(q - p[0]), n - Math.abs(q - p[0])) > 5 * C.SR)) chosen.push(p[0]); if (chosen.length >= 4) break; }
      chosen.forEach((pos, k) => {
        const cr = A.creak(rng, rng.uni(0.5, 1.3), { rate: rng.uni(60, 140) });
        A.place(L, R, cr, pos + Math.round(rng.uni(0.1, 0.6) * C.SR), rng.uni(-0.6, 0.6), 0.55 + 0.45 * rng.next());
        if (k % 2 === 0) { // a smaller answering creak a moment later
          const c2 = A.creak(rng, rng.uni(0.25, 0.6), { rate: rng.uni(80, 170) });
          A.place(L, R, c2, pos + Math.round(rng.uni(1.2, 2.2) * C.SR), rng.uni(-0.6, 0.6), 0.35);
        }
      });
      A.circReverb(L, R, { t60: 0.7, predelay: 0.008, er: 0.4, hp: 120, lp: 4000, seed: 42 }, 0.4);
      const st = { L: A.chain(L, [['lp', 3200, 0.7], ['hp', 90, 0.7]]), R: A.chain(R, [['lp', 3200, 0.7], ['hp', 90, 0.7]]) };
      return A.normPeak(st, 0.3);
    }, { gain: -9 });
    return song;
  },
};
