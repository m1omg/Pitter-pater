'use strict';
// Battle sound effects: punchy, cute, cartoonish.
const K = require('./_kit');
const { N, SR, mtof } = K;

function norm(buf, p = 1) { const m = K.C.peakOf(buf) || 1; return K.gain(buf, p / m); }
const burst = (len, seed, f, q, a, t60, color = 'white') => { const b = K.noise(len, seed, color); K.bp(b, f, q); return K.mul(b, K.ad(b.length, a, t60)); };
// band-limited saw chord stab
function stab(ms, len, o = {}) {
  const n = N(len); const L = new Float32Array(n), R = new Float32Array(n);
  ms.forEach((m, k) => {
    const f = mtof(m);
    const a = K.osc('saw', n, f * Math.pow(2, (o.det || 6) / 1200), { ph: 0.1 * k }), b = K.osc('saw', n, f * Math.pow(2, -(o.det || 6) / 1200), { ph: 0.37 * k });
    const s = new Float32Array(n); for (let i = 0; i < n; i++) s[i] = (a[i] + b[i]) * 0.5;
    const fl = K.svf(s, K.fcurve(n, [[0, o.f0 || 4200], [len, o.f1 || 900]]), 0.8, 'low');
    K.mul(fl, K.ad(n, o.a || 0.004, o.t60 || len * 0.9));
    const p = K.pan(fl, ms.length > 1 ? -0.5 + k / (ms.length - 1) : 0);
    for (let i = 0; i < n; i++) { L[i] += p.L[i] / Math.sqrt(ms.length); R[i] += p.R[i] / Math.sqrt(ms.length); }
  });
  return { L, R };
}
// formant voice for animal sounds: f curve, formant tracks, source mix
function voice(len, f, tracks, o = {}) {
  const n = N(len);
  const saw = K.osc('saw', n, f), pul = K.osc('pulse', n, f, { pw: o.pw || 0.3, ph: 0.2 });
  const src = new Float32Array(n);
  const rough = K.noise(n, o.seed || 5); K.lp(rough, o.roughF || 120);
  const br = K.noise(n, (o.seed || 5) + 1);
  for (let i = 0; i < n; i++) src[i] = (saw[i] * 0.65 + pul[i] * 0.35) * (1 + (o.rough || 0) * rough[i]) + br[i] * (o.breath || 0.05);
  const out = K.formants(src, tracks);
  for (let i = 0; i < n; i++) out[i] = out[i] * 2 + src[i] * (o.direct || 0.03);
  return out;
}

module.exports = {
  // battle start: rising swoosh into an E-minor stab + crash
  sfx_encounter: {
    peak: -3,
    fn() {
      const riser = K.whoosh(0.5, [[0, 300], [0.48, 6000]], [[0, 0], [0.45, 1], [0.5, 0.2]], 1.0, 300, 'pink');
      const tn = N(0.5);
      const tone = K.harm(tn, K.fcurve(tn, [[0, 180], [0.48, 1400]]), [[1, 1], [2, 0.3], [3, 0.12]]);
      K.mul(tone, K.ecurve(tn, [[0, 0], [0.45, 1], [0.5, 0]]));
      const kick = K.thump(0.5, 160, 48, 0.035, 0.35);
      const sn = burst(0.25, 301, 1800, 0.7, 0.001, 0.15);
      const ch = stab([64, 67, 71, 76], 0.45, { t60: 0.4, f0: 5000, f1: 1200 });
      const crash = K.D.cymbal().render({ vel: 0.85, seed: 302, p: { decay: 1.1 } });
      const shing = K.bell(0.8, 2637, K.BELL_TING, 0.5);
      const dry = K.mixSt(1.6, [[norm(riser), 0, 0.55, 0], [tone, 0, 0.18, 0], [kick, 0.47, 1, 0], [norm(sn), 0.47, 0.5, 0], [ch, 0.47, 0.9], [crash, 0.47, 0.35, 0.1], [shing, 0.47, 0.25, -0.1]]);
      return K.verb(dry, { t60: 1.2, wet: 0.2, tail: 0.6 });
    },
  },
  // normal hit: thump + snap + click, lightly saturated
  sfx_hit: {
    peak: -3,
    fn() {
      const th = K.thump(0.2, 190, 65, 0.02, 0.12);
      const sn = burst(0.06, 310, 2200, 0.8, 0.0005, 0.04);
      const ck = K.noise(0.004, 311); K.hp(ck, 3000); K.ramp(ck, 0.0003, 0.002);
      const m = K.mix(0.22, [[th, 0, 1], [norm(sn), 0, 0.7], [norm(ck), 0, 0.35]]);
      return K.sat(m, 2.2);
    },
  },
  // heavy hit: deep thump, body, crunch, room
  sfx_hit_heavy: {
    peak: -3,
    fn() {
      const th = K.thump(0.5, 150, 42, 0.035, 0.32);
      const body = K.thump(0.3, 240, 110, 0.02, 0.15);
      const cr = burst(0.15, 320, 1200, 0.7, 0.001, 0.12);
      const hi = K.noise(0.06, 321); K.hp(hi, 3000); K.mul(hi, K.ad(hi.length, 0.0005, 0.04));
      const m = K.mix(0.5, [[th, 0, 1], [body, 0, 0.4], [norm(cr), 0, 0.8], [norm(hi), 0, 0.4]]);
      K.sat(m, 2.8);
      return K.verb(m, { t60: 0.8, wet: 0.2, tail: 0.5 });
    },
  },
  // critical: impact + bright "shing" + sparkle
  sfx_crit: {
    peak: -3,
    fn() {
      const th = K.thump(0.35, 180, 50, 0.03, 0.25);
      const cr = burst(0.12, 330, 1600, 0.8, 0.001, 0.1);
      const imp = K.mix(0.4, [[th, 0, 1], [norm(cr), 0, 0.7]]); K.sat(imp, 2.5);
      const s1 = K.bell(0.9, 2349, K.BELL_TING, 0.6), s2 = K.bell(0.9, 3136, K.BELL_TING, 0.5);
      const flash = K.noise(0.12, 331); K.hp(flash, 5000); K.mul(flash, K.ad(flash.length, 0.001, 0.1));
      const sp = K.sparkle(1.0, 0.05, 0.35, 10, 332, 5000, 11000, 0.35);
      const dry = K.mixSt(1.0, [[imp, 0, 1, 0], [s1, 0.01, 0.45, -0.2], [s2, 0.02, 0.35, 0.2], [norm(flash), 0, 0.2, 0], [sp, 0, 0.8]]);
      return K.verb(dry, { t60: 1.0, wet: 0.22, tail: 0.6 });
    },
  },
  // miss: quick airy swish, right to left
  sfx_miss: {
    peak: -9,
    fn() {
      const w = K.whoosh(0.3, [[0, 2600], [0.25, 650]], [[0, 0], [0.07, 1], [0.3, 0]], 1.6, 340, 'pink');
      return K.pan(norm(w), K.curve(w.length, [[0, 0.5], [0.3, -0.5]]));
    },
  },
  // cat scratch: three raspy claw swipes
  sfx_scratch: {
    peak: -3,
    fn() {
      const swipe = (seed) => {
        const len = 0.09, n = N(len);
        const src = K.noise(n, seed); const r = new K.RNG(seed + 1);
        let g = 1, next = 0;
        for (let i = 0; i < n; i++) { if (i >= next) { g = 0.15 + 0.85 * r.next(); next = i + N(r.uni(0.001, 0.003)); } src[i] *= g; }
        const o = K.svf(src, K.fcurve(n, [[0, 5000], [0.08, 1500]]), 3, 'bandn');
        const hs = K.noise(n, seed + 2); K.hp(hs, 5000); K.lp(hs, 9000);
        for (let i = 0; i < n; i++) o[i] = o[i] * 1.8 + hs[i] * 0.07;
        K.lp(o, 9000);
        return K.mul(o, K.ecurve(n, [[0, 0], [0.008, 1], [len, 0]]));
      };
      return K.mixSt(0.3, [[swipe(350), 0, 1, -0.3], [swipe(360), 0.085, 0.9, 0.25], [swipe(370), 0.18, 1, -0.1]]);
    },
  },
  // umbrella bonk: hollow comic knock with a pitch drop
  sfx_bonk: {
    peak: -4,
    fn() {
      const n = N(0.3);
      const h = K.harm(n, K.fcurve(n, [[0, 640], [0.06, 500], [0.3, 480]]), [[1, 1], [2.3, 0.35], [3.9, 0.15]]);
      K.mul(h, K.ad(n, 0.001, 0.22));
      const tr = K.knock(0.03, [[1900, 0.4, 0.01]], { trans: 0.8, tLP: 5000, seed: 380 });
      const low = K.thump(0.15, 180, 110, 0.02, 0.08);
      return K.sat(K.mix(0.32, [[h, 0, 1], [tr, 0, 0.5], [low, 0, 0.45]]), 1.6);
    },
  },
  // bite: teeth clack, chomp with a soft thud and crunch
  sfx_bite: {
    peak: -2.5,
    fn() {
      const cl = (seed, j) => K.knock(0.05, [[3300 * j, 0.5, 0.02], [5200 * j, 0.3, 0.012], [2100 * j, 0.3, 0.02]], { trans: 0.9, tLP: 9000, seed });
      const th = K.thump(0.18, 170, 90, 0.02, 0.09);
      const cr = burst(0.06, 391, 1500, 0.9, 0.001, 0.05);
      const m = K.mix(0.26, [[cl(390, 1), 0, 0.6], [cl(392, 0.93), 0.065, 0.8], [th, 0.065, 0.8], [norm(cr), 0.065, 0.5]]);
      return K.sat(m, 1.8);
    },
  },
  // headbutt: dull heavy thud with a hollow "doink"
  sfx_headbutt: {
    peak: -3,
    fn() {
      const th = K.thump(0.4, 130, 50, 0.03, 0.25);
      const nz = K.noise(0.06, 400); K.lp(nz, 800); K.mul(nz, K.ad(nz.length, 0.001, 0.05));
      const dn = N(0.25);
      const doink = K.harm(dn, K.fcurve(dn, [[0, 330], [0.2, 300]]), [[1, 1], [2.1, 0.3]]); K.mul(doink, K.ad(dn, 0.002, 0.14));
      const m = K.mix(0.42, [[th, 0, 1], [norm(nz), 0, 0.5], [doink, 0.005, 0.6]]);
      K.sat(m, 2.2);
      return K.verb(m, { t60: 0.5, wet: 0.12, tail: 0.3 });
    },
  },
  // heal: ascending celesta sparkle in F major pentatonic + soft rising glide
  sfx_heal: {
    peak: -8,
    fn() {
      const ms = [77, 79, 81, 84, 86, 89, 91, 93, 96];
      const layers = ms.map((m, k) => [K.bell(1.2, mtof(m), K.BELL_CELESTA, 0.9), k * 0.055, 0.45 + 0.05 * k, -0.6 + 0.15 * k]);
      const gn = N(0.7);
      const gl = K.harm(gn, K.fcurve(gn, [[0, 523], [0.6, 2093]]), [[1, 1], [2, 0.2]]);
      K.mul(gl, K.ecurve(gn, [[0, 0], [0.25, 1], [0.7, 0]]));
      layers.push([gl, 0, 0.1, 0]);
      layers.push([K.sparkle(1.6, 0.25, 1.1, 26, 410, 4500, 10000, 0.25), 0, 1]);
      return K.verb(K.mixSt(1.7, layers), { t60: 1.8, wet: 0.33, tail: 1.2 });
    },
  },
  // buff: rising sweep, three rising chimes, chip arpeggio
  sfx_buff: {
    peak: -8,
    fn() {
      const sw = K.whoosh(0.35, [[0, 600], [0.33, 5000]], [[0, 0], [0.3, 1], [0.35, 0]], 1.5, 420);
      const bells = [[79, 0.05], [86, 0.12], [91, 0.19]].map(([m, t], k) => [K.bell(1.0, mtof(m), K.BELL_GLOCK, 0.6), t, 0.7, -0.3 + 0.3 * k]);
      const arp = new Float32Array(N(0.2));
      [67, 71, 74, 79].forEach((m, k) => { const b = K.osc('square', N(0.045), mtof(m)); K.lp(b, 4000); K.mul(b, K.gate(0.045, 0.002, 0.01, 0.045)); K.addAt(arp, b, k * 0.035, 1); });
      const dry = K.mixSt(1.2, [[norm(sw), 0, 0.3, 0], ...bells, [arp, 0, 0.12, 0]]);
      return K.verb(dry, { t60: 1.0, wet: 0.2, tail: 0.6 });
    },
  },
  // debuff: sour detuned tones sagging down with a wobble
  sfx_debuff: {
    peak: -8,
    fn() {
      const len = 0.6, n = N(len);
      const base = K.fcurve(n, [[0, 700], [0.45, 330], [len, 310]]);
      const f1 = new Float32Array(n), f2 = new Float32Array(n);
      for (let i = 0; i < n; i++) { const w = Math.pow(2, 40 * Math.sin(2 * Math.PI * 7 * i / SR) / 1200); f1[i] = base[i] * w; f2[i] = base[i] * w * 1.06; }
      const a = K.osc('saw', n, f1), b = K.osc('saw', n, f2, { ph: 0.3 });
      for (let i = 0; i < n; i++) a[i] = (a[i] + b[i]) * 0.5;
      K.lp(a, 1800); K.lp(a, 2600);
      K.mul(a, K.ecurve(n, [[0, 0], [0.03, 1], [0.4, 0.7], [len, 0]]));
      const w = K.whoosh(0.5, [[0, 3000], [0.5, 500]], [[0, 0], [0.1, 1], [0.5, 0]], 1.2, 430);
      return K.verb(K.mixSt(0.7, [[a, 0, 1, 0], [norm(w), 0, 0.2, 0]]), { t60: 0.9, wet: 0.2, tail: 0.5 });
    },
  },
  // enemy calms down: soft cloud "poof" + tiny sparkle
  sfx_enemy_calm: {
    peak: -8,
    fn() {
      const poof = K.noise(0.35, 440, 'pink'); K.lp(poof, 900); K.lp(poof, 1400); K.mul(poof, K.ad(poof.length, 0.008, 0.25));
      const low = K.thump(0.2, 110, 70, 0.02, 0.12);
      const b = [[100, 0.14], [103, 0.2], [108, 0.27]].map(([m, t], k) => [K.bell(0.6, mtof(m), K.BELL_CELESTA, 0.35), t, 0.3, -0.3 + 0.3 * k]);
      const dry = K.mixSt(1.1, [[norm(poof), 0, 1, 0], [low, 0, 0.3, 0], ...b, [K.sparkle(1.0, 0.12, 0.5, 8, 441, 6000, 11000, 0.15), 0, 1]]);
      return K.verb(dry, { t60: 1.2, wet: 0.28, tail: 0.8 });
    },
  },
  // party member down: soft thud, then a sad descending minor triad with a sagging last note
  sfx_party_down: {
    peak: -9,
    fn() {
      const th = K.thump(0.3, 120, 60, 0.02, 0.18);
      const note = (m, len, sag) => {
        const n = N(len); const f0 = mtof(m);
        const f = new Float32Array(n);
        for (let i = 0; i < n; i++) { const t = i / SR; f[i] = f0 * Math.pow(2, (sag * Math.max(0, (t - len * 0.4) / (len * 0.6)) + 18 * Math.min(1, t / 0.25) * Math.sin(2 * Math.PI * 5 * t) * (sag ? 1 : 0)) / 1200); }
        const sq = K.osc('square', n, f), si = K.osc('sine', n, f);
        for (let i = 0; i < n; i++) sq[i] = sq[i] * 0.35 + si[i] * 0.7;
        K.lp(sq, 2500);
        return K.mul(sq, K.gate(len, 0.006, len * 0.35, len));
      };
      const dry = K.mixSt(1.3, [[th, 0, 0.6, 0], [note(76, 0.16, 0), 0.1, 0.6, -0.1], [note(72, 0.16, 0), 0.28, 0.6, 0], [note(69, 0.62, -60), 0.46, 0.65, 0.1]]);
      return K.verb(dry, { t60: 1.2, wet: 0.25, tail: 0.8 });
    },
  },
  // run away: whoosh + scurrying little footsteps fading off to the right
  sfx_run: {
    peak: -6.5,
    fn() {
      const r = new K.RNG(460);
      const layers = [[norm(K.whoosh(0.25, [[0, 1800], [0.25, 700]], [[0, 0], [0.05, 1], [0.25, 0]], 1.4, 461)), 0, 0.35, 0]];
      for (let k = 0; k < 11; k++) {
        const j = r.uni(0.9, 1.1);
        const tap = K.knock(0.05, [[600 * j, 0.6, 0.03], [1150 * j, 0.3, 0.02]], { trans: 0.7, tLP: 5000, seed: 470 + k });
        layers.push([tap, 0.05 + k * 0.058 + r.uni(-0.008, 0.008), 1 - 0.065 * k, Math.min(0.9, k * 0.09)]);
      }
      return K.mixSt(0.8, layers);
    },
  },
  // big team combo: riser into a huge F-major hit (brass, timpani, glock, crash)
  sfx_together: {
    peak: -3,
    fn() {
      const riser = K.whoosh(0.4, [[0, 250], [0.38, 7000]], [[0, 0], [0.36, 1], [0.4, 0]], 0.9, 480, 'pink');
      const rn = N(0.4);
      const rt = K.harm(rn, K.fcurve(rn, [[0, 220], [0.38, 880]]), [[1, 1], [2, 0.3]]); K.mul(rt, K.ecurve(rn, [[0, 0], [0.36, 1], [0.4, 0]]));
      const kick = K.thump(0.6, 170, 45, 0.035, 0.4);
      const sn = burst(0.3, 481, 1800, 0.7, 0.001, 0.2);
      const timp = K.D.timpani().render({ m: 41, vel: 1, seed: 482 });
      const brass = K.I.brass();
      const br = K.play(brass, [53, 57, 60, 65, 69, 72].map((m, k) => [0, m, 0.55, 0.95, -0.6 + 0.24 * k]), 1.4);
      const gl = K.mixSt(2.0, [89, 93, 96, 101].map((m, k) => [K.bell(2.0, mtof(m), K.BELL_GLOCK, 1.5), 0, 0.5, -0.4 + 0.27 * k]));
      const crash = K.D.cymbal().render({ vel: 1, seed: 483, p: { decay: 2.0 } });
      const hitT = 0.38;
      const dry = K.mixSt(2.6, [[norm(riser), 0, 0.5, 0], [rt, 0, 0.15, 0], [kick, hitT, 1, 0], [norm(sn), hitT, 0.55, 0], [timp, hitT, 0.6, 0], [br, hitT, 0.9], [gl, hitT, 0.4], [crash, hitT, 0.45, 0.1]]);
      return K.verb(dry, { t60: 2.2, wet: 0.3, tail: 1.2 });
    },
  },
  // cheery: bright glock arpeggio C-E-G-C + sparkle
  sfx_mood_cheery: {
    peak: -9.5,
    fn() {
      const layers = [84, 88, 91, 96].map((m, k) => [K.bell(1.0, mtof(m), K.BELL_GLOCK, 0.7), k * 0.05, 0.6 + 0.07 * k, -0.3 + 0.2 * k]);
      layers.push([K.sparkle(1.2, 0.1, 0.6, 12, 500, 5000, 10000, 0.2), 0, 1]);
      return K.verb(K.mixSt(1.2, layers), { t60: 1.2, wet: 0.25, tail: 0.8 });
    },
  },
  // gloomy: droopy two-note sigh sliding down, a couple of rain drips
  sfx_mood_gloomy: {
    peak: -10,
    fn() {
      const note = (pts, len, vib) => {
        const n = N(len); const base = K.fcurve(n, pts);
        const f = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; f[i] = base[i] * Math.pow(2, vib * Math.min(1, t / 0.15) * Math.sin(2 * Math.PI * 5.5 * t) / 1200); }
        const h = K.harm(n, f, [[1, 1], [2, 0.35], [3, 0.15], [4, 0.05]]);
        const o = K.formants(h, [{ f: 350, bw: 90, g: 1 }, { f: 800, bw: 120, g: 0.4 }]);
        for (let i = 0; i < n; i++) h[i] = h[i] * 0.4 + o[i] * 1.6;
        K.lp(h, 1800);
        return h;
      };
      const n1 = note([[0, 587], [0.2, 587]], 0.22, 10); K.mul(n1, K.gate(0.22, 0.012, 0.05, 0.22));
      const n2 = note([[0, 523], [0.12, 523], [0.55, 392]], 0.62, 22); K.mul(n2, K.ecurve(n2.length, [[0, 0], [0.02, 1], [0.4, 0.7], [0.62, 0]]));
      const drop = K.I.drop({ decay: 0.08 });
      const d1 = drop.render({ m: 84, vel: 0.6, seed: 510 }), d2 = drop.render({ m: 79, vel: 0.5, seed: 511 });
      const dry = K.mixSt(1.0, [[n1, 0, 0.8, -0.1], [n2, 0.2, 0.85, 0.05], [d1, 0.15, 0.25, 0.5], [d2, 0.55, 0.22, -0.5]]);
      return K.verb(dry, { t60: 1.3, wet: 0.25, tail: 0.8 });
    },
  },
  // huffy: grumbly FM growl + electric zap
  sfx_mood_huffy: {
    peak: -7.3,
    fn() {
      const gn = N(0.45);
      const g = K.fm(gn, K.fcurve(gn, [[0, 95], [0.45, 80]]), 1.51, K.curve(gn, [[0, 3.5], [0.45, 2]]));
      const jt = K.noise(gn, 520); K.lp(jt, 30);
      for (let i = 0; i < gn; i++) g[i] *= 1 + 2 * jt[i];
      K.mul(g, K.ecurve(gn, [[0, 0], [0.04, 1], [0.35, 0.8], [0.45, 0]]));
      K.sat(g, 2.5); K.lp(g, 1600); K.hp(g, 60);
      const zn = N(0.14);
      const z = K.osc('saw', zn, K.fcurve(zn, [[0, 3000], [0.12, 180]])); K.mul(z, K.ad(zn, 0.001, 0.12));
      const zc = K.crackle(0.14, 900, 521, 3); K.bp(zc, 2500, 0.8);
      for (let i = 0; i < zn; i++) z[i] = z[i] * 0.6 + zc[i];
      K.lp(z, 8000);
      return K.verb(K.mixSt(0.6, [[norm(g), 0, 1, -0.1], [norm(z), 0.3, 0.5, 0.2]]), { t60: 0.5, wet: 0.12, tail: 0.3 });
    },
  },
  // rainbow: harp glissando up an Fmaj9 chord + glock shimmer + sparkles
  sfx_mood_rainbow: {
    peak: -8,
    fn() {
      const harp = K.I.pluck('harp');
      const ms = [77, 81, 84, 88, 91, 93, 96, 100];
      const g = K.play(harp, ms.map((m, k) => [k * 0.04, m, 0.6, 0.75, -0.7 + 0.2 * k]), 1.8);
      const gl = K.mixSt(1.8, ms.filter((_, k) => k % 2 === 1).map((m, k) => [K.bell(1.2, mtof(m + 12), K.BELL_GLOCK, 0.8), 0.08 + k * 0.08, 0.3, 0.5 - 0.3 * k]));
      const pn = N(1.3);
      const pad = K.harm(pn, 698.5, [[1, 0.5], [1.26, 0.4], [1.5, 0.4], [1.89, 0.3], [2.24, 0.25]]);
      for (let i = 0; i < pn; i++) pad[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 6 * i / SR);
      K.mul(pad, K.ecurve(pn, [[0, 0], [0.3, 1], [1.3, 0]]));
      const dry = K.mixSt(1.8, [[g, 0, 1], [gl, 0, 0.8], [pad, 0.1, 0.08, 0], [K.sparkle(1.5, 0.2, 1.0, 20, 530, 5000, 11000, 0.2), 0, 1]]);
      return K.verb(dry, { t60: 1.6, wet: 0.3, tail: 1.0 });
    },
  },
  // stormy: small thunder crack, rumble, dark low chord, wind
  sfx_mood_stormy: {
    peak: -5, hp: 30,
    fn() {
      const len = 1.3, n = N(len);
      const rum = (seed) => { const b = K.noise(n, seed, 'brown'); K.lp(b, 200); K.hp(b, 40); norm(b); return K.mul(b, K.ecurve(n, [[0, 0], [0.3, 1], [len, 0]])); };
      const chord = new Float32Array(n);
      [38, 45, 50, 53].forEach((m, k) => { const s = K.osc('saw', n, mtof(m) * (1 + 0.002 * k)); for (let i = 0; i < n; i++) chord[i] += s[i] * 0.25; });
      K.lp(chord, 500); K.lp(chord, 700);
      K.mul(chord, K.ecurve(n, [[0, 0], [0.15, 1], [len, 0]]));
      const wind = K.whoosh(len, [[0, 400], [0.6, 1500], [len, 600]], [[0, 0], [0.5, 1], [len, 0]], 2, 540);
      const crack = K.noise(0.1, 541); K.hp(crack, 1200); K.mul(crack, K.ad(crack.length, 0.001, 0.06));
      const dry = K.mixSt(len, [[{ L: rum(542), R: rum(543) }, 0, 0.8], [norm(chord), 0, 0.5, 0], [norm(wind), 0, 0.3, 0.2], [norm(crack), 0.12, 0.5, -0.2]]);
      return K.verb(dry, { t60: 1.5, wet: 0.3, tail: 0.8, hp: 80 });
    },
  },
  // heatwave: frying sizzle + wavy rising shimmer tone
  sfx_mood_heatwave: {
    peak: -8.7,
    fn() {
      const len = 1.1, n = N(len);
      const sz = K.noise(n, 550); K.hp(sz, 4000); K.lp(sz, 11000);
      const cr = K.crackle(len, 300, 551, 1); K.lp(cr, 3000);
      const gate = new Float32Array(n); for (let i = 0; i < n; i++) gate[i] = 0.25 + Math.min(1, Math.abs(cr[i]) * 30);
      K.lp(gate, 200);
      for (let i = 0; i < n; i++) sz[i] *= gate[i];
      K.mul(sz, K.ecurve(n, [[0, 0], [0.1, 1], [0.9, 0.6], [len, 0]]));
      const base = K.fcurve(n, [[0, 300], [0.9, 900]]);
      const f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = base[i] * Math.pow(2, 60 * Math.sin(2 * Math.PI * 9 * i / SR) / 1200);
      const t = K.osc('tri', n, f); K.lp(t, 3000);
      K.mul(t, K.ecurve(n, [[0, 0], [0.08, 1], [0.9, 0.8], [len, 0]]));
      return K.verb(K.mixSt(len, [[norm(sz), 0, 0.5, 0], [norm(t), 0, 0.6, 0]]), { t60: 0.9, wet: 0.2, tail: 0.5 });
    },
  },
  // overwhelmed: dizzy whirl - accelerating wobble tone + circling whoosh
  sfx_overwhelm: {
    peak: -7.3,
    fn() {
      const len = 1.4, n = N(len);
      const rate = K.curve(n, [[0, 4], [0.9, 14], [len, 7]]);
      const f = new Float32Array(n), panC = new Float32Array(n), am = new Float32Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) { ph += rate[i] / SR; const s = Math.sin(2 * Math.PI * ph); f[i] = 600 * Math.pow(2, 300 * s / 1200); panC[i] = 0.8 * s; am[i] = 0.5 + 0.5 * Math.cos(2 * Math.PI * ph); }
      const tone = K.harm(n, f, [[1, 1], [2, 0.2]]);
      const wh = K.noise(n, 560, 'pink'); K.bp(wh, 1200, 1); K.mul(wh, am);
      const env = K.ecurve(n, [[0, 0], [0.1, 1], [1.2, 0.9], [len, 0]]);
      const m = new Float32Array(n); norm(wh);
      for (let i = 0; i < n; i++) m[i] = (tone[i] * 0.55 + wh[i] * 0.5) * env[i];
      return K.pan(m, panC);
    },
  },
  // sleep: three soft buzzy "z" syllables and a tiny bubble pop
  sfx_sleep: {
    peak: -10,
    fn() {
      const z = (f, seed) => {
        const len = 0.24, n = N(len);
        const saw = K.osc('saw', n, K.fcurve(n, [[0, f], [len, f * 0.96]]));
        const v = Float32Array.from(saw); K.lp(v, 1200); K.pk(v, 480, 1.2, 5);
        const fr = K.noise(n, seed); K.bp(fr, 4200, 2);
        for (let i = 0; i < n; i++) fr[i] *= 0.4 + 0.6 * (saw[i] > 0 ? 1 : 0);
        K.lp(fr, 6000);
        const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = v[i] * 0.8 + fr[i] * 0.35;
        return K.mul(o, K.ecurve(n, [[0, 0], [0.06, 1], [0.18, 0.75], [len, 0]]));
      };
      const pn = N(0.03); const pop = K.osc('sine', pn, K.fcurve(pn, [[0, 600], [0.02, 1200]])); K.mul(pop, K.ad(pn, 0.001, 0.025));
      return K.mixSt(1.1, [[z(150, 570), 0, 0.9, -0.3], [z(140, 571), 0.32, 0.8, 0], [z(132, 572), 0.64, 0.7, 0.3], [pop, 1.0, 0.35, 0.3]]);
    },
  },
  // boom: explosion - pitch-dropping boom, blast noise with closing filter, debris crackle
  sfx_boom: {
    peak: -3.5,
    fn() {
      const len = 1.6, n = N(len);
      const boom = K.thump(1.2, 95, 32, 0.08, 0.9);
      const blast = K.noise(n, 580);
      const bl = K.svf(blast, K.fcurve(n, [[0, 7000], [0.8, 350], [len, 150]]), 0.7, 'low');
      K.mul(bl, K.ad(n, 0.002, 1.2));
      const deb = K.crackle(1.2, 60, 581, 4); K.bp(deb, 2500, 0.8); K.mul(deb, K.ad(deb.length, 0.01, 0.8));
      const m = K.mix(len, [[boom, 0, 1], [norm(bl), 0, 0.9], [norm(deb), 0.05, 0.35]]);
      K.sat(m, 2.5);
      return K.verb(m, { t60: 2.5, wet: 0.35, tail: 1.2, hp: 80, lp: 6000 });
    },
  },
  // throw: quick "fwip" whoosh with a tiny whistle
  sfx_throw: {
    peak: -9.5,
    fn() {
      const len = 0.32, n = N(len);
      const w = K.whoosh(len, [[0, 900], [0.12, 2600], [len, 1300]], [[0, 0], [0.08, 1], [len, 0]], 1.3, 590);
      const wh = K.osc('sine', n, K.fcurve(n, [[0, 1200], [0.2, 1650]])); K.mul(wh, K.ecurve(n, [[0, 0], [0.05, 1], [0.22, 0], [len, 0]]));
      const m = K.mix(len, [[norm(w), 0, 1], [wh, 0, 0.12]]);
      return K.pan(m, K.curve(n, [[0, -0.4], [len, 0.5]]));
    },
  },
  // meow: formant-swept voiced source "m-e-o-w" with a rise-fall pitch contour
  sfx_meow: {
    peak: -10,
    fn() {
      const len = 0.58, n = N(len);
      const base = K.fcurve(n, [[0, 480], [0.12, 720], [0.3, 680], [len, 420]]);
      const r = new K.RNG(600); const jit = K.noise(n, 601); K.lp(jit, 25);
      const f = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; f[i] = base[i] * Math.pow(2, (25 * Math.min(1, t / 0.2) * Math.sin(2 * Math.PI * 6 * t) + 60 * jit[i]) / 1200); }
      void r;
      const tracks = [
        { f: K.fcurve(n, [[0, 390], [0.1, 900], [0.28, 1100], [0.45, 650], [len, 500]]), bw: 140, g: 1 },
        { f: K.fcurve(n, [[0, 2300], [0.1, 2700], [0.28, 1950], [0.45, 1250], [len, 1000]]), bw: 200, g: 0.75 },
        { f: 3400, bw: 300, g: 0.3 },
      ];
      const v = voice(len, f, tracks, { breath: 0.06, seed: 602, direct: 0.02 });
      const nas = Float32Array.from(v); K.lp(nas, 450);
      const w = K.ecurve(n, [[0, 1], [0.07, 0]]);
      for (let i = 0; i < n; i++) v[i] = v[i] * (1 - w[i]) + nas[i] * w[i] * 1.5;
      K.mul(v, K.ecurve(n, [[0, 0], [0.04, 0.5], [0.1, 1], [0.4, 0.85], [len, 0]]));
      K.hp(v, 150); K.lp(v, 6000);
      return K.verb(v, { t60: 0.4, wet: 0.1, tail: 0.25 });
    },
  },
  // bark: friendly double "wuf-wuf"
  sfx_bark: {
    peak: -10,
    fn() {
      const bark = (f0, seed) => {
        const len = 0.2, n = N(len);
        const f = K.fcurve(n, [[0, f0 * 0.8], [0.025, f0 * 1.05], [0.09, f0], [len, f0 * 0.65]]);
        const tracks = [
          { f: K.fcurve(n, [[0, 500], [0.04, 780], [len, 550]]), bw: 150, g: 1 },
          { f: K.fcurve(n, [[0, 1000], [0.04, 1350], [len, 1050]]), bw: 200, g: 0.7 },
          { f: 2600, bw: 300, g: 0.25 },
        ];
        const v = voice(len, f, tracks, { rough: 0.6, roughF: 150, breath: 0.35, seed, direct: 0.04 });
        K.mul(v, K.ecurve(n, [[0, 0], [0.008, 1], [0.05, 0.85], [len, 0]]));
        K.hp(v, 120); K.lp(v, 5000);
        return K.sat(v, 1.8);
      };
      const dry = K.mixSt(0.5, [[bark(420, 610), 0, 1, -0.05], [bark(400, 620), 0.26, 0.85, 0.05]]);
      return K.verb(dry, { t60: 0.5, wet: 0.12, tail: 0.3 });
    },
  },
  // baa: soft bleating sheep (Momo) - "b" onset, "aa" vowel with the bleat trill
  sfx_baa: {
    peak: -9,
    fn() {
      const len = 0.8, n = N(len);
      const base = K.fcurve(n, [[0, 300], [0.08, 395], [0.5, 370], [len, 320]]);
      const f = new Float32Array(n), am = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR; const d = Math.min(1, Math.max(0, (t - 0.1) / 0.15)); const s = Math.sin(2 * Math.PI * 21 * t); f[i] = base[i] * Math.pow(2, 40 * d * s / 1200); am[i] = 1 - 0.45 * d * (0.5 + 0.5 * s); }
      const tracks = [
        { f: K.fcurve(n, [[0, 350], [0.06, 820], [len, 760]]), bw: 120, g: 1 },
        { f: K.fcurve(n, [[0, 900], [0.06, 1250], [len, 1180]]), bw: 160, g: 0.6 },
        { f: 2700, bw: 250, g: 0.25 }, { f: 3600, bw: 300, g: 0.1 },
      ];
      const v = voice(len, f, tracks, { breath: 0.08, seed: 630, direct: 0.02 });
      K.mul(v, am);
      K.mul(v, K.ecurve(n, [[0, 0], [0.025, 0.3], [0.05, 1], [0.6, 0.8], [len, 0]]));
      K.hp(v, 150); K.lp(v, 6500);
      return K.verb(v, { t60: 0.5, wet: 0.12, tail: 0.3 });
    },
  },
};
