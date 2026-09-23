'use strict';
// amb_night - quiet house at night (seamless 36 s loop): the fridge humming in the next room (120 Hz
// family with slow beating and a soft motor whirr, muffled), near-silent room tone, and a few faint
// crickets outside, heard through the window (sparse chirp groups with pauses).
const S = require('../lib/song');
const C = require('../lib/core');
const A = require('../lib_amb/ambkit');

const LOOP = 36;

module.exports = {
  id: 'amb_night', type: 'amb',
  build() {
    const song = new S.Song({ id: 'amb_night', bpm: 60, meter: 1, loopBars: LOOP, loop: true, target: -26, tailSec: 2, seed: 504, hp: 25, master: { lp: 8000 } });
    song.bed('fridge', (n, rng) => {
      // [harmonic of 60 Hz, amplitude, detune Hz] - the 120.25 Hz partner beats slowly against 120 Hz
      const parts = [[1, 0.16], [2, 1.0], [2, 0.2, 0.25], [3, 0.22], [4, 0.4], [4, 0.08, -0.5], [5, 0.1], [6, 0.22], [7, 0.06], [8, 0.1], [10, 0.05]];
      const hum = A.hum(n, 60, parts, rng);
      const wh1 = A.chain(A.pink(n, rng), [['bp', 230, 3]]);
      const wh2 = A.chain(A.pink(n, rng), [['bp', 1150, 4]]);
      const drift = A.lfo(n, rng, 1, 3, 2);
      const fr = A.snapHz(7.3, n);
      const x = C.zeros(n);
      const hr = A.rms(hum), w1 = A.rms(wh1), w2 = A.rms(wh2);
      for (let i = 0; i < n; i++) {
        const rattle = 1 + 0.04 * Math.sin(2 * Math.PI * fr * i / C.SR);
        x[i] = (hum[i] / hr + 0.45 * wh1[i] / w1 + 0.09 * wh2[i] / w2) * rattle * Math.pow(10, 0.9 * drift[i] / 20);
      }
      const m = A.chain(x, [['hp', 45, 0.7], ['lp', 1400, 0.7], ['lp', 1600, 0.7]]);
      // placed a little to the left (kitchen), slightly decorrelated
      const r = A.chain(Float32Array.from(m), [['ap', 500, 0.7]]);
      return A.normRms({ L: C.scaleBuf(Float32Array.from(m), 1.15), R: C.scaleBuf(r, 0.85) }, 0.05);
    }, { gain: 0 });
    song.bed('room', (n, rng) => A.normRms(A.stereoOf(() => A.chain(A.pink(n, rng), [['hp', 40, 0.7], ['lp', 700, 0.7], ['lp', 900, 0.7]])), 0.05), { gain: -17 });
    // crickets outside
    song.bed('crickets', (n, rng) => {
      const L = C.zeros(n), R = C.zeros(n);
      const bugs = [
        { f: 4350, pulses: 4, per: 0.034, len: 0.017, every: 0.78, pan: -0.55, gain: 1.0 },
        { f: 4780, pulses: 3, per: 0.029, len: 0.014, every: 0.61, pan: 0.45, gain: 0.7 },
        { f: 5150, pulses: 5, per: 0.038, len: 0.018, every: 1.05, pan: 0.05, gain: 0.45 },
      ];
      for (const b of bugs) {
        // alternate singing / pausing segments around the loop
        let t = rng.uni(0, 3);
        const segs = [];
        let s = t;
        while (s < LOOP) { const on = rng.uni(5, 12), off = rng.uni(2.5, 7); segs.push([s, Math.min(LOOP, s + on)]); s += on + off; }
        for (const [a, e] of segs) {
          let tt = a;
          while (tt < e) {
            const c = A.chirp(rng, b.f * (1 + rng.gauss(0, 0.004)), b.pulses - (rng.chance(0.2) ? 1 : 0), b.per, b.len);
            A.place(L, R, c, Math.round(tt * C.SR), b.pan + rng.uni(-0.05, 0.05), b.gain * (0.75 + 0.25 * rng.next()));
            tt += b.every * (1 + rng.gauss(0, 0.07));
          }
        }
      }
      // distance: outdoor space, then through the window
      A.circReverb(L, R, { t60: 1.3, predelay: 0.025, er: 0.2, hp: 1500, lp: 6000, seed: 31 }, 0.55, 0.7);
      const st = { L: A.chain(L, [['hp', 2500, 0.7], ['lp', 5800, 0.7]]), R: A.chain(R, [['hp', 2500, 0.7], ['lp', 5800, 0.7]]) };
      return A.normPeak(st, 0.25);
    }, { gain: -12 });
    return song;
  },
};
