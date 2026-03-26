import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:3000")

        # Wait for game to load
        await page.wait_for_timeout(2000)

        # Click to start
        await page.click("text=Click to play")
        await page.wait_for_timeout(1000)

        # Press E to open inventory
        await page.keyboard.press("e")
        await page.wait_for_timeout(1000)

        await page.screenshot(path="inventory_screenshot.png")
        await browser.close()

asyncio.run(main())
