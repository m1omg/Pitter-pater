'use strict';
// UI sound effects: soft, cute, short.
const K = require('./_kit');
const { N, mtof } = K;

// small glassy tone used by several UI sounds
const tink = (f, t60 = 0.25, parts = K.BELL_CELESTA) => K.bell(Math.min(1.5, t60 * 1.3 + 0.02), f, parts, t60, { attack: 0.0012 });

module.exports = {
  // soft "tuk" pip: triangle with a tiny downward pitch flick + wooden tick
  sfx_cursor: {
    peak: -11,
    fn() {
      const len = 0.06, n = N(len);
      const f = K.fcurve(n, [[0, 1480], [0.012, 1180], [len, 1150]]);
      const s = K.osc('tri', n, f);
      K.mul(s, K.ad(n, 0.0015, 0.045));
      const tick = K.knock(len, [[2350, 0.35, 0.018], [3900, 0.15, 0.01]], { trans: 0.15, tLP: 6000 });
      for (let i = 0; i < n; i++) s[i] = s[i] + tick[i];
      K.lp(s, 7000);
      return K.ramp(s, 0.001, 0.01);
    },
  },
  // two quick rising celesta tones (a fifth) - "pling-pling!"
  sfx_confirm: {
    peak: -11,
    fn() {
      const a = tink(mtof(84), 0.28, K.BELL_GLOCK), b = tink(mtof(91), 0.4, K.BELL_GLOCK);
      const body = K.harm(0.2, K.fcurve(0.2, [[0, 523], [0.2, 523]]), [[1, 1], [2, 0.2]]);
      K.mul(body, K.ad(body.length, 0.002, 0.12));
      const dry = K.mixSt(0.6, [[a, 0, 0.9, -0.15], [b, 0.055, 1, 0.15], [body, 0, 0.25, 0]]);
      return K.verb(dry, { t60: 0.7, wet: 0.14, tail: 0.5 });
    },
  },
  // two soft descending triangle blips (a fourth down)
  sfx_cancel: {
    peak: -12,
    fn() {
      const note = (f0, len) => {
        const n = N(len);
        const s = K.osc('tri', n, K.fcurve(n, [[0, f0 * 1.03], [0.02, f0], [len, f0 * 0.97]]));
        return K.mul(s, K.ad(n, 0.002, len * 0.9));
      };
      const m = K.mix(0.26, [[note(784, 0.09), 0, 1], [note(587, 0.15), 0.07, 1]]);
      K.lp(m, 3000);
      return K.ramp(m, 0.001, 0.02);
    },
  },
  // "bu-bup" low double buzz, band-limited, cute but clearly "no"
  sfx_buzzer: {
    peak: -12.5,
    fn() {
      const buzz = (len) => {
        const n = N(len);
        const a = K.osc('pulse', n, 185, { pw: 0.32 }), b = K.osc('pulse', n, 191.5, { pw: 0.28, ph: 0.3 });
        const s = new Float32Array(n);
        for (let i = 0; i < n; i++) s[i] = (a[i] + b[i]) * 0.5;
        K.lp(s, 2300); K.lp(s, 3500); K.pk(s, 700, 1.2, 4);
        return K.mul(s, K.gate(len, 0.004, 0.02, len));
      };
      const m = K.mix(0.26, [[buzz(0.085), 0, 1], [buzz(0.11), 0.125, 0.95]]);
      K.sat(m, 1.6);
      return m;
    },
  },
  // airy "fwip" + a soft two-note marimba-ish pop
  sfx_menu_open: {
    peak: -12,
    fn() {
      const w = K.whoosh(0.12, [[0, 900], [0.12, 4200]], [[0, 0], [0.07, 1], [0.12, 0]], 1.4, 5);
      const m1 = K.bell(0.35, mtof(81), [[1, 1, 1], [3.93, 0.12, 0.25], [9.2, 0.02, 0.08]], 0.22, { attack: 0.0015 });
      const m2 = K.bell(0.4, mtof(88), [[1, 1, 1], [3.93, 0.12, 0.25], [9.2, 0.02, 0.08]], 0.26, { attack: 0.0015 });
      const dry = K.mixSt(0.5, [[w, 0, 0.35, -0.3], [m1, 0.05, 0.8, -0.1], [m2, 0.085, 0.8, 0.15]]);
      return K.verb(dry, { t60: 0.6, wet: 0.12, tail: 0.4 });
    },
  },
  // sparkly save: F-major arpeggio of bell tones up two octaves + shimmer + soft rising glide
  sfx_save: {
    peak: -9,
    fn() {
      const notes = [77, 81, 84, 89, 93, 96];
      const layers = notes.map((m, k) => [K.bell(1.2, mtof(m), K.BELL_GLOCK, 0.7 + 0.1 * k, { attack: 0.001 }), 0.05 * k, 0.55 + 0.07 * k, -0.6 + 0.24 * k]);
      const gl = K.harm(0.5, K.fcurve(0.5, [[0, 700], [0.45, 2100]]), [[1, 1], [2, 0.15]]);
      K.mul(gl, K.ecurve(gl.length, [[0, 0], [0.2, 1], [0.5, 0]]));
      layers.push([gl, 0, 0.12, 0]);
      const sp = K.sparkle(1.5, 0.2, 1.1, 22, 7, 4500, 10000, 0.22);
      layers.push([sp, 0, 1]);
      const dry = K.mixSt(1.6, layers);
      return K.verb(dry, { t60: 1.4, wet: 0.3, tail: 1.2, lp: 9000 });
    },
  },
  // pickup: bubbly up-sweep "bloop" then a bright ding
  sfx_item: {
    peak: -10,
    fn() {
      const n = N(0.09);
      const bl = K.harm(n, K.fcurve(n, [[0, 380], [0.08, 1250]]), [[1, 1], [2, 0.25], [3, 0.08]]);
      K.mul(bl, K.gate(0.09, 0.004, 0.03, 0.09));
      const d1 = K.bell(0.8, mtof(96), K.BELL_GLOCK, 0.55, { attack: 0.0008 });
      const d2 = K.bell(0.8, mtof(100), K.BELL_GLOCK, 0.45, { attack: 0.0008 });
      const dry = K.mixSt(0.9, [[bl, 0, 0.55, 0], [d1, 0.075, 0.8, -0.12], [d2, 0.075, 0.45, 0.12]]);
      return K.verb(dry, { t60: 0.9, wet: 0.18, tail: 0.6 });
    },
  },
  // gift box: crinkly paper rustle, then a music-box-like chime arpeggio
  sfx_chest: {
    peak: -10.5,
    fn() {
      const len = 0.42, n = N(len);
      const r = new K.RNG(99);
      const rust = new Float32Array(n);
      // many tiny crinkles with varying colour
      for (let k = 0; k < 90; k++) {
        const t = Math.pow(r.next(), 1.3) * (len - 0.03);
        const cl = N(r.uni(0.001, 0.006));
        const g = K.noise(cl + 64, 1000 + k);
        K.bp(g, r.uni(2200, 7500), r.uni(0.8, 2.5));
        K.mul(g, K.ad(g.length, 0.0002, r.uni(0.002, 0.008)));
        K.addAt(rust, g, t, r.uni(0.3, 1) * (1 - 0.6 * t / len));
      }
      const swish = K.whoosh(len, [[0, 1800], [len, 5000]], [[0, 0], [0.05, 0.6], [len, 0]], 0.9, 12);
      for (let i = 0; i < n; i++) rust[i] = rust[i] * 0.9 + swish[i] * 0.25;
      const box = K.I.modal('musicbox');
      const ch = K.play(box, [[0, 84, 0.3, 0.7, -0.3], [0.09, 88, 0.3, 0.72, 0], [0.18, 91, 0.3, 0.75, 0.25], [0.27, 96, 0.5, 0.8, 0.1]], 2.0);
      const dry = K.mixSt(2.1, [[rust, 0, 0.8, -0.1], [ch, 0.22, 0.9]]);
      return K.verb(dry, { t60: 1.1, wet: 0.2, tail: 0.8 });
    },
  },
  // page turn: lift crinkle, airy swish with a moving band, soft paper flap at the end
  sfx_page: {
    peak: -14,
    fn() {
      const len = 0.3, n = N(len);
      const sw = K.whoosh(len, [[0, 1400], [0.18, 3800], [len, 2600]], [[0, 0], [0.04, 0.5], [0.16, 1], [len, 0]], 0.8, 31, 'white');
      const cr = K.crackle(len, 260, 8, 1);
      K.bp(cr, 4200, 0.9);
      K.mul(cr, K.ecurve(n, [[0, 0.2], [0.08, 1], [0.22, 0.4], [len, 0]]));
      const flap = K.noise(0.05, 44, 'pink'); K.lp(flap, 700); K.mul(flap, K.ad(flap.length, 0.003, 0.04));
      const m = K.mix(len + 0.06, [[sw, 0, 1], [cr, 0, 0.35], [flap, 0.24, 0.9]]);
      K.hp(m, 250);
      return K.pan(m, K.curve(m.length, [[0, 0.25], [len, -0.2]]));
    },
  },
  // equip: little zip up + metallic "ching"
  sfx_equip: {
    peak: -11,
    fn() {
      const zip = K.whoosh(0.07, [[0, 1500], [0.07, 6000]], [[0, 0], [0.05, 1], [0.07, 0]], 2, 14, 'white');
      const clk = K.knock(0.05, [[3100, 0.4, 0.02], [4700, 0.3, 0.014], [6900, 0.15, 0.01]], { trans: 0.35, tLP: 9000 });
      const ching = K.bell(0.6, 1760, K.BELL_TING, 0.32, { attack: 0.0008 });
      const ching2 = K.bell(0.6, 2637, K.BELL_TING, 0.22, { attack: 0.0008 });
      const dry = K.mixSt(0.65, [[zip, 0, 0.35, -0.2], [clk, 0.06, 0.8, 0], [ching, 0.065, 0.6, 0.1], [ching2, 0.075, 0.35, -0.1]]);
      return K.verb(dry, { t60: 0.7, wet: 0.15, tail: 0.4 });
    },
  },
};
