const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept the JS loading to prevent ThreeJS from crashing Playwright
  await page.route('**/*.js', async route => {
    if (route.request().url().includes('game.js')) {
      const resp = await route.fetch();
      let body = await resp.text();
      // Patch game.js so animate() just returns
      body = body.replace('function animate() {', 'function animate() { return;');
      await route.fulfill({ body, contentType: 'application/javascript' });
    } else {
      route.continue();
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    if (document.getElementById('furnace-ui')) {
        document.getElementById('furnace-ui').style.display = 'block';
    }
  });

  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/home/jules/verification/furnace3.png' });

  await browser.close();
})();
