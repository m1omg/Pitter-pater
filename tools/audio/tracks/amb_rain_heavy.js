'use strict';
// amb_rain_heavy - a downpour with gusts and two distant thunder rolls (seamless 40 s loop).
// Layers: broadband wash whose brightness/level/stereo position follow a shared gust curve, a mid
// "roar", roof rumble, air, dense patter + splats on hard surfaces, a bubbling gutter on one side and
// two rolls of distant thunder (low-passed noise made of many overlapping rumbles, in a big dark space).
const S = require('../lib/song');
const C = require('../lib/core');
const A = require('../lib_amb/ambkit');

const LOOP = 40;
const gust = (n) => A.lfo(n, new C.RNG(7070), 2, 6, 4);   // -1..1, shared by all layers
const drift = (n) => A.lfo(n, new C.RNG(7071), 1, 3, 2);  // slow stereo drift
const lpChain = (st, specs) => { st.L = A.chain(st.L, specs); st.R = A.chain(st.R, specs); return st; };

module.exports = {
  id: 'amb_rain_heavy', type: 'amb',
  build() {
    const song = new S.Song({ id: 'amb_rain_heavy', bpm: 60, meter: 1, loopBars: LOOP, loop: true, target: -26, tailSec: 2, seed: 502, hp: 25, master: { lp: 9500 } });
    song.bed('wash', (n, rng) => {
      const g = gust(n), d = drift(n);
      const fc = Float32Array.from(g, (v) => 5200 * Math.pow(2, 0.45 * v));
      const st = A.stereoOf((ch) => {
        let x = A.chain(A.pink(n, rng), [['hp', 160, 0.7], ['peak', 1800, 0.7, 2]]);
        x = A.svf(x, fc, 0.6, 'lp');
        x = A.chain(x, [['lp', 7500, 0.7]]);
        const fl = A.smooth(n, rng, 4);
        const side = ch ? -1 : 1;
        for (let i = 0; i < n; i++) x[i] *= Math.pow(10, (2.5 * g[i] + 0.7 * fl[i] + 1.2 * side * d[i]) / 20);
        return x;
      });
      return A.normRms(st, 0.05);
    }, { gain: 0 });
    song.bed('roar', (n, rng) => {
      const g = gust(n);
      const st = A.stereoOf(() => { const x = A.chain(A.pink(n, rng), [['bp', 650, 0.5], ['lp', 2400, 0.7]]); return A.mulEnv(x, g, 3); });
      return A.normRms(st, 0.05);
    }, { gain: -5 });
    song.bed('rumble', (n, rng) => {
      const g = gust(n);
      const st = A.stereoOf(() => { const x = A.chain(A.brown(n, rng, 40), [['hp', 50, 0.7], ['hp', 45, 0.7], ['lp', 150, 0.7]]); return A.mulEnv(x, g, 2); });
      return A.normRms(st, 0.05);
    }, { gain: -12 });
    song.bed('air', (n, rng) => {
      const g = gust(n);
      const st = A.stereoOf(() => A.mulEnv(A.chain(A.white(n, rng), [['hp', 4000, 0.7], ['lp', 8500, 0.7], ['lp', 9000, 0.7]]), g, 2));
      return A.normRms(st, 0.05);
    }, { gain: -15 });
    // dense drops and splats on sills, roof and puddles
    song.bed('patter', (n, rng) => {
      const g = gust(n); const env = Float32Array.from(g, (v) => 0.65 + 0.35 * v);
      const a = A.scatter(n, rng, 110, (r) => ({ buf: A.tick(r, { f: r.uni(1500, 5500), tone: r.uni(0, 0.3) }), pan: r.uni(-1, 1), gain: 0.1 + 0.9 * Math.pow(r.next(), 2.4) }), { env });
      const b = A.scatter(n, rng, 14, (r) => ({ buf: A.splat(r), pan: r.uni(-0.9, 0.9), gain: 0.2 + 0.8 * Math.pow(r.next(), 2) }), { env });
      const st = { L: a.L.map((v, i) => v + 0.6 * b.L[i]), R: a.R.map((v, i) => v + 0.6 * b.R[i]) };
      lpChain(st, [['lp', 6500, 0.7], ['hp', 500, 0.7]]);
      A.normRms(st, 0.05);
      return A.normRms(A.softClip(st, 0.25), 0.05);
    }, { gain: -6 });
    // overflowing gutter / downpipe bubbling on the right
    song.bed('gutter', (n, rng) => {
      const st = A.scatter(n, rng, 45, (r) => ({ buf: A.plink(r, { f: r.uni(380, 1300), dec: r.uni(0.008, 0.025), chirp: r.uni(0.3, 0.8) }), pan: 0.5 + r.uni(-0.25, 0.25), gain: Math.pow(r.next(), 1.5) }));
      A.circReverb(st.L, st.R, { t60: 0.7, predelay: 0.008, er: 0.35, hp: 250, lp: 5000, seed: 22 }, 0.4);
      lpChain(st, [['lp', 4000, 0.7], ['hp', 250, 0.7]]);
      return A.normRms(st, 0.05);
    }, { gain: -16 });
    // two distant thunder rolls in a big dark space
    song.bed('thunder', (n, rng) => {
      const L = C.zeros(n), R = C.zeros(n);
      A.place(L, R, A.thunder(rng, 7.5, { lpf: 380, bursts: 16, sub: 0.5 }), Math.round(6.5 * C.SR), 0, 1.0);
      A.place(L, R, A.thunder(rng, 9.0, { lpf: 260, bursts: 12, sub: 0.5 }), Math.round(24.5 * C.SR), 0, 0.6);
      A.circReverb(L, R, { t60: 3.8, predelay: 0.06, er: 0.05, hp: 45, lp: 1600, seed: 21 }, 0.8, 0.6);
      const st = { L: A.chain(L, [['hp', 45, 0.7], ['hp', 40, 0.7]]), R: A.chain(R, [['hp', 45, 0.7], ['hp', 40, 0.7]]) };
      return A.normPeak(st, 0.5);
    }, { gain: -6 });
    return song;
  },
};
