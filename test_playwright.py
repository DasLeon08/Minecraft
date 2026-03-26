import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:3000")

        # Wait for game to load
        await page.wait_for_timeout(2000)

        # Click the instructions div instead of "text=Click to play"
        await page.locator('#instructions').click()
        await page.wait_for_timeout(1000)

        # Look around
        await page.mouse.move(500, 500)
        await page.wait_for_timeout(500)
        await page.mouse.move(600, 500)
        await page.wait_for_timeout(500)

        # Open inventory
        await page.keyboard.press("e")
        await page.wait_for_timeout(1000)

        await page.screenshot(path="/home/jules/verification/inventory_screenshot.png")
        await browser.close()

asyncio.run(main())
