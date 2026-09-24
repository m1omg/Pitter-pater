// Save compatibility: make saves with an older release, then load them in the current game.
// node savecompat.js [git ref of the old release]   (default: the first release)
const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const REF = process.argv[2] || '0559184';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-savecompat-'));
execSync(`git -C "${ROOT}" archive ${REF} game | tar -x -C "${TMP}"`);
const OLD = 'file://' + path.join(TMP, 'game/index.html');
const NEW = 'file://' + path.join(ROOT, 'game/index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (label, ok, v) => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + label.padEnd(30), JSON.stringify(v)); };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new', userDataDir: path.join(TMP, 'profile'),
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'TMPDIR')),   // Chrome's own socket path must stay short
    args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--window-size=960,720'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const key = async (k, ms = 250) => { await page.keyboard.down(k); await sleep(60); await page.keyboard.up(k); await sleep(ms); };
  const ev = (f) => page.evaluate(f);

  // the old release: two saves and changed settings
  await page.goto(OLD + '?map=downstairs&x=11&y=4&dir=up'); await sleep(2500);
  await ev(`(() => { State.d.flags.said_goodnight = true; State.addItem('cookie', 2); State.d.marbles = 321; Game.playTime = 4321 * 60; State.d.playTime = Game.playTime; Story.beforeSave(); State.options.textSpeed = 2; State.options.alwaysRun = true; State.saveOptions(); State.save(1); })()`);
  await page.goto(OLD + '?map=crumb_peak&ch=3&lv=5'); await sleep(2500);
  await ev(`(() => { State.d.marbles = 777; Story.beforeSave(); State.save(2); })()`);

  // the current game, through the title screen
  await page.goto(NEW); await sleep(2500);
  const o = await ev('State.options');
  check('old settings kept', o.textSpeed === 2 && o.alwaysRun === true && o.touchStick === false, o);
  await key('KeyZ', 900);
  check('title offers CONTINUE', await ev(`Game.scene.items()[Game.scene.index] === 'CONTINUE'`), await ev('Game.scene.index'));
  await key('KeyZ', 600); await key('KeyZ', 2500);   // CONTINUE, FILE 1
  const a = await ev(`({ map: Game.scene.mapId, pos: [Game.scene.player.x, Game.scene.player.y], marbles: State.d.marbles, cookies: State.itemCount('cookie'), flag: State.flag('said_goodnight'), time: Math.round(Game.playTime / 60) })`);
  check('FILE 1 loads', a.map === 'downstairs' && a.pos.join() === '11,4' && a.marbles === 321 && a.flag && a.time === 4321, a);
  await page.goto(NEW); await sleep(2500);
  await key('KeyZ', 900); await key('KeyZ', 600); await key('ArrowDown', 300); await key('KeyZ', 2500);   // CONTINUE, FILE 2
  const b = await ev(`({ map: Game.scene.mapId, party: State.d.party, marbles: State.d.marbles })`);
  check('FILE 2 loads', b.map === 'crumb_peak' && b.party.length === 4 && b.marbles === 777, b);
  await key('KeyX', 600);
  check('pause menu opens', await ev(`Game.overlays.some((m) => m instanceof PauseMenu)`), null);
  await key('KeyX', 400);
  check('saving again works', await ev(`(() => { Story.beforeSave(); return State.save(3) && State.peek(3).map === 'crumb_peak'; })()`), null);
  check('no errors', !errs.length && !(await ev('Game.errors.length')), errs);
  await browser.close();
})().catch((e) => { console.error(e); failed++; }).finally(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(failed ? `${failed} check(s) failed` : 'saves from ' + REF + ' load fine');
  process.exit(failed ? 1 : 0);
});
