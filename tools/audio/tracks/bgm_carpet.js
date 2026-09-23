'use strict';
// "Carpet Hills" - the living room as rolling hills. Adventurous swung stroll: flute lead (opens with the
// rising "hill" figure from bar 3 of Pim's theme, in G), walking upright bass, brushed swing drums,
// strummed guitar. 104 BPM, G major with an E-minor bridge. Form A A2 B A3 (32 bars).
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_carpet', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_carpet', bpm: 104, loopBars: 32, tailSec: 4.5, seed: 505, master: { sat: 1.1, lp: 13000 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 1.1, predelay: 0.012, hp: 180, lp: 6500, er: 0.4, erTime: 0.04 });
    song.bus('hall', { type: 'reverb', t60: 2.3, predelay: 0.03, hp: 250, lp: 7500, er: 0.12, seed: 21 });
    const SW = { swing: 0.75, swingUnit: 0.5 };

    const HA = [[['G', 4]], [['Bm7', 4]], [['C', 4]], [['D7', 4]], [['G', 4]], [['Em7', 4]], [['Am7', 2], ['D7', 2]], [['G', 4]]];
    const HA2 = [[['G', 4]], [['Bm7', 4]], [['C', 4]], [['Cm6', 4]], [['G/D', 4]], [['E7', 4]], [['Am7', 2], ['D7', 2]], [['G', 4]]];
    const HB = [[['Em', 4]], [['Em/D', 4]], [['C6', 4]], [['B7', 4]], [['Em', 4]], [['A7', 4]], [['Am7', 4]], [['D7', 4]]];
    const HA3 = [[['G', 4]], [['Bm7', 4]], [['C', 4]], [['Cm6', 4]], [['G/D', 4]], [['E7', 4]], [['Am7', 2], ['D7', 2]], [['G', 2], ['D7', 2]]];
    const harm = [...K.harmTimeline(HA, 4, 0), ...K.harmTimeline(HA2, 4, bar(8)), ...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HA3, 4, bar(24))];

    const mA = 'G4/8 A4/8 B4/8 D5/8 E5/4 D5/8 B4/8 | D5/4 B4/8 A4/8 F#4/2 | E5/8 E5/8 C5/8 C5/8 D5/8 C5/8 B4/4 | A4/4. B4/8 C5/4 A4/4 | ' +
      'G4/8 A4/8 B4/8 D5/8 G5/4 F#5/8 E5/8 | D5/4 B4/8 G4/8 E5/2 | C5/8 B4/8 A4/8 G4/8 F#4/8 A4/8 C5/8 E5/8 | D5/4 B4/4 G4/2 |';
    const mA2 = 'G4/8 A4/8 B4/8 D5/8 E5/4 D5/8 B4/8 | D5/4 B4/8 A4/8 F#4/2 | E5/8 E5/8 C5/8 C5/8 D5/8 C5/8 B4/4 | Eb5/4. D5/8 C5/4 A4/4 | ' +
      'B4/8 D5/8 G5/8 D5/8 B4/4 G4/4 | G#4/8 B4/8 D5/8 E5/8 D5/4 B4/4 | C5/8 E5/8 A5/8 G5/8 F#5/8 D5/8 C5/8 A4/8 | G4/2 r/4 B4/8 C5/8 |';
    const mB = 'B4/4. E5/8 G5/4 F#5/8 E5/8 | D5/2 B4/4 A4/4 | G4/4. A4/8 B4/4 C5/4 | D#5/2. F#5/4 | ' +
      'E5/4. B4/8 G4/4 E4/4 | C#5/8 E5/8 A5/8 G5/8 E5/4 C#5/4 | C5/4 A4/4 E5/4 C5/4 | D5/8 E5/8 F#5/8 A5/8 C6/4 A5/4 |';
    const mA3 = mA2.replace('G4/2 r/4 B4/8 C5/8 |', 'G4/2 r/2 |');

    // ---- flute lead
    const flute = song.part('flute', I.flute({ vib: 13, breath: 0.07, chiff: 0.3 }), Object.assign({ gain: -1, pan: 0.08, sends: { room: -9, hall: -11 }, humanize: { t: 7, v: 0.06 } }, SW));
    flute.add(0, T.parse(mA, { vel: 0.75 }));
    flute.add(bar(8), T.parse(mA2, { vel: 0.78 }));
    flute.add(bar(16), T.parse(mB, { vel: 0.8, legato: 0.98 }));
    flute.add(bar(24), T.parse(mA3, { vel: 0.8 }));

    // ---- walking upright bass
    const bass = song.part('bass', I.pluck('upright'), Object.assign({ gain: -2, pan: -0.05, sends: { room: -14 }, humanize: { t: 6, v: 0.06 } }, SW));
    K.walkingBass(bass, harm, { lo: 'E1', hi: 'C3', start: 'G1', seed: 55, vel: 0.82 });

    // ---- strummed guitar: quarter-note strums, 2 & 4 accented, short
    const gtr = song.part('guitar', I.pluck('guitar', { muteT: 0.06, bright: 3800, t60: 2.5 }), Object.assign({ gain: -4, pan: -0.35, sends: { room: -8 }, humanize: { t: 6, v: 0.08 } }, SW));
    let prev = null;
    harm.forEach((h) => {
      const v = T.voiceLead(prev, h.sym, 'D3', 'E4', 4, { omit5: false }); prev = v;
      for (let k = 0; k < h.d; k++) gtr.chord(h.b + k, v, 0.42, k % 2 ? 0.62 : 0.45, { strum: 0.014 });
    });

    // ---- warm pad under the bridge
    const pad = song.part('pad', I.pad({ attack: 0.9, release: 1.4, lp: 1300 }), { gain: -14, sends: { hall: -6 }, fx: [{ type: 'chorus', rate: 0.5, depth: 0.003, mix: 0.4 }] });
    K.padChords(pad, K.harmTimeline(HB, 4, bar(16)), 'G3', 'D5', 3, 0.5);

    // ---- brushes: sweeps, taps on 2&4, ride pattern, feathered kick, hat foot
    const sweep = song.part('sweep', D.sweep({ fc: 4200 }), { gain: -5, pan: 0.1, sends: { room: -10 } });
    const brush = song.part('brush', D.brush({ decay: 0.12 }), Object.assign({ gain: 3, pan: 0.1, sends: { room: -8 }, humanize: { t: 5, v: 0.08 } }, SW));
    const ride = song.part('ride', D.cymbal({ kind: 'ride', decay: 1.6, lp: 9000 }), Object.assign({ gain: -8, pan: 0.35, sends: { room: -10 }, humanize: { t: 5, v: 0.08 } }, SW));
    const kick = song.part('kick', D.kick({ f0: 52, f1: 95, decay: 0.3, click: 0.05, drive: 1.1 }), { gain: -3, humanize: { t: 5, v: 0.08 } });
    const hatf = song.part('hatfoot', D.hat({ decay: 0.03, lp: 8000 }), Object.assign({ gain: 6, pan: 0.3, sends: { room: -12 } }, SW));
    for (let b = 0; b < 32; b++) {
      sweep.note(bar(b), 60, 2, 0.6, { leg: 1 }); sweep.note(bar(b) + 2, 60, 2, 0.55, { leg: 1 });
      brush.add(bar(b), T.grid(b % 4 === 3 ? '..X...xX' : '..X...X.', 0.5, { vmap: { X: 0.8, x: 0.45 } }));
      ride.add(bar(b), T.grid('x.xxx.xx', 0.5, { vmap: { x: 0.55 } }));
      kick.add(bar(b), T.grid('x.x.x.x.', 0.5, { vmap: { x: 0.35 } }));
      hatf.add(bar(b), T.grid('..x...x.', 0.5, { vmap: { x: 0.45 } }));
    }
    return song;
  },
};
