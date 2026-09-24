// Headless test driver: node run.js <steps.json> [outdir]
// steps: [{wait:ms},{key:'KeyZ'},{hold:'ArrowRight',ms:500},{shot:'x.png'},{eval:'js expr'}]
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
(async () => {
  const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const out = process.argv[3] || path.join(__dirname, 'shots');
  fs.mkdirSync(out, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', '--window-size=960,720'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
  const cdp = await page.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  const url = 'file://' + path.resolve(__dirname, '../../game/index.html') + (process.env.QS || '');
  await page.goto(url);
  for (const s of steps) {
    if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
    if (s.key) { await page.keyboard.down(s.key); await new Promise((r) => setTimeout(r, s.ms || 60)); await page.keyboard.up(s.key); }
    if (s.hold) { await page.keyboard.down(s.hold); await new Promise((r) => setTimeout(r, s.ms || 300)); await page.keyboard.up(s.hold); }
    if (s.spam) {
      const end = Date.now() + (s.ms || 3000);
      while (Date.now() < end) {
        await page.keyboard.down(s.spam); await new Promise((r) => setTimeout(r, 40)); await page.keyboard.up(s.spam);
        await new Promise((r) => setTimeout(r, s.every || 110));
        if (s.until) { try { if (await page.evaluate(s.until)) break; } catch (e) { /* ignore */ } }
      }
    }
    if (s.tapspam) {
      const end = Date.now() + (s.ms || 3000);
      while (Date.now() < end) {
        await touch('touchStart', [s.tapspam]); await sleep(40); await touch('touchEnd', []); await sleep(s.every || 150);
        if (s.until) { try { if (await page.evaluate(s.until)) break; } catch (e) { /* ignore */ } }
      }
    }
    if (s.tapspamAt) {
      // like tapspam, but the position (game coordinates) is re-computed in the page before every tap
      const end = Date.now() + (s.ms || 3000);
      while (Date.now() < end) {
        let p = null;
        try { p = await page.evaluate(`(() => { const g = (${s.tapspamAt}); const r = Game.canvas.getBoundingClientRect(); return [r.left + g[0] * r.width / Game.W, r.top + g[1] * r.height / Game.H]; })()`); } catch (e) { /* ignore */ }
        if (p) { await touch('touchStart', [p]); await sleep(40); await touch('touchEnd', []); }
        await sleep(s.every || 150);
        if (s.until) { try { if (await page.evaluate(s.until)) break; } catch (e) { /* ignore */ } }
      }
    }
    if (s.tap) { await touch('touchStart', [s.tap]); await sleep(60); await touch('touchEnd', []); }
    if (s.waitUntil) {
      const end = Date.now() + (s.ms || 10000);
      let ok = false;
      while (Date.now() < end) { try { if (await page.evaluate(s.waitUntil)) { ok = true; break; } } catch (e) { /* ignore */ } await sleep(50); }
      if (!ok) logs.push('[timeout] ' + s.waitUntil);
    }
    if (s.tapAt) {
      // tap at game coordinates (960x720) computed in the page, e.g. "[480, 508]"
      let p = null;
      try { p = await page.evaluate(`(() => { const g = (${s.tapAt}); const r = Game.canvas.getBoundingClientRect(); return [r.left + g[0] * r.width / Game.W, r.top + g[1] * r.height / Game.H]; })()`); }
      catch (e) { logs.push('[tapAt error] ' + s.tapAt + ': ' + e.message); }
      if (p && !p.every(Number.isFinite)) { logs.push('[tapAt error] ' + s.tapAt + ': not a position ' + JSON.stringify(p)); p = null; }
      if (p) { await touch('touchStart', [p]); await sleep(60); await touch('touchEnd', []); }
    }
    if (s.tap2) { const [x, y] = s.tap2; await touch('touchStart', [[x, y], [x + 80, y]]); await sleep(90); await touch('touchEnd', []); }
    if (s.swipe) {
      const [x0, y0, x1, y1] = s.swipe;
      await touch('touchStart', [[x0, y0]]);
      const n = s.fast ? 2 : 6;
      for (let i = 1; i <= n; i++) { await touch('touchMove', [[x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]]); if (!s.fast) await sleep(16); }
      if (s.ms) await sleep(s.ms);
      await touch('touchEnd', []);
    }
    if (s.eval) { try { const v = await page.evaluate(s.eval); if (v !== undefined) logs.push('[eval] ' + JSON.stringify(v).slice(0, 2000)); } catch (e) { logs.push('[evalerr] ' + e.message); } }
    if (s.shot) await page.screenshot({ path: path.join(out, s.shot) });
  }
  console.log(logs.join('\n'));
  await browser.close();
})();
