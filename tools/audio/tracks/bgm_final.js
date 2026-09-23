'use strict';
// Final battle vs the Rain Queen, phase 1. Tense and sad. 132 BPM, D minor.
// Intro (2 bars): piano ostinato alone. Loop (32 bars):
// A: violins sing the Rain Queen motif over the driving piano ostinato and drums
// B: Pim's theme in D minor (piano lead doubled by violas) fighting against it
// C: "struggle": cellos play the Queen's sighs augmented, violins answer with the pitter-patter cell,
//    16th-note ostinato, choir "aah", string stabs, timpani
// D: breakdown to piano + sighs, then a crescendo back to A.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_final', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_final', bpm: 132, introBars: 2, loopBars: 32, tailSec: 4.5, seed: 1111, master: { sat: 1.1 } });
    const bar = (n) => song.bar(n);
    song.bus('hall', { type: 'reverb', t60: 2.4, predelay: 0.03, hp: 200, lp: 7500, er: 0.18 });
    song.bus('room', { type: 'reverb', t60: 1.0, predelay: 0.01, hp: 250, lp: 7000, er: 0.35, seed: 112 });

    const HI = [[['Dm', 4]], [['Dm', 4]]];
    const HA = [[['Dm', 4]], [['Bb', 4]], [['Gm', 4]], [['A7b9', 4]], [['Dm', 4]], [['C', 4]], [['Gm', 4]], [['A7', 4]]];
    const HB = [[['Dm', 4]], [['Bb', 4]], [['Gm', 4]], [['A7', 2], ['Dm', 2]], [['Dm', 4]], [['Bb', 4]], [['Em7b5', 2], ['A', 2]], [['A7', 2], ['Dm', 2]]];
    const HC = [[['Bb', 4]], [['C', 4]], [['Dm', 4]], [['Dm/C', 4]], [['Gm/Bb', 4]], [['A', 4]], [['Bb', 4]], [['A7', 4]]];
    const HD = [[['Dm', 4]], [['Bb', 4]], [['Gm', 4]], [['A7b9', 4]], [['Dm', 4]], [['Bb', 4]], [['Gm', 4]], [['A7', 4]]];
    const hI = K.harmTimeline(HI, 4, bar(-2)), hA = K.harmTimeline(HA, 4, 0), hB = K.harmTimeline(HB, 4, bar(8)), hC = K.harmTimeline(HC, 4, bar(16)), hD = K.harmTimeline(HD, 4, bar(24));
    const all = [...hI, ...hA, ...hB, ...hC, ...hD];

    // ---- piano ostinato (RH 8ths, 16ths in C) + LH octaves
    const pno = song.part('ostinato', I.piano({ felt: 0.2, bright: 0.65, release: 0.2 }), { gain: -2, pan: -0.15, sends: { hall: -12, room: -10 }, humanize: { t: 5, v: 0.05 } });
    let prev = null;
    all.forEach((h) => {
      const v = T.voiceLead(prev, h.sym, 'G4', 'G5', 3); prev = v;
      const inC = h.b >= bar(16) && h.b < bar(24);
      const inDsoft = h.b >= bar(24) && h.b < bar(28);
      const step = inC ? 0.25 : 0.5;
      const pat = inC ? [0, 1, 2, 1] : [0, 2, 1, 2];
      const n = Math.round(h.d / step);
      for (let k = 0; k < n; k++) pno.note(h.b + k * step, v[pat[k % pat.length]], step, (k % (inC ? 4 : 2) === 0 ? 0.72 : 0.55) * (inDsoft ? 0.8 : 1), { leg: 0.85 });
      const bn = T.bassNote(h.sym, 'A1');
      for (let k = 0; k < h.d; k += 2) { pno.note(h.b + k, bn, 1.5, 0.78, { leg: 0.9 }); pno.note(h.b + k, bn + 12, 1.5, 0.66, { leg: 0.9 }); }
    });

    // ---- violins: Rain Queen motif (A), extended; answering pitter-patter cells (C)
    const vln = song.part('violins', I.strings({ attack: 0.12, release: 0.45, vib: 14, voices: 6, spread: 8, lp: 4500 }), { gain: 3, pan: 0.15, sends: { hall: -6 }, humanize: { t: 7, v: 0.04 } });
    vln.add(0, T.parse('F5/2. E5/4 | D5/2. C5/4 | Bb4/2 A4/4 G4/4 | Bb4/4 C#5/2. | D5/2 E5/4 F5/4 | G5/2 E5/4 C5/4 | D5/4 Bb4/4 G4/4 Bb4/4 | A4/1 |', { vel: 0.8, legato: 1.0 }));
    vln.add(bar(16), T.parse('r/2 A5/8 A5/8 F5/8 F5/8 | r/2 G5/8 G5/8 E5/8 E5/8 | r/2 F5/8 F5/8 D5/8 D5/8 | r/2 C5/8 C5/8 A4/8 A4/8 | ' +
      'D5/8 D5/8 Bb4/8 Bb4/8 C5/8 Bb4/8 A4/4 | C#5/8 C#5/8 A4/8 A4/8 E5/4 C#5/4 | D5/8 D5/8 F5/8 F5/8 Bb5/4 A5/4 | G5/4 F5/4 E5/4 C#5/4 |', { vel: 0.78 }));
    vln.add(bar(24) + 0, T.parse('F5/2. E5/4 | D5/2. C5/4 | r/1 | r/1 | F5/2. E5/4 | D5/2. C5/4 | Bb4/2 A4/4 G4/4 | Bb4/4 C#5/2. |', { vel: 0.66, legato: 1.0 }));
    vln.automate([[bar(24), -4], [bar(28), -3], [bar(31), 1]]);

    // ---- Pim's theme in D minor (B): piano lead doubled by violas an octave below
    const lead = song.part('pianoLead', I.piano({ felt: 0.25, bright: 0.6, release: 0.3 }), { gain: 1, pan: 0.05, sends: { hall: -8 }, humanize: { t: 6, v: 0.05 } });
    const pimDm = K.pimTheme({ mode: ['D', 'minor'], vel: 0.85 });
    lead.add(bar(8), T.transposeEv(pimDm, 12));
    const vla = song.part('violas', I.strings({ attack: 0.15, release: 0.4, vib: 11, voices: 5, spread: 7, lp: 3500 }), { gain: -5, pan: -0.2, sends: { hall: -6 } });
    vla.add(bar(8), pimDm.map((e) => Object.assign({}, e, { v: 0.7, leg: 1.0 })));

    // ---- cellos: bass line + augmented sighs in C
    const vc = song.part('cellos', I.strings({ attack: 0.1, release: 0.4, vib: 9, voices: 4, spread: 6, body: 'cello', lp: 2400, sub: 0.2 }), { gain: -3, pan: -0.3, sends: { hall: -8 } });
    for (const h of [...hA, ...hB, ...hD]) vc.note(h.b, T.bassNote(h.sym, 'D2'), h.d, 0.7, { leg: 0.98 });
    vc.add(bar(16), T.parse('F3/1 | E3/1 | D3/1 | C3/1 | Bb2/1 | C#3/1 | D3/1 | E3/2 C#3/2 |', { vel: 0.85, legato: 1.0 }));
    vc.add(bar(16), T.parse('F2/1 | E2/1 | D2/1 | C2/1 | Bb1/1 | A1/1 | Bb1/1 | A1/1 |', { vel: 0.7, legato: 1.0 }));

    // ---- string stabs + choir "aah" in C
    const stab = song.part('stabs', I.strings({ attack: 0.01, release: 0.12, vib: 0, voices: 5, spread: 10, lp: 5000, bow: 0.05 }), { gain: -6, pan: 0.25, sends: { room: -6 } });
    prev = null;
    for (const h of hC) { const v = T.voiceLead(prev, h.sym, 'D4', 'D5', 3); prev = v; for (const o of [0, 1.5, 3]) v.forEach((m) => stab.note(h.b + o, m, 0.35, 0.85, { leg: 0.7 })); }
    const choir = song.part('choir', I.choir({ vowel: 'ah', attack: 0.35, release: 0.8, vib: 18 }), { gain: -7, sends: { hall: -4 } });
    K.padChords(choir, hC, 'A3', 'F5', 4, 0.7);

    // ---- sub bass for weight
    const sub = song.part('sub', I.sineBass({ attack: 0.01, decay: 0.8, sustain: 0.8, h2: 0.12, drive: 1.2, thump: 20 }), { gain: -11 });
    for (const h of [...hA, ...hB, ...hC, ...hD]) sub.note(h.b, T.bassNote(h.sym, 'A1'), h.d, 0.7, { leg: 0.95 });

    // ---- drums, timpani
    const kick = song.part('kick', D.kick({ f0: 46, f1: 140, decay: 0.35, click: 0.35, drive: 1.8 }), { gain: -3, humanize: { t: 2, v: 0.03 } });
    const snare = song.part('snare', D.snare({ f: 180, decay: 0.2, hp: 1000, lp: 9000, body: 0.7, drive: 1.6 }), { gain: 1, sends: { hall: -10, room: -8 }, humanize: { t: 3, v: 0.04 } });
    const hat = song.part('hat', D.hat({ decay: 0.03, lp: 11000 }), { gain: 6, pan: 0.3, sends: { room: -14 }, humanize: { t: 3, v: 0.08 } });
    const toms = song.part('toms', D.tom({ decay: 0.45, drive: 1.6 }), { gain: -6, sends: { hall: -8 } });
    const timp = song.part('timp', D.timpani({ decay: 2.0 }), { gain: -4, sends: { hall: -6 } });
    const crash = song.part('crash', D.cymbal({ decay: 2.2 }), { gain: -12, pan: 0.3, sends: { hall: -8 } });
    const swell = song.part('swell', D.swell({ fc0: 700, fc1: 8000 }), { gain: -12, sends: { hall: -4 } });
    for (let b = 0; b < 32; b++) {
      const sec = Math.floor(b / 8), last = b % 8 === 7;
      if (b % 8 === 0 && b !== 24) crash.note(bar(b), 60, 2, 0.85);
      if (sec === 3 && b < 28) { // breakdown: heartbeat-like kick only
        kick.add(bar(b), T.grid('X.......x.......', 0.25, { vmap: { X: 0.7, x: 0.5 } }));
        continue;
      }
      kick.add(bar(b), T.grid(sec === 2 ? 'X.x.X.x.X.x.X.x.' : 'X.....X.X.......', 0.25));
      snare.add(bar(b), T.grid(last ? '....X.......XXXX' : '....X.......X...', 0.25, { vmap: { X: 0.9 } }));
      hat.add(bar(b), T.grid('x.x.x.x.x.x.x.x.', 0.25, { vmap: { x: 0.6 } }));
      if (last) toms.add(bar(b) + 2, T.grid('X.x.XxXx', 0.25).map((e, k) => Object.assign(e, { m: [45, 45, 43, 43, 40, 40, 38, 38][k] })));
      if (sec === 2 && b % 2 === 0) timp.note(bar(b), T.bassNote(HC[b - 16][0][0], 'F2'), 1, 0.8);
    }
    timp.add(bar(27), T.grid('x.x.x.x.xxxxXXXX', 0.25, { vmap: { x: 0.4, X: 0.75 } }).map((e) => Object.assign(e, { m: 45 })));
    swell.note(bar(28), 60, 16, 0.7, { leg: 1, noHuman: true });
    swell.note(bar(14), 60, 8, 0.6, { leg: 1, noHuman: true });
    return song;
  },
};
