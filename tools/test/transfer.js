// OPTIONS -> Export saves / Import saves: move save files from the copy on disk (file://) to another
// site (a local server standing in for the website), as a code and as a file.
// node transfer.js
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');

const GAME = path.resolve(__dirname, '../../game');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-transfer-'));
const DL = path.join(TMP, 'dl');
fs.mkdirSync(DL);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(GAME, p);
  if (!f.startsWith(GAME) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (label, ok, v) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + label.padEnd(32), typeof v === 'string' ? v : JSON.stringify(v)); };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const FILE = 'file://' + path.join(GAME, 'index.html'), SITE = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new', userDataDir: path.join(TMP, 'profile'),
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'TMPDIR')),   // Chrome's own socket path must stay short
    args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--window-size=960,720'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720 });
  await (await page.target().createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  let answer = null, lastDefault = null;   // what to type into the next prompt, and the text the last one offered
  page.on('dialog', async (d) => { lastDefault = d.defaultValue(); if (d.type() === 'prompt' && answer != null) { const a = answer; answer = null; await d.accept(a); } else await d.dismiss(); });
  const ev = (f) => page.evaluate(f);
  const key = async (k, ms = 200) => { await page.keyboard.down(k); await sleep(50); await page.keyboard.up(k); await sleep(ms); };
  const until = async (f, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await ev(f).catch(() => false)) return true; await sleep(50); } return false; };
  const top = '(Game.overlays[Game.overlays.length - 1] || {})';
  const text = `Msg.pages ? Msg.pages.map((p) => p.filter((g) => !g.cmd).map((g) => g.ch).join('')).join(' ') : ''`;
  const titleOptions = async (url) => {
    await page.goto(url); await sleep(2500);
    await key('KeyZ', 900);
    for (let k = await ev('Game.scene.index'); k < 2; k++) await key('ArrowDown');
    await key('KeyZ', 500);
  };
  const action = async (label, choice) => {   // an OPTIONS row, then one of the choices it offers
    const i = await ev(`Game.scene.opts.items.findIndex((it) => it.label === '${label}')`);
    for (let k = await ev('Game.scene.opts.index'); k < i; k++) await key('ArrowDown', 120);
    await key('KeyZ', 300);
    await until(`${top} instanceof ChoiceBox`);
    for (let k = 0; k < choice; k++) await key('ArrowDown', 150);
  };
  const question = async () => { await until(`${top} instanceof ChoiceBox`); return ev(text); };
  const closeMessages = async () => { for (let k = 0; k < 6 && (await ev('Game.overlays.length')); k++) await key('KeyZ', 350); };
  const slot = (n) => ev(`localStorage.getItem('pitterpatter_save_${n}')`);

  // the copy on disk: two save files, exported as a code and as a file
  await page.goto(FILE + '?map=crumb_peak&ch=3&lv=5'); await sleep(2500);
  await ev(`(() => { State.d.marbles = 555; Story.beforeSave(); State.save(1); State.d.marbles = 111; State.d.location = 'Somewhere Else'; State.save(3); })()`);
  const raw = { 1: await slot(1), 3: await slot(3) };
  await titleOptions(FILE);
  await ev(`(() => { const w = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = (t) => { window.COPIED = t; return w(t); }; })()`);
  await action('Export saves', 0); await key('KeyZ', 700);
  const code = (await ev('window.COPIED')) || lastDefault;
  check('export as a code', !!code && code.startsWith('PITTERPATTER-SAVES-1:'), await ev(text));
  await closeMessages();
  await action('Export saves', 1); await key('KeyZ', 1500);
  const files = fs.readdirSync(DL);
  check('export as a file', files.length === 1 && fs.readFileSync(path.join(DL, files[0]), 'utf8') === code, files);
  await closeMessages();

  // the other site: import the code
  await page.goto(SITE); await sleep(2500);
  check('other site starts empty', !(await ev('State.anySave()')), null);
  await titleOptions(SITE);
  answer = code;
  await action('Import saves', 0); await key('KeyZ', 600);
  const q = await question();
  check('import asks first', /FILE 1 .*FILE 3/.test(q) && !/replaced/.test(q), q);
  await key('KeyZ', 900); await closeMessages();
  check('imported files are identical', (await slot(1)) === raw[1] && (await slot(3)) === raw[3], null);
  await key('KeyX', 500); await key('ArrowUp', 200); await key('KeyZ', 600); await key('KeyZ', 2500);   // CONTINUE, FILE 1
  const loaded = await ev(`({ map: Game.scene.mapId, marbles: State.d.marbles })`);
  check('imported FILE 1 plays', loaded.map === 'crumb_peak' && loaded.marbles === 555, loaded);

  // import the file over a different FILE 1
  await ev(`(() => { const d = JSON.parse(localStorage.getItem('pitterpatter_save_1')); d.marbles = 999; localStorage.setItem('pitterpatter_save_1', JSON.stringify(d)); })()`);
  await titleOptions(SITE);
  await action('Import saves', 1);
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), key('KeyZ', 100)]);
  await chooser.accept([path.join(DL, files[0])]);
  const q2 = await question();
  check('warns before replacing', /FILE 1 and FILE 3 on this device will be replaced/.test(q2), q2);
  await key('KeyZ', 900); await closeMessages();
  check('file import replaced FILE 1', (await slot(1)) === raw[1], null);

  // a wrong code and "Never mind" change nothing; a raw copy of the browser storage also imports
  const before = await ev('JSON.stringify(localStorage)');
  answer = 'hello there';
  await action('Import saves', 0); await key('KeyZ', 900);
  const bad = await ev(text);
  await closeMessages();
  answer = code;
  await action('Import saves', 0); await key('KeyZ', 600);
  await question(); await key('ArrowDown', 150); await key('KeyZ', 600);
  check('wrong code / never mind: no change', (await ev('JSON.stringify(localStorage)')) === before, bad);
  answer = JSON.stringify({ pitterpatter_save_2: raw[3], pitterpatter_options: '{}' });
  await action('Import saves', 0); await key('KeyZ', 600);
  await question(); await key('KeyZ', 900); await closeMessages();
  check('raw storage copy imports', (await slot(2)) === raw[3] && (await ev(`localStorage.getItem('pitterpatter_options')`)) !== '{}', null);
  check('no errors', !errs.length && !(await ev('Game.errors.length')), errs);
  await browser.close();
})().catch((e) => { console.error(e); failed++; }).finally(() => {
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(failed ? `${failed} check(s) failed` : 'export and import work');
  process.exit(failed ? 1 : 0);
});
