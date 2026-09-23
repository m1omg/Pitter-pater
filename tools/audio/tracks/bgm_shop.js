'use strict';
// Shop jingle for the gumball-machine shopkeeper. Cute bossa-nova-ish loop, 100 BPM, F major, 16 bars.
// Vibraphone lead, nylon guitar "batida" comping, upright bass (root/fifth), 3-2 clave rim clicks,
// shaker, soft kick, and a toy piano winking with the "pit-ter pat-ter" cell.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_shop', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_shop', bpm: 100, loopBars: 16, tailSec: 4.5, seed: 1616, master: { sat: 1.05 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 1.2, predelay: 0.015, hp: 200, lp: 7000, er: 0.35 });
    const H = [
      [['Fmaj7', 4]], [['Gm7', 2], ['C7', 2]], [['Fmaj7', 4]], [['Bbmaj7', 4]], [['Am7', 4]], [['D7b9', 4]], [['Gm7', 4]], [['C7sus4', 2], ['C7', 2]],
      [['Fmaj7', 4]], [['F7', 4]], [['Bbmaj7', 4]], [['Bbm6', 4]], [['Am7', 4]], [['Abdim7', 4]], [['Gm7', 4]], [['C7', 2], ['C7b9', 2]],
    ];
    const harm = K.harmTimeline(H, 4, 0);

    const vib = song.part('vibes', I.modal('vibes', { decay: 0.9 }), { gain: 0, pan: 0.15, sends: { room: -7 }, humanize: { t: 9, v: 0.07 } });
    vib.add(0, T.parse(
      'r/8 A5/8 G5/8 A5/4 E5/8 C5/4 | r/8 D5/8 F5/8 Bb5/4 A5/8 G5/4 | E5/2. r/8 C5/8 | D5/8 F5/8 A5/8 C6/8 r/8 Bb5/8 A5/4 | ' +
      'G5/4. E5/8 C5/4 A4/4 | F#5/8 A5/8 C6/8 Eb6/8 r/8 D6/8 C6/4 | Bb5/4. A5/8 G5/4 F5/4 | G5/2 E5/4 r/4 | ' +
      'r/8 A5/8 G5/8 A5/4 E5/8 C5/4 | r/8 Eb5/8 F5/8 A5/4 G5/8 Eb5/4 | D5/4. C5/8 D5/4 F5/4 | Db5/4. C5/8 Bb4/4 G4/4 | ' +
      'C5/8 E5/8 G5/8 A5/8 r/8 G5/8 E5/4 | F5/8 D5/8 B4/8 Ab4/8 r/8 B4/8 D5/4 | Bb4/4. D5/8 F5/4 A5/4 | G5/4 E5/4 Db5/4 Bb4/4 |', { vel: 0.7 }));

    // nylon guitar batida: thumb on 1 & 3 (root/fifth), fingers syncopated (2-bar pattern)
    const gtr = song.part('guitar', I.pluck('nylon', { muteT: 0.08 }), { gain: -4, pan: -0.3, sends: { room: -9 }, humanize: { t: 6, v: 0.07 } });
    const thumb = song.part('thumb', I.pluck('nylon', { muteT: 0.12, bright: 1500 }), { gain: -3, pan: -0.2, sends: { room: -12 }, humanize: { t: 5, v: 0.05 } });
    let prev = null;
    const P1 = [0, 1.5, 2.5], P2 = [0.5, 1.5, 3];
    harm.forEach((h) => {
      const v = T.voiceLead(prev, h.sym, 'A3', 'G4', 3, { omitRoot: true }); prev = v;
      const barIdx = Math.floor(h.b / 4);
      const pat = barIdx % 2 === 0 ? P1 : P2;
      for (const o of pat) { const bb = h.b - (h.b % 4) + o; if (bb >= h.b && bb < h.b + h.d) gtr.chord(bb, v, 0.45, 0.55, { strum: 0.008 }); }
      const c = T.chord(h.sym); const r = T.pcAtOrAbove(c.bass, T.nm('A1'));
      const fifth = T.pcAtOrAbove((c.root + (c.iv.includes(6) && !c.iv.includes(7) ? 6 : 7)) % 12, r - 12 < T.nm('E1') ? r + 1 : r - 12 + 1);
      thumb.note(h.b, r, 1.2, 0.75, { leg: 0.9 });
      if (h.d >= 4) thumb.note(h.b + 2, fifth, 1.2, 0.65, { leg: 0.9 });
    });

    // upright bass doubling the thumb an octave lower, softly
    const bass = song.part('bass', I.pluck('upright', { t60: 1.8 }), { gain: -8, sends: { room: -14 }, humanize: { t: 5, v: 0.05 } });
    harm.forEach((h) => { const c = T.chord(h.sym); const r = T.pcAtOrAbove(c.bass, T.nm('E1')); bass.note(h.b, r, 1.4, 0.7); if (h.d >= 4) bass.note(h.b + 2, T.pcAtOrAbove((c.root + 7) % 12, r - 6), 1.4, 0.6); });

    // toy piano winks: the pitter-patter cell at phrase ends
    const toy = song.part('toy', I.modal('toypiano'), { gain: -8, pan: 0.4, sends: { room: -6 }, humanize: { t: 5, v: 0.05 } });
    toy.add(bar(3) + 2.5, T.parse('C6/16 C6/16 A5/16 A5/16 r/4', { vel: 0.55 }).map((e) => e));
    toy.add(bar(7) + 3, T.parse('G5/16 G5/16 E5/16 E5/16', { vel: 0.5 }));
    toy.add(bar(11) + 2.5, T.parse('Db6/16 Db6/16 Bb5/16 Bb5/16 r/4', { vel: 0.55 }));
    toy.add(bar(15) + 3, T.parse('E5/16 G5/16 Bb5/16 C6/16', { vel: 0.5 }));

    // percussion: 3-2 clave on rim, shaker 16ths, soft kick on 1 & 3
    const rim = song.part('rim', D.block({ f: 1900, ratio: 1.8, decay: 0.03, click: 0.55, second: 0.35 }), { gain: 0, pan: 0.2, sends: { room: -6 }, humanize: { t: 4, v: 0.05 } });
    const shk = song.part('shaker', D.shaker({ decay: 0.05 }), { gain: 1, pan: -0.35, sends: { room: -10 }, humanize: { t: 5, v: 0.1 } });
    const kick = song.part('kick', D.kick({ f0: 55, f1: 100, decay: 0.25, click: 0.08, drive: 1.1 }), { gain: -6, humanize: { t: 4, v: 0.05 } });
    for (let b = 0; b < 16; b += 2) rim.add(bar(b), T.grid('x..x..x...x.x...', 0.5, { vmap: { x: 0.7 } }));
    for (let b = 0; b < 16; b++) {
      shk.add(bar(b), T.grid('xoooxoooxoooxooo', 0.25, { vmap: { x: 0.55, o: 0.28 } }));
      kick.add(bar(b), T.grid('x.......x.....x.', 0.25, { vmap: { x: 0.65 } }));
    }
    return song;
  },
};
