'use strict';
// "Crumb Valley" - the kitchen as a candy-bright valley. Playful and bouncy: xylophone lead (opens with
// the "pit-ter pat-ter" cell of Pim's theme in C), ukulele chops, pizzicato, staccato tuba oom-pah,
// shaker + woodblock, chromatic grace notes and a slide whistle. 116 BPM, C major.
// A (8) | A' (8, minor-iv wobble) | B (8, sneaky pizzicato tune) | A'' (8, glock doubling)
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_crumb', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_crumb', bpm: 116, loopBars: 32, tailSec: 4, seed: 404, master: { sat: 1.1 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 0.9, predelay: 0.01, hp: 220, lp: 7000, er: 0.4, erTime: 0.035 });
    song.bus('hall', { type: 'reverb', t60: 1.9, predelay: 0.025, hp: 300, lp: 8000, er: 0.12, seed: 13 });

    const HA = [[['C', 4]], [['C', 4]], [['F', 4]], [['C', 4]], [['Dm7', 4]], [['G7', 4]], [['C', 4]], [['G7', 4]]];
    const HA2 = [[['C', 4]], [['C', 4]], [['F', 4]], [['Fm', 4]], [['C/E', 4]], [['A7', 4]], [['Dm7', 2], ['G7', 2]], [['C', 4]]];
    const HB = [[['F', 4]], [['F#dim7', 4]], [['C/G', 4]], [['A7', 4]], [['Dm', 4]], [['G7', 4]], [['C', 4]], [['G7', 4]]];
    const harm = [...K.harmTimeline(HA, 4, 0), ...K.harmTimeline(HA2, 4, bar(8)), ...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HA, 4, bar(24))];

    const melA = 'G5/8 G5/8 E5/8 E5/8 F5/8 E5/8 D5/4 | C5/8\' E5/8\' G5/8\' C6/8\' r/8 G5/8 C6/4\' | A5/8 A5/8 F5/8 F5/8 G5/8 F5/8 E5/4 | D#5/g E5/8 G5/8 C5/4 r/2 | ' +
      'F5/8 F5/8 D5/8 D5/8 E5/8 D5/8 C5/4 | B4/8\' D5/8\' F5/8\' G5/8\' r/8 F5/8 D5/4\' | E5/8 G5/8 C#6/g D6/8 C6/8 G5/4 E5/4 | F5/4 D5/8 B4/8 G4/4 r/4 |';
    const melA2 = 'G5/8 G5/8 E5/8 E5/8 F5/8 E5/8 D5/4 | C5/8\' E5/8\' G5/8\' C6/8\' r/8 G5/8 C6/4\' | A5/8 A5/8 F5/8 F5/8 G5/8 F5/8 E5/4 | Ab5/8 Ab5/8 F5/8 F5/8 G5/8 F5/8 Eb5/4 | ' +
      'G5/8 E5/8 C5/8 E5/8 G5/4 C6/4\' | C#6/8 C#6/8 A5/8 A5/8 B5/8 A5/8 G5/4 | F5/8 A5/8 D6/8 A5/8 G5/8 B5/8 D6/8 F6/8 | E6/4\' C6/4\' r/2 |';
    const melB = 'F4/8\' A4/8\' C5/8\' r/8 A4/8\' C5/8\' F5/4\' | Eb5/8\' C5/8\' A4/8\' F#4/8\' r/8 A4/8\' C5/4\' | G4/8\' C5/8\' E5/8\' r/8 G5/8\' E5/8\' C5/4\' | C#5/8\' E5/8\' G5/8\' A5/8\' r/8 G5/8\' E5/4\' | ' +
      'F5/8\' E5/8\' D5/8\' C5/8\' D5/8\' F5/8\' A5/4\' | G5/8\' F5/8\' E5/8\' D5/8\' B4/8\' D5/8\' G4/4\' | E5/8\' G5/8\' C6/8\' G5/8\' E5/8\' C5/8\' G4/8\' E4/8\' | F4/8 G4/8 A4/8 B4/8 C5/8 D5/8 F5/8 G5/8 |';

    // ---- xylophone lead
    const xylo = song.part('xylo', I.modal('xylo'), { gain: -2, pan: 0.1, sends: { room: -8, hall: -14 }, humanize: { t: 5, v: 0.07 } });
    xylo.add(0, T.parse(melA, { vel: 0.78 }));
    xylo.add(bar(8), T.parse(melA2, { vel: 0.8 }));
    xylo.add(bar(24), T.parse(melA, { vel: 0.82 }));
    // glockenspiel doubling (octave up) in A'' and sparkles in B
    const glock = song.part('glock', I.modal('glock', { decay: 0.6 }), { gain: -13, pan: -0.2, sends: { hall: -8 }, humanize: { t: 5, v: 0.05 } });
    glock.add(bar(24), T.transposeEv(T.parse(melA, { vel: 0.6 }), 12));
    for (let b = 16; b < 24; b++) glock.note(bar(b) + 3.5, T.pcAtOrAbove(T.chord(HB[b - 16][0][0]).pcs[1], T.nm('E6')), 0.5, 0.5);

    // ---- pizzicato: sneaky tune in B, off-beat chord tones in A'
    const pizz = song.part('pizz', I.pluck('pizz'), { gain: 1, pan: -0.25, sends: { room: -6, hall: -12 }, humanize: { t: 7, v: 0.08 } });
    pizz.add(bar(16), T.parse(melB, { vel: 0.75 }));
    K.harmTimeline(HA2, 4, bar(8)).forEach((h) => {
      const v = T.closeVoicing(h.sym, 'G4');
      for (let k = 1; k < h.d; k += 2) pizz.note(h.b + k + 0.5, v[(k >> 1) % v.length], 0.25, 0.5);
    });

    // ---- ukulele chops on 2 & 4 (with a little up-strum)
    const uke = song.part('uke', I.pluck('uke', { muteT: 0.05 }), { gain: -5, pan: 0.3, sends: { room: -9 }, humanize: { t: 5, v: 0.08 } });
    harm.forEach((h) => {
      const v = T.closeVoicing(h.sym, 'G3').slice(0, 4);
      while (v.length < 4) v.push(v[v.length - 3] + 12);
      for (let k = 1; k < h.d; k += 2) {
        uke.chord(h.b + k, v, 0.4, 0.62, { strum: 0.011 });
        if (k === 3) uke.chord(h.b + k + 0.5, v.slice(1), 0.25, 0.4, { strum: 0.008, dir: 'up' });
      }
    });

    // ---- staccato tuba: oom-pah with chromatic walk-ups at phrase ends
    const tuba = song.part('tuba', I.brass({ voices: 1, attack: 0.022, decay: 0.12, sustain: 0.55, release: 0.07, lpBase: 160, lpEnv: 1100, fm: 0.25, scoop: -35, body: 3 }), { gain: -1, pan: -0.05, sends: { room: -12 }, humanize: { t: 5, v: 0.06 } });
    harm.forEach((h, i) => {
      const c = T.chord(h.sym);
      const r = T.pcAtOrAbove(c.bass, T.nm('F1'));
      const fiv = c.iv.includes(6) && !c.iv.includes(7) ? 6 : c.iv.includes(8) && !c.iv.includes(7) ? 8 : 7;
      const f5 = T.pcAtOrAbove((c.root + fiv) % 12, r + 1); // the chord's own fifth above the bass
      tuba.note(h.b, r, 0.45, 0.85, { leg: 0.8 });
      if (h.d >= 4) {
        const next = harm[(i + 1) % harm.length];
        const nr = T.pcAtOrAbove(T.chord(next.sym).bass, T.nm('F1'));
        if (i % 4 === 3) { // walk-up into next chord
          tuba.note(h.b + 2, f5, 0.45, 0.75, { leg: 0.8 });
          tuba.note(h.b + 3, nr - 2, 0.4, 0.7, { leg: 0.8 }); tuba.note(h.b + 3.5, nr - 1, 0.4, 0.72, { leg: 0.8 });
        } else tuba.note(h.b + 2, f5, 0.45, 0.75, { leg: 0.8 });
      }
    });

    // ---- percussion: soft kick on 1 & 3, shaker 8ths, woodblock pattern, triangle at section starts
    const kick = song.part('kick', D.kick({ f0: 55, f1: 110, decay: 0.22, click: 0.1, drive: 1.2 }), { gain: -6, humanize: { t: 3, v: 0.05 } });
    const shk = song.part('shaker', D.shaker({ decay: 0.055 }), { gain: -3, pan: 0.35, sends: { room: -10 }, humanize: { t: 5, v: 0.1 } });
    const wb = song.part('woodblock', D.block({ decay: 0.05, click: 0.35 }), { gain: -5, pan: -0.35, sends: { room: -8 }, humanize: { t: 3, v: 0.06 } });
    const tri = song.part('triangle', D.triangle({ decay: 2 }), { gain: -14, pan: 0.4, sends: { hall: -6 } });
    for (let b = 0; b < 32; b++) {
      kick.add(bar(b), T.grid('x.......x.......', 0.25, { vmap: { x: 0.7 } }));
      shk.add(bar(b), T.grid('x.o.x.o.x.o.x.o.', 0.25, { vmap: { x: 0.65, o: 0.4 } }));
      if (b % 8 === 7) wb.add(bar(b), T.grid('..........x.x.xx', 0.25, { vmap: { x: 0.7 } }).map((e, k) => Object.assign(e, { m: 79 + (k % 2) * 5 })));
      else wb.add(bar(b), T.grid('......x.......x.', 0.25, { vmap: { x: 0.6 } }).map((e, k) => Object.assign(e, { m: k ? 84 : 79 })));
      if (b % 8 === 0) tri.note(bar(b), 60, 1, 0.55);
    }
    // ---- slide whistle gags into B and back
    const sw = song.part('slide', I.whistle({ glide: 0.26, vib: 25, scoop: 0, attack: 0.02 }), { gain: -10, pan: 0.2, sends: { hall: -8 } });
    sw.add(bar(15) + 2.5, T.parse('C5/8~ C6/4 r/8', { vel: 0.7 }));
    sw.add(bar(23) + 2.5, T.parse('G6/8~ G5/8~ C6/8 r/8', { vel: 0.6 }));
    return song;
  },
};
