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
  await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1 });
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
    if (s.eval) { try { const v = await page.evaluate(s.eval); if (v !== undefined) logs.push('[eval] ' + JSON.stringify(v).slice(0, 2000)); } catch (e) { logs.push('[evalerr] ' + e.message); } }
    if (s.shot) await page.screenshot({ path: path.join(out, s.shot) });
  }
  console.log(logs.join('\n'));
  await browser.close();
})();
