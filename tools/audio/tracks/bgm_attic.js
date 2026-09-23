'use strict';
// "The Attic" - horror section, Pim alone in the dark. Dark sub drone + air, a slow heartbeat that
// comes and goes, wood creaks (stick-slip synthesis), sparse dissonant low piano clusters, reversed
// piano swells, and a faint detuned toy-piano ghost of the Rain Queen's sigh. ~52 BPM (heartbeat), no melody.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const FX = require('../lib/fx');
const C = require('../lib/core');
const { SR, TAU } = C;
const qf = (f, n) => Math.max(1, Math.round(f * n / SR)) * SR / n;

function darkBed(n, rng) {
  const L = C.zeros(n), R = C.zeros(n);
  const lfo = FX.periodicLFO(n, rng, 1, 3, 3), lfo2 = FX.periodicLFO(n, rng, 2, 6, 3);
  // sub cluster C#1 / D1 slowly beating
  const subs = [[qf(34.65, n), 0.22], [qf(36.71, n), 0.18], [qf(69.3, n), 0.1]];
  for (const [f, a] of subs) { let ph = rng.next(); for (let i = 0; i < n; i++) { const v = Math.sin(TAU * ph) * a * (0.7 + 0.3 * lfo[i]); L[i] += v; R[i] += v; ph += f / SR; } }
  // dark moving air: low-passed noise with slow breathing, stereo decorrelated
  for (const [ch, seedTag] of [[L, 1], [R, 2]]) {
    const nz = C.noiseWhite(n, rng.fork(seedTag));
    const f = new C.SVF(300, 1.6);
    const run = (store) => { const o = C.zeros(n); for (let i = 0; i < n; i++) { if ((i & 31) === 0) f.set(160 + 260 * (0.5 + 0.5 * lfo2[i]), 1.6); o[i] = f.process(nz[i]); } return o; };
    run(); const o = run();
    for (let i = 0; i < n; i++) ch[i] += o[i] * 0.35 * (0.6 + 0.4 * lfo2[i]);
  }
  // barely-there dissonant high pair (beating minor second)
  for (const [f, a, pan] of [[qf(1244.5, n), 0.006, -0.6], [qf(1318.5, n), 0.005, 0.6]]) {
    let ph = rng.next(); const [gl, gr] = C.panGains(pan);
    for (let i = 0; i < n; i++) { const v = Math.sin(TAU * ph) * a * Math.max(0, lfo[i]); L[i] += v * gl; R[i] += v * gr; ph += f / SR; }
  }
  return { L, R };
}
// wood creak: stick-slip impulse train through wooden resonances
function creak() {
  return {
    tail: 0.3,
    render(note) {
      const rng = new C.RNG(note.seed);
      const n = Math.round((note.dur + 0.3) * SR);
      const exc = C.zeros(n);
      let t = 0; const rate0 = rng.uni(18, 40), rate1 = rate0 * rng.uni(1.4, 3.2);
      while (t < note.dur) {
        const x = t / note.dur;
        const env = Math.sin(Math.PI * x) * (0.7 + 0.3 * rng.next());
        const i = Math.round(t * SR); if (i < n) exc[i] += env * (rng.chance(0.5) ? 1 : -1) * rng.uni(0.6, 1);
        const rate = rate0 + (rate1 - rate0) * Math.sin(Math.PI * x * 0.9);
        t += (1 / rate) * rng.uni(0.8, 1.25);
      }
      const out = C.zeros(n);
      for (const [f, q, g] of [[rng.uni(280, 420), 12, 1], [rng.uni(650, 900), 10, 0.7], [rng.uni(1300, 1800), 8, 0.35], [rng.uni(120, 180), 6, 0.5]]) {
        const b = new C.Biquad('bp', f, q); for (let i = 0; i < n; i++) out[i] += b.process(exc[i]) * g;
      }
      C.scaleBuf(out, 2.2 * note.vel);
      return out;
    },
  };
}

module.exports = {
  id: 'bgm_attic', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_attic', bpm: 52, meter: 4, loopBars: 13, tailSec: 10, seed: 707, target: -18.8, master: { lp: 8000 } });
    const bar = (n) => song.bar(n);
    song.bus('dark', { type: 'reverb', t60: 4.5, predelay: 0.04, hp: 120, lp: 3500, er: 0.2, seed: 70 });
    song.bus('room', { type: 'reverb', t60: 1.3, predelay: 0.01, hp: 200, lp: 5000, er: 0.5, erTime: 0.05, seed: 71 });
    song.bed('dark', darkBed, { gain: -12, sends: { dark: -12 } });

    // heartbeat: comes and goes
    const hb = song.part('heart', D.heart({ f: 46 }), { gain: -6, sends: { room: -14 }, humanize: { t: 8, v: 0.05 } });
    for (let b = bar(2); b < bar(10); b++) hb.note(b, 40, 0.5, 0.8);
    hb.automate([[bar(2), -18], [bar(5), 0], [bar(8), 0], [bar(10), -14]]);
    // creaks
    const cr = song.part('creak', creak(), { gain: 10, sends: { room: -6, dark: -10 }, humanize: { t: 0, v: 0 } });
    for (const [at, d, pan, v] of [[3.3, 1.1, -0.6, 0.7], [17.6, 0.8, 0.5, 0.5], [29.2, 1.6, -0.2, 0.8], [41.0, 0.7, 0.7, 0.45], [47.5, 1.2, -0.4, 0.6]]) cr.note(at, 60, d, v, { pan, leg: 1 });
    // sparse dissonant low piano clusters
    const pn = song.part('piano', I.piano({ felt: 0.5, bright: 0.35, release: 1.5, decay: 1.2 }), { gain: -3, pan: -0.1, sends: { dark: -5 }, humanize: { t: 10, v: 0.05 } });
    const hits = [[1.0, ['C2', 'C#2'], 0.5], [12.5, ['F#1', 'C2'], 0.45], [22.0, ['Bb1', 'B1', 'E2'], 0.55], [33.5, ['C2', 'F#2'], 0.42], [44.0, ['A1', 'Bb1'], 0.5]];
    for (const [at, ms, v] of hits) for (const m of ms) pn.note(at, m, 6, v, { leg: 1 });
    // a single high, lonely ping
    pn.note(26.3, 'D7', 2, 0.3, { leg: 1 }); pn.note(50.8, 'C#7', 2, 0.26, { leg: 1 });
    // reversed piano swells that "suck in" to the cluster hits
    const revInst = {
      tail: 0.05,
      render(note) {
        const src = I.piano({ felt: 0.3, bright: 0.6, release: 2, decay: 0.8 }).render({ m: note.m, dur: 2.2, vel: 0.8, seed: note.seed });
        const len = Math.round(note.dur * SR);
        const L = C.reverseBuf(src.L).slice(-len), R = C.reverseBuf(src.R).slice(-len);
        C.fadeIn(L, 200); C.fadeIn(R, 200); C.fadeOut(L, 120); C.fadeOut(R, 120);
        C.scaleBuf(L, note.vel); C.scaleBuf(R, note.vel);
        return { L, R };
      },
    };
    const rev = song.part('reverse', revInst, { gain: -9, sends: { dark: -2 }, humanize: { t: 0, v: 0 } });
    for (const [end, ms] of [[22.0, ['E3', 'F3', 'B3']], [44.0, ['A2', 'Bb3', 'E4']]]) for (const m of ms) rev.note(end - 1.9 / (60 / 52), m, 1.9 / (60 / 52), 0.8, { leg: 1, noHuman: true });
    // ghost of the Rain Queen's sigh on a detuned toy piano
    const toy = song.part('toy', I.modal('toypiano', { detune: 20 }), { gain: -13, pan: 0.5, sends: { dark: 0 }, fx: [{ type: 'wow', wowRate: 0.6, wowDepth: 0.008, flutDepth: 0.001 }] });
    toy.note(36.0, 'F5', 1.5, 0.5, { f: C.mtof(77) * C.cents(-40) }); toy.note(38.0, 'E5', 2, 0.42, { f: C.mtof(76) * C.cents(-45) });
    return song;
  },
};
