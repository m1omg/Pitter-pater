'use strict';
// amb_static - an untuned old TV: band-limited static with a slow crawl, a faint 60 Hz field buzz
// and mains hum, and sparse electrical crackle (seamless 24 s loop). Top end is tamed so it can run
// for minutes without fatigue.
const S = require('../lib/song');
const C = require('../lib/core');
const A = require('../lib_amb/ambkit');

const LOOP = 24;

module.exports = {
  id: 'amb_static', type: 'amb',
  build() {
    const song = new S.Song({ id: 'amb_static', bpm: 60, meter: 1, loopBars: LOOP, loop: true, target: -26, tailSec: 2, seed: 503, hp: 25, master: { lp: 8500 } });
    song.bed('static', (n, rng) => {
      // mostly mono (TV speaker) with a little width
      const M = A.white(n, rng), Sd = A.white(n, rng);
      const spec = [['hp', 140, 0.7], ['peak', 1000, 0.7, 2], ['highshelf', 2800, 0.7, -6], ['lp', 5200, 0.7], ['lp', 5800, 0.7]];
      const L = A.chain(Float32Array.from(M, (v, i) => v + 0.3 * Sd[i]), spec);
      const R = A.chain(Float32Array.from(M, (v, i) => v - 0.3 * Sd[i]), spec);
      const crawl = A.smooth(n, rng, 12);       // fast shimmer of the snow
      const slow = A.lfo(n, rng, 2, 5, 3);       // slow reception drift
      const f60 = A.snapHz(59.94, n);
      for (let i = 0; i < n; i++) {
        const buzz = 1 + 0.07 * Math.sin(2 * Math.PI * f60 * i / C.SR);
        const g = (1 + 0.14 * Math.max(-2.5, Math.min(2.5, crawl[i]))) * Math.pow(10, 1.3 * slow[i] / 20) * buzz;
        L[i] *= g; R[i] *= g;
      }
      return A.normRms({ L, R }, 0.05);
    }, { gain: 0 });
    // mains hum / field buzz from the set
    song.bed('hum', (n, rng) => {
      const parts = [[1, 0.45], [2, 1.0], [3, 0.55], [4, 0.38], [5, 0.3], [6, 0.2], [7, 0.15], [8, 0.1], [9, 0.08], [10, 0.06], [12, 0.04]];
      let x = A.hum(n, 60, parts, rng);
      x = A.chain(x, [['hp', 50, 0.7], ['lp', 1000, 0.7]]);
      const w = A.lfo(n, rng, 1, 3, 2);
      for (let i = 0; i < n; i++) x[i] *= 1 + 0.12 * w[i];
      return A.normRms({ L: x, R: Float32Array.from(x) }, 0.05);
    }, { gain: -8 });
    // sparse electrical crackle
    song.bed('crackle', (n, rng) => {
      const a = A.scatter(n, rng, 5, (r) => ({ buf: A.zap(r), pan: r.uni(-0.3, 0.3), gain: 0.15 + 0.85 * Math.pow(r.next(), 2.5) }));
      const b = A.scatter(n, rng, 0.35, (r) => ({ buf: A.zap(r, { len: r.uni(0.006, 0.012), f: r.uni(800, 2500) }), pan: r.uni(-0.2, 0.2), gain: r.uni(0.4, 1) }));
      const st = { L: a.L.map((v, i) => v + b.L[i]), R: a.R.map((v, i) => v + b.R[i]) };
      st.L = A.chain(st.L, [['lp', 6000, 0.7]]); st.R = A.chain(st.R, [['lp', 6000, 0.7]]);
      return A.normPeak(st, 0.3);
    }, { gain: -2 });
    return song;
  },
};
