'use strict';
// Normal battle - catchy and fun, not scary. 144 BPM, E minor with a G-major lift.
// Intro: 1 bar (snare fill, brass hit, riser). Loop: A (hook) | A2 (hook, doubled + chip arps) |
// B (G-major lift, brass lead) | C (breakdown: chip lead quotes Pim's theme in E minor, snare build).
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const K = require('../lib/comp');

module.exports = {
  id: 'bgm_battle', type: 'bgm',
  build() {
    const song = new S.Song({ id: 'bgm_battle', bpm: 144, introBars: 1, loopBars: 32, tailSec: 3.5, seed: 909, master: { sat: 1.15 } });
    const bar = (n) => song.bar(n);
    song.bus('room', { type: 'reverb', t60: 0.9, predelay: 0.01, hp: 250, lp: 8000, er: 0.35 });
    song.bus('hall', { type: 'reverb', t60: 1.8, predelay: 0.02, hp: 300, lp: 9000, er: 0.1, seed: 91 });
    song.bus('echo', { type: 'delay', time: 60 / 144 * 0.75, fb: 0.3, lp: 5000, hp: 500, ret: -3, sends: { hall: -8 } });

    const HA = [[['Em', 4]], [['C', 4]], [['G', 4]], [['D', 4]], [['Em', 4]], [['C', 4]], [['Am', 4]], [['B7', 4]]];
    const HB = [[['Cmaj7', 4]], [['D', 4]], [['Bm7', 4]], [['Em7', 4]], [['Am7', 4]], [['D', 4]], [['G', 4]], [['B7', 4]]];
    const HC = [[['Em', 4]], [['C', 4]], [['Am', 4]], [['B7', 2], ['Em', 2]], [['Em', 4]], [['C', 4]], [['Am7', 2], ['B7', 2]], [['B7sus4', 2], ['B7', 2]]];
    const harm = [...K.harmTimeline(HA, 4, 0), ...K.harmTimeline(HA, 4, bar(8)), ...K.harmTimeline(HB, 4, bar(16)), ...K.harmTimeline(HC, 4, bar(24))];

    const hookA = 'E5/4. G5/4. F#5/4 | E5/8 D5/8 E5/8 G5/8 r/8 A5/8 G5/8 E5/8 | D5/4. G5/4. B5/4 | A5/8 G5/8 F#5/8 D5/8 r/8 E5/8 F#5/8 A5/8 | ' +
      'B5/4. E6/4. D6/4 | C6/8 B5/8 G5/8 E5/8 r/8 G5/8 A5/8 B5/8 | C6/4. B5/4. A5/4 | B5/8 A5/8 G5/8 F#5/8 D#5/4 B4/4 |';
    const leadB = 'G5/2 E5/4 G5/4 | A5/2. F#5/4 | D6/4. B5/8 A5/4 F#5/4 | G5/2. r/4 | C6/4. B5/8 A5/4 E5/4 | F#5/4. G5/8 A5/2 | B5/4 A5/8 G5/8 D5/4 G5/4 | F#5/2 D#5/4 F#5/4 |';

    // ---- pulse lead (hook) + second voice a third/sixth below in A2
    const lead = song.part('lead', I.chipLead({ pw: 0.25, vib: 20, vibDelay: 0.14 }), { gain: -2, pan: 0.05, sends: { room: -10, echo: -12 } });
    lead.add(0, T.parse(hookA, { vel: 0.85 }));
    lead.add(bar(8), T.parse(hookA, { vel: 0.9 }));
    const lead2 = song.part('lead2', I.chipLead({ pw: 0.125, vib: 16, vibDelay: 0.16 }), { gain: -9, pan: -0.25, sends: { room: -10, echo: -14 } });
    lead2.add(bar(8), T.transposeEv(T.parse(hookA, { vel: 0.8 }), -12));
    // ---- brass: stabs in A, lead in B
    const brass = song.part('brass', I.brass({ voices: 3, spread: 9, attack: 0.018, decay: 0.18, sustain: 0.6, release: 0.1, fm: 0.45, bright: 1.1 }), { gain: -5, pan: -0.1, sends: { hall: -9 }, humanize: { t: 4, v: 0.05 } });
    let prev = null;
    for (const h of [...K.harmTimeline(HA, 4, 0), ...K.harmTimeline(HA, 4, bar(8))]) {
      const v = T.voiceLead(prev, h.sym, 'E4', 'E5', 3); prev = v;
      for (const [o, d] of [[0, 0.4], [1.5, 0.4], [3, 0.35]]) v.forEach((m) => brass.note(h.b + o, m, d, 0.78, { leg: 0.9 }));
    }
    const brassLead = song.part('brassLead', I.brass({ voices: 3, spread: 7, attack: 0.03, decay: 0.3, sustain: 0.8, release: 0.15, fm: 0.4, bright: 1.2 }), { gain: -3, pan: 0.1, sends: { hall: -7, echo: -14 } });
    brassLead.add(bar(16), T.parse(leadB, { vel: 0.85, legato: 0.95 }));
    brassLead.add(bar(16), T.transposeEv(T.parse(leadB, { vel: 0.7, legato: 0.95 }), -12));
    // hit in the intro
    const hit = song.part('hit', I.brass({ voices: 4, spread: 12, attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.3, fm: 0.6 }), { gain: -3, sends: { hall: -4 } });
    hit.chord(bar(-1), ['E3', 'B3', 'E4', 'G4', 'B4'], 0.75, 0.95);

    // ---- chip arpeggios (A2, C)
    const arp = song.part('arp', I.synthPluck({ wave: 'sq', pw: 0.125, cutoff: 2500, envAmt: 3000, decay: 0.12 }), { gain: -9, pan: 0.3, sends: { echo: -10 } });
    for (const h of [...K.harmTimeline(HA, 4, bar(8)), ...K.harmTimeline(HC, 4, bar(24))]) {
      const v = T.closeVoicing(h.sym, 'E5');
      const pat = [0, 1, 2, 3, 2, 1];
      for (let k = 0; k < h.d * 4; k++) arp.note(h.b + k * 0.25, v[pat[k % pat.length] % v.length], 0.25, k % 4 === 0 ? 0.7 : 0.5, { leg: 0.6 });
    }
    // ---- C section: chip lead quotes Pim's theme in E minor (last bar reshaped to lead back)
    const quote = song.part('quote', I.chipLead({ pw: 0.5, vib: 25, vibDelay: 0.2, tri: 1 }), { gain: 1, pan: -0.05, sends: { room: -8, echo: -10 } });
    const th = K.pimTheme({ mode: ['E', 'minor'], transpose: 0, vel: 0.85, bars: [0, 1, 2, 3, 4, 5, 6] });
    quote.add(bar(24), T.transposeEv(th, 12));
    quote.add(bar(31), T.parse('B5/4 F#5/8 G5/8 F#5/4 D#5/4', { vel: 0.85 }));

    // ---- synth bass: octave bounce in 8ths
    const bass = song.part('bass', I.synthBass({ cutoff: 420, envAmt: 1500, fdecay: 0.09, q: 1.6, sub: 0.55, drive: 1.8 }), { gain: -4, humanize: { t: 2, v: 0.04 } });
    for (const h of harm) {
      const r = T.bassNote(h.sym, 'A1');
      const breakdown = h.b >= bar(24) && h.b < bar(28);
      for (let k = 0; k < h.d * 2; k++) {
        if (breakdown && k % 2) continue;
        bass.note(h.b + k * 0.5, k % 2 ? r + 12 : r, 0.5, k % 2 ? 0.72 : 0.9, { leg: 0.7 });
      }
    }
    bass.note(bar(-1) + 2, 'B1', 0.5, 0.9); bass.note(bar(-1) + 3, 'B1', 0.5, 0.9); bass.note(bar(-1) + 3.5, 'D#2', 0.5, 0.9);

    // ---- drums
    const kick = song.part('kick', D.kick({ f0: 50, f1: 160, pdecay: 0.028, decay: 0.3, click: 0.5, drive: 2 }), { gain: 0, humanize: { t: 2, v: 0.03 } });
    const snare = song.part('snare', D.snare({ f: 200, decay: 0.16, hp: 1300, lp: 10000, body: 0.55, snap: 1.2, drive: 1.5 }), { gain: 3, pan: 0.05, sends: { room: -6 }, humanize: { t: 3, v: 0.04 } });
    const hat = song.part('hat', D.hat({ decay: 0.035, lp: 13000 }), { gain: 5, pan: 0.25, sends: { room: -14 }, humanize: { t: 3, v: 0.08 } });
    const crash = song.part('crash', D.cymbal({ decay: 1.8 }), { gain: -12, pan: -0.3, sends: { room: -8 } });
    const toms = song.part('toms', D.tom({ decay: 0.35, drive: 1.6 }), { gain: -6, sends: { room: -6 } });
    const riser = song.part('riser', D.swell({ fc0: 1000, fc1: 9000 }), { gain: -10, sends: { hall: -6 } });
    // intro: snare 16ths crescendo + riser
    snare.add(bar(-1), T.grid('x.x.xxxxXXXXXXXX', 0.25, { vmap: { x: 0.45, X: 0.8 } }));
    riser.note(bar(-1), 60, 4, 0.8, { leg: 1, noHuman: true });
    for (let b = 0; b < 32; b++) {
      const sec = Math.floor(b / 8), last = b % 8 === 7;
      if (b % 8 === 0) crash.note(bar(b), 60, 2, 0.85);
      if (sec <= 1) { // A, A2: rock beat
        kick.add(bar(b), T.grid(last ? 'X.....x.X.x.....' : 'X.....x.X.....x.', 0.25));
        snare.add(bar(b), T.grid(last ? '....X.......XoXX' : '....X.......X...', 0.25));
        hat.add(bar(b), T.grid(sec === 0 ? 'x.o.x.o.x.o.x.o.' : 'xoxoxoxoxoxoxoxo', 0.25, { vmap: { x: 0.8, o: 0.4 } }));
      } else if (sec === 2) { // B: four on the floor, driving
        kick.add(bar(b), T.grid('X...X...X...X...', 0.25));
        snare.add(bar(b), T.grid(last ? '....X.......X...' : '....X.......X...', 0.25));
        hat.add(bar(b), T.grid('..x...x...x...x.', 0.25, { vmap: { x: 0.9 } }));
        if (last) toms.add(bar(b) + 2, T.grid('xxxxxxxx', 0.25).map((e, k) => Object.assign(e, { m: [50, 50, 47, 47, 43, 43, 40, 40][k] })));
      } else { // C: breakdown then build
        const build = b >= 28;
        kick.add(bar(b), T.grid(build ? 'X...X...X...X...' : 'X.......X.......', 0.25, { vmap: { X: build ? 1 : 0.75 } }));
        hat.add(bar(b), T.grid('..x...x...x...x.', 0.25, { vmap: { x: 0.6 } }));
        if (b >= 30) snare.add(bar(b), T.grid(b === 31 ? 'xxxxxxxxXXXXXXXX' : 'x...x...x.x.x.x.', 0.25, { vmap: { x: 0.5, X: 0.85 } }));
        if (b === 30) riser.note(bar(30), 60, 8, 0.7, { leg: 1, noHuman: true });
      }
    }
    return song;
  },
};
