'use strict';
// Jingles (non-looping): victory, level up, item get, horror sting. Target -16 LUFS.
const S = require('../lib/song');
const I = require('../lib/inst');
const D = require('../lib/drums');
const T = require('../lib/theory');
const C = require('../lib/core');

const base = (id, o) => new S.Song(Object.assign({ id, loop: false, target: -16, ceiling: -1.8, type: 'jingle', oneShotTail: 3.5 }, o));

// ---- victory: toy fanfare in G (the battle's relative major) built on the pitter-patter cell
const victory = {
  id: 'jingle_victory', type: 'jingle',
  build() {
    const s = base('jingle_victory', { bpm: 132, loopBars: 2, seed: 2001, maxDur: 4.3, fadeOut: 0.9 });
    s.bus('hall', { type: 'reverb', t60: 1.8, predelay: 0.02, hp: 250, lp: 9000, er: 0.2 });
    const mel = 'D6/16 D6/16 B5/16 B5/16 C6/16 B5/16 A5/8 B5/8 C6/8 D6/4 | G6/2 r/2 |';
    const toy = s.part('toy', I.modal('toypiano', { detune: 5 }), { gain: 0, pan: 0.1, sends: { hall: -8 }, humanize: { t: 3, v: 0.03 } });
    toy.add(0, T.parse(mel, { vel: 0.85 }));
    const glock = s.part('glock', I.modal('glock'), { gain: -5, pan: -0.15, sends: { hall: -6 } });
    glock.add(0, T.parse(mel, { vel: 0.7 }));
    const brass = s.part('brass', I.brass({ voices: 4, spread: 10, attack: 0.02, decay: 0.5, sustain: 0.7, release: 0.5, fm: 0.5, bright: 1.2 }), { gain: -3, sends: { hall: -6 } });
    brass.chord(3, ['D4', 'F#4', 'A4', 'C5'], 1, 0.75, { leg: 0.9 });
    brass.chord(4, ['G3', 'B3', 'D4', 'G4', 'B4'], 2.2, 0.95, { leg: 1 });
    const bass = s.part('bass', I.synthBass({ cutoff: 500, envAmt: 1200, sub: 0.6 }), { gain: -4 });
    bass.note(3, 'D2', 1, 0.8); bass.note(4, 'G1', 2, 0.9);
    // sparkle arpeggio after the hit
    const sp = s.part('sparkle', I.modal('celesta'), { gain: -6, pan: 0.3, sends: { hall: -4 } });
    ['G6', 'B6', 'D7', 'G7'].forEach((m, k) => sp.note(4.25 + k * 0.17, m, 0.5, 0.6));
    const snare = s.part('snare', D.snare({ decay: 0.12, body: 0.4 }), { gain: 5, sends: { hall: -10 } });
    snare.add(0, T.grid('x.x.xxxxXXXX', 0.25, { vmap: { x: 0.35, X: 0.6 } }));
    const kick = s.part('kick', D.kick({ decay: 0.35, click: 0.4 }), { gain: -3 });
    kick.note(4, 36, 0.5, 0.9);
    const crash = s.part('crash', D.cymbal({ decay: 2 }), { gain: -5, sends: { hall: -8 } });
    crash.note(4, 60, 1, 0.8);
    const timp = s.part('timp', D.timpani({ decay: 1.6 }), { gain: -4, sends: { hall: -6 } });
    timp.note(4, 'G2', 1, 0.85);
    return s;
  },
};

// ---- level up: ascending Fmaj9 sparkle arpeggio + shimmer
const levelup = {
  id: 'jingle_levelup', type: 'jingle',
  build() {
    const s = base('jingle_levelup', { bpm: 150, loopBars: 1, seed: 2002, oneShotTail: 2.2, maxDur: 2.3, fadeOut: 0.7 });
    s.bus('hall', { type: 'reverb', t60: 2.0, predelay: 0.02, hp: 300, lp: 10000, er: 0.1 });
    const notes = ['F4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6', 'A6'];
    const cel = s.part('celesta', I.modal('celesta'), { gain: 0, pan: -0.1, sends: { hall: -5 }, humanize: { t: 2, v: 0.03 } });
    const gl = s.part('glock', I.modal('glock'), { gain: -6, pan: 0.2, sends: { hall: -5 } });
    notes.forEach((m, k) => { cel.note(k * 0.25, m, 0.5, 0.55 + k * 0.03); if (k >= 4) gl.note(k * 0.25, T.nm(m) + 12, 0.5, 0.45); });
    const ch = s.part('chime', I.modal('chime', { decay: 0.5 }), { gain: -8, sends: { hall: -3 } });
    ['C7', 'E7', 'G7'].forEach((m, k) => ch.note(2.5 + k * 0.06, m, 1, 0.45, { pan: -0.4 + 0.4 * k }));
    const pad = s.part('pad', I.pad({ attack: 0.3, release: 1.0, lp: 2600, voices: 4 }), { gain: -9, sends: { hall: -6 } });
    pad.chord(0.5, ['F4', 'A4', 'C5', 'E5', 'G5'], 2.2, 0.6, { leg: 1 });
    const sw = s.part('swell', D.swell({ fc0: 2000, fc1: 12000, metal: 0.8 }), { gain: -4, sends: { hall: -4 } });
    sw.note(0, 60, 2.5, 0.6, { leg: 1, noHuman: true });
    return s;
  },
};

// ---- item get: quick bright arpeggio + sparkle trill
const item = {
  id: 'jingle_item', type: 'jingle',
  build() {
    const s = base('jingle_item', { bpm: 160, loopBars: 1, seed: 2003, oneShotTail: 1.6, maxDur: 1.7, fadeOut: 0.5 });
    s.bus('hall', { type: 'reverb', t60: 1.6, predelay: 0.015, hp: 300, lp: 10000, er: 0.15 });
    const mb = s.part('musicbox', I.modal('musicbox'), { gain: 0, pan: 0.1, sends: { hall: -6 } });
    const gl = s.part('glock', I.modal('glock'), { gain: -5, pan: -0.1, sends: { hall: -6 } });
    ['C6', 'E6', 'G6', 'C7'].forEach((m, k) => { mb.note(k * 0.33, m, 0.4, 0.75); gl.note(k * 0.33, m, 0.4, 0.6); });
    const tr = s.part('trill', I.modal('celesta'), { gain: -7, pan: 0.3, sends: { hall: -4 } });
    for (let k = 0; k < 6; k++) tr.note(1.5 + k * 0.125, k % 2 ? 'G7' : 'E7', 0.2, 0.5 - k * 0.05);
    const tri = s.part('triangle', D.triangle({ decay: 1.5, f: 1600 }), { gain: -3, sends: { hall: -6 } });
    tri.note(1.0, 60, 1, 0.6);
    return s;
  },
};

// ---- horror sting: dissonant hit + rising swell
const sting = {
  id: 'jingle_sting', type: 'jingle',
  build() {
    const s = base('jingle_sting', { bpm: 60, loopBars: 1, seed: 2004, oneShotTail: 1.5, maxDur: 3.3, fadeOut: 0.9 });
    s.bus('dark', { type: 'reverb', t60: 3.5, predelay: 0.03, hp: 100, lp: 6000, er: 0.2 });
    // hit
    const pn = s.part('piano', I.piano({ felt: 0.1, bright: 0.8, release: 1.5, decay: 1.2 }), { gain: 0, sends: { dark: -4 } });
    for (const m of ['C1', 'C2', 'C#2', 'F#2', 'G2']) pn.note(0, m, 2.5, 0.95, { leg: 1, noHuman: true });
    const br = s.part('brass', I.brass({ voices: 4, spread: 25, attack: 0.008, decay: 0.3, sustain: 0.4, release: 0.6, fm: 0.9, bright: 1.4 }), { gain: -3, sends: { dark: -3 } });
    br.chord(0, ['C4', 'Db4', 'F#4', 'G4', 'Bb4'], 1.2, 0.95, { leg: 1 });
    const gong = s.part('gong', D.gong({ decay: 4, f: 55 }), { gain: 2, sends: { dark: -6 } });
    gong.note(0, 60, 1, 1);
    const timp = s.part('timp', D.timpani({ decay: 2.5, mallet: 0.6 }), { gain: 0, sends: { dark: -6 } });
    timp.note(0, 'C2', 1, 1);
    // swell: tremolo string cluster rising a semitone + noise swell
    const str = s.part('strings', I.strings({ attack: 1.8, release: 0.3, vib: 30, vibRate: 7.5, vibDelay: 0, voices: 6, spread: 25, lp: 6000, bow: 0.12 }), { gain: -2, sends: { dark: -6 } });
    for (const m of ['B5', 'C6', 'C#6', 'F6']) str.note(0.15, m, 2.6, 0.8, { leg: 1, noHuman: true });
    const sw = s.part('swell', D.swell({ fc0: 500, fc1: 7000, metal: 0.8 }), { gain: -4, sends: { dark: -5 } });
    sw.note(0.2, 60, 2.7, 0.9, { leg: 1, noHuman: true });
    return s;
  },
};

module.exports = [victory, levelup, item, sting];
