'use strict';
// "Teacup Town" - cozy dream village in Crumb Valley. Gentle waltz (3/4, 96 BPM), Bb major.
// A: musette accordion melody | A': variation with a cosy borrowed Ebm | B: glockenspiel sings Pim's
// theme (waltz adaptation, in Bb) while the accordion holds bellows chords | A'': melody + glock sparkle.
// Accompaniment: upright bass on 1, ukulele "pah-pah" on 2 & 3, shaker, triangle at phrase starts.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_town', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_town', bpm: 96, meter: 3, loopBars: 32, tailSec: 4.5, seed: 1717, master: { sat: 1.05 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 1.3, predelay: 0.015, hp: 200, lp: 7000, er: 0.35 });
    song.bus('hall', { type: 'reverb', t60: 2.4, predelay: 0.03, hp: 250, lp: 8000, er: 0.12, seed: 171 });

    const HA = [[['Bb', 3]], [['Bb', 3]], [['Eb', 3]], [['Bb', 3]], [['Gm', 3]], [['Cm7', 3]], [['F7', 3]], [['Bb', 3]]];
    const HA2 = [[['Bb', 3]], [['Bb/D', 3]], [['Eb', 3]], [['Ebm', 3]], [['Bb/F', 3]], [['G7', 3]], [['Cm7', 2], ['F7', 1]], [['Bb', 3]]];
    const HB = [[['Bb', 3]], [['Bb', 3]], [['Gm', 3]], [['Gm', 3]], [['Eb', 3]], [['Eb', 3]], [['F7', 3]], [['Bb', 3]]];
    const harm = [...K.harmTimeline(HA, 3, 0), ...K.harmTimeline(HA2, 3, bar(8)), ...K.harmTimeline(HB, 3, bar(16)), ...K.harmTimeline(HA, 3, bar(24))];
    const melA = 'D5/4 F5/4 Bb5/4 | A5/4. G5/8 F5/4 | G5/2 Eb5/4 | F5/2. | D5/4 G5/4 Bb5/4 | Bb5/4. A5/8 G5/4 | A5/4 C6/4 Eb6/4 | D6/2. |';
    const melA2 = 'D5/4 F5/4 Bb5/4 | C6/4. Bb5/8 A5/4 | G5/4 Bb5/4 Eb6/4 | Gb5/2 Eb5/4 | D5/4 F5/4 Bb5/4 | B5/4. A5/8 G5/4 | C6/4 Bb5/4 A5/4 | Bb5/2. |';

    const acc = song.part('accordion', I.accordion({ musette: 12 }), { gain: -1, pan: 0.1, sends: { room: -8, hall: -14 }, humanize: { t: 8, v: 0.06 } });
    acc.add(0, T.parse(melA, { bar: 3, vel: 0.72, legato: 0.95 }));
    acc.add(bar(8), T.parse(melA2, { bar: 3, vel: 0.75, legato: 0.95 }));
    acc.add(bar(24), T.parse(melA, { bar: 3, vel: 0.75, legato: 0.95 }));
    // B: accordion holds soft bellows chords
    const accCh = song.part('accChords', I.accordion({ musette: 9, reeds: 2, bright: 0.6 }), { gain: -9, pan: -0.1, sends: { room: -8 } });
    K.padChords(accCh, K.harmTimeline(HB, 3, bar(16)), 'F3', 'D5', 3, 0.5);

    // B: glockenspiel sings Pim's theme (waltz), celesta doubles an octave below
    const glock = song.part('glock', I.modal('glock', { decay: 0.8 }), { gain: -6, pan: 0.25, sends: { hall: -6 }, choke: 'pitch', humanize: { t: 6, v: 0.05 } });
    glock.add(bar(16), K.pimWaltz({ transpose: 17, vel: 0.62, bars: [0, 1, 2, 3] }));
    glock.add(bar(24), T.transposeEv(T.parse(melA, { bar: 3, vel: 0.4 }), 12));
    const cel = song.part('celesta', I.modal('celesta'), { gain: -8, pan: -0.2, sends: { hall: -6 }, choke: 'pitch' });
    cel.add(bar(16), K.pimWaltz({ transpose: 5, vel: 0.55, bars: [0, 1, 2, 3] }));

    // waltz accompaniment: upright bass on 1, uke on 2 & 3
    const bass = song.part('bass', I.pluck('upright', { t60: 2 }), { gain: -8, sends: { room: -14 }, humanize: { t: 5, v: 0.05 } });
    const uke = song.part('uke', I.pluck('uke', { muteT: 0.06 }), { gain: -7, pan: -0.3, sends: { room: -8 }, humanize: { t: 6, v: 0.07 } });
    let prev = null;
    harm.forEach((h, i) => {
      const c = T.chord(h.sym);
      const r = T.pcAtOrAbove(c.bass, T.nm('A1'));
      const alt = (Math.floor(h.b / 3) % 2 === 1) && c.bass === c.root;
      bass.note(h.b, alt ? T.pcAtOrAbove((c.root + 7) % 12, r - 7) : r, 0.9, 0.8, { leg: 0.9 });
      const v = T.voiceLead(prev, h.sym, 'G3', 'F4', 3); prev = v;
      for (let k = 1; k < h.d; k++) uke.chord(h.b + k, v, 0.35, k === 1 ? 0.55 : 0.48, { strum: 0.01 });
    });

    // light percussion
    const shk = song.part('shaker', D.shaker({ decay: 0.06 }), { gain: 1, pan: 0.35, sends: { room: -10 }, humanize: { t: 6, v: 0.1 } });
    const tri = song.part('triangle', D.triangle({ decay: 2.2 }), { gain: -14, pan: 0.45, sends: { hall: -6 } });
    for (let b = 0; b < 32; b++) {
      shk.add(bar(b), T.grid('x.o.o.', 0.5, { vmap: { x: 0.5, o: 0.35 } }));
      if (b % 8 === 0) tri.note(bar(b), 60, 1, 0.6);
    }
    return song;
  },
};
