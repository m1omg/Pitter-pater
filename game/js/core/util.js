'use strict';
// ---------------------------------------------------------------------------
// Small helpers shared by everything.
// ---------------------------------------------------------------------------
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
  approach(v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  },
  sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  chance: (p) => Math.random() < p,
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  weighted(list, weightFn) {
    let total = 0;
    for (const it of list) total += Math.max(0, weightFn(it));
    if (total <= 0) return list[0];
    let r = Math.random() * total;
    for (const it of list) {
      r -= Math.max(0, weightFn(it));
      if (r <= 0) return it;
    }
    return list[list.length - 1];
  },
  // deterministic RNG (mulberry32)
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
  // smooth value noise 1D (for wobbles)
  noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i;
    const h = (n) => {
      let v = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
      return v - Math.floor(v);
    };
    const u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
  },
  ease: {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
  },
  // colours
  hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgba(hex, a) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },
  mixHex(h1, h2, t) {
    const a = U.hexToRgb(h1), b = U.hexToRgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  },
  deepCopy: (o) => JSON.parse(JSON.stringify(o)),
  dirVec: { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] },
  dirFromVec(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  },
  opposite: { down: 'up', up: 'down', left: 'right', right: 'left' },
  formatTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h > 0 ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  },
};
window.U = U;
