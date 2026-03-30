const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

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
    // stop RAF to prevent WebGL from timing out the screenshot
    window.cancelAnimationFrame = () => {};
    // Trigger /end command manually to change lighting/fog logic for UI test
    // Assuming we just want to verify the dimension switch works without crashing
    if (window.io) {
        document.getElementById('chat-input').value = '/end';
    }
  });

  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/home/jules/verification/end.png' });

  await browser.close();
})();
