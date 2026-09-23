'use strict';
// Boss battle - heavier, quirky-epic. 152 BPM, C minor.
// Intro (2 bars): organ swell + timpani roll + brass hit. Loop (32 bars):
// A: chromatic gritty-bass riff + syncopated brass stabs | A2: driven organ lead over the riff |
// B: epic lift (Ab-Bb-Gm-Cm ... Db Neapolitan) with brass fanfare and tribal toms |
// C: fast saw arpeggios + brass quoting Pim's theme in C minor.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_boss', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_boss', bpm: 152, introBars: 2, loopBars: 32, tailSec: 3.5, seed: 1010, master: { sat: 1.2 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 1.0, predelay: 0.01, hp: 250, lp: 7500, er: 0.4 });
    song.bus('hall', { type: 'reverb', t60: 2.2, predelay: 0.025, hp: 300, lp: 8000, er: 0.1, seed: 101 });

    const HA = [[['Cm', 4]], [['Cm', 4]], [['Ab', 4]], [['Bb', 4]], [['Cm', 4]], [['Cm', 4]], [['Ab', 4]], [['G7', 4]]];
    const HB = [[['Ab', 4]], [['Bb', 4]], [['Gm', 4]], [['Cm', 4]], [['Ab', 4]], [['Bb', 4]], [['Db', 4]], [['G7', 4]]];
    const HC = [[['Cm', 4]], [['Ab', 4]], [['Fm', 4]], [['G7', 2], ['Cm', 2]], [['Cm', 4]], [['Ab', 4]], [['Dm7b5', 2], ['G7', 2]], [['G7', 2], ['Cm', 2]]];
    const harm = [...K.harmTimeline(HA, 4, 0), ...K.harmTimeline(HA, 4, bar(8)), ...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HC, 4, bar(24))];

    // ---- gritty bass: riff in A/A2, driving 8ths in B/C
    const bass = song.part('bass', I.synthBass({ saw: 1, sq: 0.35, sub: 0.6, cutoff: 360, envAmt: 2200, fdecay: 0.07, q: 2, drive: 3.2, detune: 12 }), { gain: -4, humanize: { t: 2, v: 0.03 } });
    const riff = 'C2/8 C2/8 r/8 C2/8 Eb2/8 C2/8 G2/8 F#2/8 | F2/8 Eb2/8 r/8 C2/8 Bb1/8 C2/8 r/8 G1/8 | Ab1/8 Ab1/8 r/8 Ab1/8 C2/8 Ab1/8 Eb2/8 D2/8 | Bb1/8 Bb1/8 r/8 Bb1/8 D2/8 Bb1/8 F2/8 E2/8 | ' +
      'C2/8 C2/8 r/8 C2/8 Eb2/8 C2/8 G2/8 F#2/8 | F2/8 Eb2/8 r/8 C2/8 Bb1/8 C2/8 r/8 G1/8 | Ab1/8 Ab1/8 r/8 Ab1/8 C2/8 Ab1/8 Eb2/8 D2/8 | G1/8 G1/8 r/8 G1/8 B1/8 D2/8 F2/8 Ab2/8 |';
    bass.add(0, T.parse(riff, { vel: 0.9, legato: 0.75 }));
    bass.add(bar(8), T.parse(riff, { vel: 0.9, legato: 0.75 }));
    for (const h of [...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HC, 4, bar(24))]) {
      const r = T.bassNote(h.sym, 'G1');
      for (let k = 0; k < h.d * 2; k++) bass.note(h.b + k * 0.5, k % 4 === 3 ? r + 12 : r, 0.5, k % 2 ? 0.75 : 0.92, { leg: 0.72 });
    }
    // intro: bass drop
    bass.note(bar(-1) + 3, 'G1', 1, 0.9, { leg: 0.9 });

    // ---- brass stabs (A) and fanfare (B), theme quote (C)
    const stabs = song.part('stabs', I.brass({ voices: 3, spread: 12, attack: 0.012, decay: 0.15, sustain: 0.5, release: 0.08, fm: 0.6, bright: 1.2 }), { gain: -5, pan: 0.1, sends: { hall: -9 } });
    let prev = null;
    for (const h of K.harmTimeline(HA, 4, 0)) {
      const v = T.voiceLead(prev, h.sym, 'G3', 'G4', 3); prev = v;
      for (const o of [0, 0.75, 1.5, 2.5, 3]) v.forEach((m) => stabs.note(h.b + o, m, 0.3, o === 0 ? 0.95 : 0.8, { leg: 0.8 }));
    }
    for (const h of K.harmTimeline(HA, 4, bar(8))) {
      const v = T.voiceLead(prev, h.sym, 'G3', 'G4', 3); prev = v;
      for (const o of [0, 2.5]) v.forEach((m) => stabs.note(h.b + o, m, 0.3, 0.75, { leg: 0.8 }));
    }
    const fan = song.part('fanfare', I.brass({ voices: 4, spread: 8, attack: 0.035, decay: 0.3, sustain: 0.85, release: 0.15, fm: 0.45, bright: 1.25 }), { gain: -4, pan: -0.05, sends: { hall: -6 } });
    const fanB = 'C5/4. Eb5/8 Ab5/2 | Bb4/4. D5/8 F5/2 | G5/4. F5/8 D5/4 Bb4/4 | C5/2. G4/4 | Ab4/4. C5/8 Eb5/4 Ab5/4 | G5/4. F5/8 D5/4 F5/4 | Ab5/2 F5/4 Db5/4 | D5/2 B4/4 G4/4 |';
    fan.add(bar(16), T.parse(fanB, { vel: 0.9, legato: 0.95 }));
    fan.add(bar(16), T.transposeEv(T.parse(fanB, { vel: 0.75, legato: 0.95 }), -12));
    const qt = K.pimTheme({ mode: ['C', 'minor'], vel: 0.9, legato: 0.9 });
    fan.add(bar(24), T.transposeEv(qt, 12));
    const hit = song.part('hit', I.brass({ voices: 5, spread: 14, attack: 0.01, decay: 0.5, sustain: 0.3, release: 0.3, fm: 0.7 }), { gain: -2, sends: { hall: -3 } });
    hit.chord(bar(-1) + 3, ['G2', 'D3', 'G3', 'B3', 'F4'], 1, 1);

    // ---- organ: swell in intro, lead in A2, chords in B/C
    const organ = song.part('organ', I.organ({ bars: [8, 0, 8, 6, 4, 4, 0, 2, 3], perc: 0.4, click: 0.5, drive: 0.6 }), {
      gain: -6, pan: -0.2, sends: { room: -8 },
      fx: [{ type: 'autopan', rate: 6.4, depth: 0.35 }, { type: 'chorus', rate: 6.4, depth: 0.0007, base: 0.004, voices: 1, mix: 0.5 }],
    });
    organ.chord(bar(-2), ['C3', 'G3', 'C4', 'Eb4', 'G4'], 7, 0.7, { leg: 1 });
    organ.automate([[bar(-2), -18], [bar(-1) + 2, 0]]);
    const organLead = song.part('organLead', I.organ({ bars: [8, 0, 8, 6, 4, 4, 0, 2, 3], perc: 0.5, click: 0.5, drive: 0.7 }), {
      gain: 4, pan: 0.05, sends: { room: -8, hall: -12 },
      fx: [{ type: 'autopan', rate: 6.4, depth: 0.3 }, { type: 'chorus', rate: 6.4, depth: 0.0007, base: 0.004, voices: 1, mix: 0.5 }],
    });
    organLead.add(bar(8), T.parse(
      'G4/8 C5/8 Eb5/8 G5/8 F#5/8 G5/8 r/8 Eb5/8 | F5/8 Eb5/8 D5/8 C5/8 B4/8 C5/8 D5/4 | Eb5/8 Ab5/8 C6/8 Ab5/8 G5/8 Ab5/8 r/8 F5/8 | G5/8 F5/8 D5/8 Bb4/8 A4/8 Bb4/8 D5/4 | ' +
      'G5/4. Eb5/8 C5/4 G4/4 | Ab4/8 G4/8 F#4/8 G4/8 Eb5/4 D5/4 | C5/4. Eb5/8 Ab5/4 G5/4 | F5/8 Eb5/8 D5/8 B4/8 G4/4 r/4 |', { vel: 0.85, legato: 0.85 }));
    prev = null;
    for (const h of [...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HC, 4, bar(24))]) {
      const v = T.voiceLead(prev, h.sym, 'C4', 'C5', 3); prev = v;
      v.forEach((m) => organ.note(h.b, m, h.d, 0.55, { leg: 1 }));
    }

    // ---- fast saw arps (C) and softer in B
    const arp = song.part('arp', I.synthPluck({ wave: 'saw', cutoff: 1800, envAmt: 3500, decay: 0.1, q: 1.5 }), { gain: -8, pan: 0.35, sends: { room: -8 } });
    for (const h of [...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HC, 4, bar(24))]) {
      const v = T.closeVoicing(h.sym, 'C5'); const pat = [0, 1, 2, 3, 2, 1, 0, 2];
      const inC = h.b >= bar(24);
      for (let k = 0; k < h.d * 4; k++) arp.note(h.b + k * 0.25, v[pat[k % 8] % v.length] + (pat[k % 8] >= v.length ? 12 : 0), 0.25, (k % 4 === 0 ? 0.75 : 0.55) * (inC ? 1 : 0.7), { leg: 0.55 });
    }

    // ---- drums
    const kick = song.part('kick', D.kick({ f0: 48, f1: 170, pdecay: 0.025, decay: 0.28, click: 0.6, drive: 2.4 }), { gain: -1, humanize: { t: 2, v: 0.03 } });
    const snare = song.part('snare', D.snare({ f: 190, decay: 0.18, hp: 1200, lp: 10000, body: 0.7, snap: 1.3, drive: 1.8 }), { gain: 3, sends: { room: -5 }, humanize: { t: 3, v: 0.04 } });
    const hat = song.part('hat', D.hat({ decay: 0.03 }), { gain: 3, pan: 0.3, sends: { room: -14 }, humanize: { t: 3, v: 0.08 } });
    const crash = song.part('crash', D.cymbal({ decay: 2 }), { gain: -11, pan: -0.3, sends: { room: -8 } });
    const toms = song.part('toms', D.tom({ decay: 0.4, drive: 1.8, noise: 0.35 }), { gain: -4, sends: { room: -5, hall: -12 }, humanize: { t: 3, v: 0.05 } });
    const timp = song.part('timp', D.timpani({ decay: 1.8, mallet: 0.4 }), { gain: -3, sends: { hall: -6 } });
    // intro timpani roll crescendo on G
    timp.add(bar(-2), T.grid('x.x.x.x.xxxxxxxxXXXXXXXXXXXX....', 0.25, { vmap: { x: 0.35, X: 0.75 } }).map((e) => Object.assign(e, { m: 43 })));
    crash.note(bar(-1) + 3, 60, 2, 0.8);
    for (let b = 0; b < 32; b++) {
      const sec = Math.floor(b / 8), last = b % 8 === 7;
      if (b % 8 === 0) { crash.note(bar(b), 60, 2, 0.9); }
      if (sec <= 1) {
        kick.add(bar(b), T.grid('X..X..X...X.X...', 0.25));
        snare.add(bar(b), T.grid(last ? '....X.......XXXX' : '....X.......X...', 0.25, { vmap: { X: 0.9 } }));
        hat.add(bar(b), T.grid('x.x.x.x.x.x.x.x.', 0.25, { vmap: { x: 0.7 } }));
      } else if (sec === 2) {
        kick.add(bar(b), T.grid('X.......X.......', 0.25));
        toms.add(bar(b), T.grid('X.x.X.x.X.xxX.x.', 0.25, { vmap: { X: 0.9, x: 0.55 } }).map((e, k) => Object.assign(e, { m: [45, 45, 41, 41, 45, 45, 38, 38, 41, 38][k % 10] })));
        snare.add(bar(b), T.grid('....X.......X...', 0.25));
        if (b % 2 === 0) timp.note(bar(b), T.bassNote(HB[b - 16][0][0], 'G2'), 1, 0.7);
      } else {
        kick.add(bar(b), T.grid('X.X.X.X.X.X.X.X.', 0.25, { vmap: { X: 0.85 } }));
        snare.add(bar(b), T.grid(last ? '....X...XXXXXXXX' : '....X.......X...', 0.25, { vmap: { X: 0.9 } }));
        hat.add(bar(b), T.grid('xoxoxoxoxoxoxoxo', 0.25, { vmap: { x: 0.75, o: 0.4 } }));
      }
      if (last && sec !== 3) toms.add(bar(b) + 3, T.grid('XxXx', 0.25).map((e, k) => Object.assign(e, { m: [48, 45, 41, 38][k] })));
    }
    return song;
  },
};
