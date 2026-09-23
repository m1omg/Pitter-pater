#!/usr/bin/env node
'use strict';
// PITTER-PATTER audio build: render -> encode (Ogg Vorbis) -> package (game/audio/*.js + manifest).
//
//   node tools/audio/build.js                 # everything
//   node tools/audio/build.js bgm_title sfx_hit   # only these ids (packs/manifest are merged, not wiped)
//   node tools/audio/build.js --type=sfx      # all items of one type (bgm|amb|jingle|sfx)
//   options: --jobs=N  --no-render  --no-encode  --no-package  --clean-wav
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const os = require('os');
const { listItems, ROOT, loadErrors } = require('./lib/registry');

const OUT = path.join(ROOT, 'out');
const GAME_AUDIO = path.resolve(ROOT, '..', '..', 'game', 'audio');

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const JOBS = parseInt(opt('jobs', Math.max(2, Math.min(8, os.cpus().length - 2))), 10);

const items = listItems();
let ids = args.filter((a) => !a.startsWith('--'));
const typeSel = opt('type', null);
if (!ids.length) ids = Object.keys(items).filter((id) => !typeSel || items[id].type === typeSel);
for (const id of ids) if (!items[id]) { console.error('unknown id: ' + id + (loadErrors.length ? '\nload errors: ' + loadErrors.join('\n') : '')); process.exit(1); }
if (loadErrors.length) console.error('warning: skipped files: ' + loadErrors.join(' | '));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function runPool(tasks, n) {
  return new Promise((resolve) => {
    let i = 0, active = 0, failed = [];
    const next = () => {
      if (i >= tasks.length && active === 0) return resolve(failed);
      while (active < n && i < tasks.length) {
        const t = tasks[i++]; active++;
        t().catch((e) => failed.push(String(e))).finally(() => { active--; next(); });
      }
    };
    next();
  });
}
function run(cmd, argv, quiet) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; if (!quiet) process.stdout.write(d); });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? res(out) : rej(new Error(cmd + ' ' + argv.join(' ') + ' failed: ' + err.slice(-2000)))));
  });
}
const quality = (type) => (type === 'bgm' ? 4 : 3);

async function main() {
  const t0 = Date.now();
  // ---- render (slowest items first for better packing)
  if (!flag('no-render')) {
    const order = ids.slice().sort((a, b) => (items[a].kind === 'song' ? 0 : 1) - (items[b].kind === 'song' ? 0 : 1));
    console.log(`rendering ${order.length} items with ${JOBS} jobs...`);
    const failed = await runPool(order.map((id) => () => run(process.execPath, ['--max-old-space-size=3072', path.join(ROOT, 'render_item.js'), id])), JOBS);
    if (failed.length) { console.error(failed.join('\n')); process.exit(1); }
  }
  // ---- encode
  if (!flag('no-encode')) {
    console.log('encoding...');
    const failed = await runPool(ids.map((id) => async () => {
      const meta = JSON.parse(fs.readFileSync(path.join(OUT, id + '.json'), 'utf8'));
      const a = ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(OUT, id + '.wav'), '-map_metadata', '-1', '-c:a', 'libvorbis', '-q:a', String(quality(meta.type)), '-ar', '44100'];
      if (meta.loop) a.push('-metadata', 'LOOPSTART=' + meta.loopStartS, '-metadata', 'LOOPLENGTH=' + (meta.loopEndS - meta.loopStartS));
      // short files: small Ogg pages so the end-trim granule is exact (single-page files decode a few samples off)
      if (meta.duration < 3) a.push('-page_duration', '20000');
      a.push(path.join(OUT, id + '.ogg'));
      await run('ffmpeg', a, true);
    }), JOBS);
    if (failed.length) { console.error(failed.join('\n')); process.exit(1); }
  }
  // ---- package
  if (!flag('no-package')) pack(ids);
  if (flag('clean-wav')) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.wav')) fs.unlinkSync(path.join(OUT, f));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const r6 = (x) => Math.round(x * 1e6) / 1e6;
function readManifest() {
  const f = path.join(GAME_AUDIO, 'manifest.js');
  if (!fs.existsSync(f)) return {};
  const txt = fs.readFileSync(f, 'utf8');
  const j = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
  try { return JSON.parse(j); } catch (e) { return {}; }
}
function readSfxPack() {
  const f = path.join(GAME_AUDIO, 'sfx_pack.js');
  const map = new Map();
  if (!fs.existsSync(f)) return map;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = /^AUDIO_DB\.add\("([^"]+)"/.exec(line);
    if (m) map.set(m[1], line);
  }
  return map;
}
function pack(idList) {
  if (!fs.existsSync(GAME_AUDIO)) fs.mkdirSync(GAME_AUDIO, { recursive: true });
  const manifest = readManifest();
  const sfxLines = readSfxPack();
  let sfxChanged = false;
  for (const id of idList) {
    const meta = JSON.parse(fs.readFileSync(path.join(OUT, id + '.json'), 'utf8'));
    const b64 = fs.readFileSync(path.join(OUT, id + '.ogg')).toString('base64');
    if (meta.type === 'sfx') {
      sfxLines.set(id, `AUDIO_DB.add(${JSON.stringify(id)}, {data:"${b64}", loop:false});`);
      sfxChanged = true;
      manifest[id] = { file: 'sfx_pack.js', type: 'sfx', loop: false, loopStart: 0, loopEnd: 0, duration: r6(meta.duration) };
    } else {
      const body = meta.loop
        ? `{data:"${b64}", loopStart:${r6(meta.loopStart)}, loopEnd:${r6(meta.loopEnd)}, loop:true}`
        : `{data:"${b64}", loopStart:0, loopEnd:0, loop:false}`;
      fs.writeFileSync(path.join(GAME_AUDIO, id + '.js'), `AUDIO_DB.add(${JSON.stringify(id)}, ${body});\n`);
      manifest[id] = { file: id + '.js', type: meta.type, loop: !!meta.loop, loopStart: meta.loop ? r6(meta.loopStart) : 0, loopEnd: meta.loop ? r6(meta.loopEnd) : 0, duration: r6(meta.duration) };
    }
  }
  if (sfxChanged) {
    const keys = [...sfxLines.keys()].sort();
    fs.writeFileSync(path.join(GAME_AUDIO, 'sfx_pack.js'), keys.map((k) => sfxLines.get(k)).join('\n') + '\n');
  }
  // drop manifest entries whose item no longer exists
  if (!loadErrors.length) for (const k of Object.keys(manifest)) if (!items[k]) delete manifest[k];
  const order = ['bgm', 'jingle', 'amb', 'sfx'];
  const keys = Object.keys(manifest).sort((a, b) => order.indexOf(manifest[a].type) - order.indexOf(manifest[b].type) || a.localeCompare(b));
  const lines = keys.map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(manifest[k]));
  fs.writeFileSync(path.join(GAME_AUDIO, 'manifest.js'), '// Generated by tools/audio/build.js - do not edit by hand.\nvar AUDIO_MANIFEST = {\n' + lines.join(',\n') + '\n};\n');
  console.log(`packaged ${idList.length} items; manifest has ${keys.length} entries`);
}

main().catch((e) => { console.error(e); process.exit(1); });
