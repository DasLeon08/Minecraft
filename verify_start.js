const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/*.js', async route => {
    if (route.request().url().includes('game.js')) {
      const resp = await route.fetch();
      let body = await resp.text();
      body = body.replace('function animate() {', 'function animate() { return;');
      await route.fulfill({ body, contentType: 'application/javascript' });
    } else {
      route.continue();
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Take screenshot of the new start screen!
  await page.screenshot({ path: '/home/jules/verification/start_screen.png' });

  // Click singleplayer
  await page.click('#btn-singleplayer');
  await page.waitForTimeout(1000);

  // Open inventory to test hotbar styling
  await page.evaluate(() => {
    document.getElementById('inventory').style.display = 'block';
  });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/home/jules/verification/start_screen_hud.png' });

  await browser.close();
})();
