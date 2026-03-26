import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(3000) # give it time to gen the world
        await page.screenshot(path="/home/jules/verification/mountain_view.png")
        await browser.close()

asyncio.run(main())
