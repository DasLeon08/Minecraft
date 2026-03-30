const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.route('**/*.js', async route => {
    if (route.request().url().includes('game.js')) {
      const resp = await route.fetch();
      let body = await resp.text();
      body = body.replace('function animate() {', 'function animate() { \n // MANUAL PATCH: Stop loop but render once \n if (window.__rendered) return; window.__rendered = true; ');

      // Patch out composer to test if post-processing is freezing the swiftshader
      body = body.replace('composer.render();', 'renderer.render(scene, camera);');

      // The map size of the procedural generation is simply too large for Swiftshader to render.
      body = body.replace('const worldSize = 96;', 'const worldSize = 16;');

      await route.fulfill({ body, contentType: 'application/javascript' });
    } else {
      route.continue();
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Send WASD key 'W' to test the new start screen bypass feature
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(2000);

  // Force a sunset time for the sky rendering test
  await page.evaluate(() => {
    timeOfDay = Math.PI - 0.2; // sunset
    window.__rendered = false; // allow one more render
    if (window.animate) window.animate();
  });

  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/home/jules/verification/sky_sunset3.png' });

  await browser.close();
})();
