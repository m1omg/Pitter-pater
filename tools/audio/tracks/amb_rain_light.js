'use strict';
// amb_rain_light - gentle rain on a window, heard from inside (seamless 32 s loop).
// Layers (all exactly periodic beds): muffled outside wash, faint air, low thrum, a dense granular
// "micro" layer of distant drops, crisp drops ticking on the glass, and a few soft drips/plinks.
// A shared slow intensity curve (integer cycles per loop) makes wash and drop density breathe together.
const S = require('../lib/song');
const C = require('../lib/core');
const A = require('../lib_amb/ambkit');

const LOOP = 32;
const swell = (n) => A.lfo(n, new C.RNG(9001), 1, 4, 3);
const lpChain = (st, specs) => { st.L = A.chain(st.L, specs); st.R = A.chain(st.R, specs); return st; };

module.exports = {
  id: 'amb_rain_light', type: 'amb',
  build() {
    const song = new S.Song({ id: 'amb_rain_light', bpm: 60, meter: 1, loopBars: LOOP, loop: true, target: -26, tailSec: 2, seed: 501, hp: 25, master: { lp: 9000 } });
    // rain outside, softened by the window glass
    song.bed('wash', (n, rng) => {
      const sw = swell(n);
      const st = A.stereoOf(() => {
        const x = A.chain(A.pink(n, rng), [['hp', 280, 0.7], ['peak', 2200, 0.7, 2.5], ['lp', 4600, 0.7], ['lp', 5200, 0.7]]);
        const fl = A.smooth(n, rng, 3);
        for (let i = 0; i < n; i++) x[i] *= Math.pow(10, (1.6 * sw[i] + 0.6 * fl[i]) / 20);
        return x;
      });
      return A.normRms(st, 0.05);
    }, { gain: 0 });
    // a little high air so it doesn't sound boxed in
    song.bed('air', (n, rng) => A.normRms(A.stereoOf(() => A.chain(A.white(n, rng), [['hp', 3500, 0.7], ['lp', 8500, 0.7], ['lp', 9000, 0.7]])), 0.05), { gain: -17 });
    // low thrum of rain on walls / roof
    song.bed('body', (n, rng) => A.normRms(A.stereoOf(() => A.chain(A.brown(n, rng, 70), [['hp', 70, 0.7], ['hp', 60, 0.7], ['lp', 260, 0.7]])), 0.05), { gain: -12 });
    // countless tiny distant drops -> granular texture
    song.bed('micro', (n, rng) => {
      const sw = swell(n); const env = Float32Array.from(sw, (v) => 0.75 + 0.25 * v);
      const st = A.scatter(n, rng, 240, (r) => ({ buf: A.tick(r, { f: r.uni(1500, 5000), dec: r.uni(0.0015, 0.004), tone: r.uni(0, 0.2) }), pan: r.uni(-1, 1), gain: Math.pow(r.next(), 2.5) }), { env });
      lpChain(st, [['lp', 3800, 0.7], ['hp', 500, 0.7]]);
      return A.normRms(st, 0.05);
    }, { gain: -6 });
    // drops ticking on the window pane (close, crisp but tamed)
    song.bed('patter', (n, rng) => {
      const sw = swell(n); const env = Float32Array.from(sw, (v) => 0.7 + 0.3 * v);
      const st = A.scatter(n, rng, 20, (r) => ({ buf: A.tick(r, { f: r.uni(1800, 5200) }), pan: r.uni(-0.85, 0.85), gain: 0.1 + 0.8 * Math.pow(r.next(), 2.6) }), { env });
      lpChain(st, [['lp', 6000, 0.7], ['hp', 700, 0.7]]);
      A.circReverb(st.L, st.R, { t60: 0.45, predelay: 0.004, er: 0.3, hp: 400, lp: 7000, seed: 11 }, 0.18);
      A.normRms(st, 0.05);
      return A.normRms(A.softClip(st, 0.22), 0.05);
    }, { gain: -5 });
    // occasional bigger drips / plinks from the gutter and sill
    song.bed('drips', (n, rng) => {
      const st = A.scatter(n, rng, 0.28, (r) => ({ buf: r.chance(0.6) ? A.plink(r) : A.splat(r, { fc: r.uni(700, 1600) }), pan: r.uni(-0.7, 0.7), gain: r.uni(0.3, 1) }));
      A.circReverb(st.L, st.R, { t60: 0.9, predelay: 0.01, er: 0.3, hp: 300, lp: 6000, seed: 12 }, 0.35);
      lpChain(st, [['lp', 6000, 0.7]]);
      return A.normPeak(st, 0.2);
    }, { gain: -6 });
    return song;
  },
};
