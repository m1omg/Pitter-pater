'use strict';
// "Static Woods" - the TV-static forest. Eerie ambient with no clear pulse: an exactly periodic low drone
// (D + A, with a faint high whistle drifting to the minor 6th), slowed & detuned music-box fragments of
// Pim's theme in D minor, radio-static swells with tuning whistles, and distant chimes in a dark hall.
const S = require('../lib/song');
const I = require('../lib/inst');
const T = require('../lib/theory');
const K = require('../lib/comp');
const FX = require('../lib/fx');
const C = require('../lib/core');
const { SR, TAU } = C;

// quantise a frequency so it completes an integer number of cycles in the loop (exactly periodic)
const qf = (f, n) => Math.max(1, Math.round(f * n / SR)) * SR / n;

function droneBed(n, rng) {
  const L = C.zeros(n), R = C.zeros(n);
  const lfo1 = FX.periodicLFO(n, rng, 1, 3, 3), lfo2 = FX.periodicLFO(n, rng, 2, 5, 3), lfo3 = FX.periodicLFO(n, rng, 1, 2, 2);
  const voice = (f, amp, pan, wave) => {
    const fq = qf(f, n); let ph = rng.next();
    const [gl, gr] = C.panGains(pan);
    const buf = C.zeros(n);
    for (let i = 0; i < n; i++) {
      const p = ph - Math.floor(ph);
      buf[i] = wave === 'saw' ? 2 * p - 1 : wave === 'tri' ? 1 - 4 * Math.abs(p - 0.5) : Math.sin(TAU * p);
      ph += fq / SR;
    }
    return { buf, gl, gr, amp };
  };
  const layers = [
    voice(73.42 * C.cents(-5), 0.5, -0.4, 'saw'), voice(73.42 * C.cents(4), 0.5, 0.4, 'saw'),
    voice(110.0 * C.cents(2), 0.35, 0.1, 'tri'), voice(36.71, 0.45, 0, 'sine'), voice(146.83 * C.cents(-7), 0.18, -0.2, 'tri'),
  ];
  for (const ly of layers) {
    // dark, slowly breathing low-pass (applied circularly so the bed stays periodic)
    const f = new C.SVF(300, 0.7);
    const proc = (i, x) => { if ((i & 31) === 0) f.set(170 + 190 * (0.5 + 0.5 * lfo1[i]), 0.75); return f.process(x); };
    let out;
    if (ly.buf === layers[3].buf) out = ly.buf; else {
      for (let i = 0; i < n; i++) proc(i, ly.buf[i]);
      out = C.zeros(n); for (let i = 0; i < n; i++) out[i] = proc(i, ly.buf[i]);
    }
    for (let i = 0; i < n; i++) { const a = ly.amp * (0.75 + 0.25 * lfo2[i]); L[i] += out[i] * a * ly.gl; R[i] += out[i] * a * ly.gr; }
  }
  // faint high whistle: D5 that drifts to Bb4 and back (periodic), amplitude breathing in and out
  const cyc = 2; let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const bend = 0.5 - 0.5 * Math.cos(TAU * cyc * t);
    const f = 587.33 * Math.pow(2, (-4 * Math.pow(bend, 3)) / 12) * (1 + 0.004 * Math.sin(TAU * 5 * t * 60));
    const a = 0.05 * Math.pow(Math.max(0, lfo3[i]), 2);
    const v = Math.sin(TAU * ph) * a; ph += f / SR;
    L[i] += v * 0.8; R[i] += v * 0.5;
  }
  return { L, R };
}

// radio static swell (note.dur seconds): band-passed noise that sweeps, crackles and a tuning whistle
function staticSwell() {
  return {
    tail: 0.2,
    render(note) {
      const rng = new C.RNG(note.seed);
      const n = Math.round((note.dur + 0.2) * SR);
      const out = C.zeros(n);
      const nz = C.noiseWhite(n, rng);
      const f = new C.SVF(1500, 2.5);
      const f0 = rng.uni(700, 2500), f1 = f0 * rng.uni(0.5, 2.2);
      let wph = 0; const w0 = rng.uni(900, 2600), w1 = w0 * rng.uni(0.6, 1.6);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const env = Math.pow(Math.sin(Math.PI * Math.min(1, t)), 2);
        if ((i & 15) === 0) f.set(f0 * Math.pow(f1 / f0, t), 2.5);
        f.process(nz[i]);
        const gate = rng.next() < 0.02 ? 1.8 : 1; // crackle
        const wf = w0 * Math.pow(w1 / w0, t);
        const whistle = Math.sin(TAU * wph) * 0.12 * Math.pow(env, 2); wph += wf / SR;
        out[i] = (f.band * 0.9 * gate + whistle) * env;
      }
      new C.Biquad('hp', 400, 0.7).run(out); new C.Biquad('lp', 5000, 0.7).run(out);
      C.scaleBuf(out, 0.35 * note.vel);
      return out;
    },
  };
}

module.exports = {
  id: 'bgm_static', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_static', bpm: 60, meter: 4, loopBars: 16, tailSec: 9, seed: 606, target: -18.8,
      master: { wow: { wowRate: 0.3, wowDepth: 0.003, flutDepth: 0.0005 }, lp: 9000 } });
    song.bus('dark', { type: 'reverb', t60: 5.5, predelay: 0.06, hp: 150, lp: 4500, er: 0.08, seed: 66 });
    song.bus('far', { type: 'reverb', t60: 7, predelay: 0.12, hp: 600, lp: 7000, er: 0.02, seed: 67, len: 7.5 });
    song.bed('drone', droneBed, { gain: -9, sends: { dark: -10 } });

    // detuned, slowed music-box fragments (Pim's theme mapped to D minor, low and flat)
    const mb = song.part('mbox', I.modal('musicbox', { decay: 1.6, detune: 12 }), {
      gain: -3, pan: -0.15, sends: { dark: -4 }, humanize: { t: 25, v: 0.1 },
      fx: [{ type: 'wow', wowRate: 0.45, wowDepth: 0.006, flutDepth: 0.001 }],
    });
    const theme = K.pimTheme({ mode: ['D', 'minor'], vel: 0.55 });
    const frag = (bars, at, stretch, tr = 0) => {
      let ev = T.sliceEv(theme, bars[0] * 4, bars[1] * 4);
      ev = T.augment(ev, stretch);
      if (tr) ev = T.transposeEv(ev, tr);
      mb.add(at, ev.map((e) => Object.assign(e, { f: C.mtof(e.m) * C.cents(-35) })));
    };
    frag([0, 1], 1.3, 1.6);        // "A A F F G F E" slowed
    frag([1, 2], 12.7, 1.9);
    frag([2, 3], 25.1, 1.5, 12);   // higher, brittle
    frag([5, 6], 38.4, 2.2);
    frag([3, 4], 49.6, 1.7, 12);
    // distant chimes
    const ch = song.part('chimes', I.modal('chime', { decay: 0.8 }), { gain: -12, sends: { far: 0 }, humanize: { t: 0, v: 0.1 } });
    const rng = new C.RNG(6060);
    const pool = ['D6', 'F6', 'A6', 'E6', 'Bb5', 'C#6', 'G6'];
    let b = 3.1;
    while (b < 62) { ch.note(b, rng.pick(pool), 1, rng.uni(0.25, 0.55), { pan: rng.uni(-0.8, 0.8) }); b += rng.uni(2.2, 7.5); }
    // radio static swells
    const st = song.part('static', staticSwell(), { gain: -7, sends: { dark: -8 }, humanize: { t: 0, v: 0 } });
    for (const [at, d, pan, v] of [[6.5, 3.2, -0.5, 0.8], [18.2, 2.4, 0.6, 0.6], [30.5, 4.0, 0.1, 0.9], [44.8, 2.8, -0.3, 0.7], [55.0, 3.5, 0.5, 0.75]]) st.note(at, 60, d, v, { pan, leg: 1 });
    // low piano "ghost" notes (very soft), D minor with a b6
    const pn = song.part('ghostpiano', I.piano({ felt: 0.9, bright: 0.2, release: 1.2 }), { gain: -10, pan: 0.2, sends: { dark: -3 } });
    for (const [at, m] of [[9.0, 'D3'], [21.5, 'Bb2'], [34.0, 'A2'], [47.2, 'G2'], [58.3, 'C#3']]) pn.note(at, m, 4, 0.42, { leg: 1 });
    return song;
  },
};
