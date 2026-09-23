'use strict';
// Finds every renderable item: tracks/*.js export { id, type, build() -> Song } (bgm / amb / jingle),
// sfx/*.js export { sfx_id: { fn: () -> Float32Array | {L,R}, peak: dBFS, hp?: Hz }, ... }.
// Files that fail to load are skipped (reported in loadErrors) so one broken file cannot block others.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const loadErrors = [];

function tryRequire(f) {
  try { return require(f); } catch (e) { loadErrors.push(path.basename(f) + ': ' + (e && e.message)); return null; }
}

function listItems() {
  const items = {};
  const tdir = path.join(ROOT, 'tracks');
  for (const f of fs.readdirSync(tdir).filter((x) => x.endsWith('.js') && !x.startsWith('_')).sort()) {
    const mod = tryRequire(path.join(tdir, f));
    if (!mod) continue;
    const list = Array.isArray(mod) ? mod : [mod];
    for (const m of list) if (m && m.id && typeof m.build === 'function') items[m.id] = { id: m.id, kind: 'song', type: m.type, file: path.join(tdir, f), mod: m };
  }
  const sdir = path.join(ROOT, 'sfx');
  for (const f of fs.readdirSync(sdir).filter((x) => x.endsWith('.js') && !x.startsWith('_')).sort()) {
    const mod = tryRequire(path.join(sdir, f));
    if (!mod) continue;
    for (const [id, def] of Object.entries(mod)) {
      if (!id.startsWith('sfx_') || !def || typeof def.fn !== 'function') continue;
      items[id] = { id, kind: 'sfx', type: 'sfx', file: path.join(sdir, f), def };
    }
  }
  if (loadErrors.length && process.env.PP_VERBOSE) for (const e of loadErrors) console.error('registry: skipped ' + e);
  return items;
}

module.exports = { listItems, ROOT, loadErrors };
