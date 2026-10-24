import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
try {
  await page.goto("http://localhost:3000/");
  await page.getByRole("button", { name: "サンプルを試す" }).click();
  await page.locator(".timeline-scroll").waitFor();
  for (const [width, height] of [
    [3840, 2160],
    [1920, 1080],
    [1440, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const main = document
        .querySelector(".main-content")
        .getBoundingClientRect();
      const scroll = document
        .querySelector(".timeline-scroll")
        .getBoundingClientRect();
      const footer = document
        .querySelector(".schedule-footer")
        .getBoundingClientRect();
      return {
        main: { left: main.left, width: main.width },
        scroll: { top: scroll.top, height: scroll.height, width: scroll.width },
        footer: footer.bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    console.log(width, height, JSON.stringify(m));
    expect(m.overflow).toBe(false);
    if (width >= 1920) {
      expect(m.main.width).toBe(width - 236);
      expect(m.scroll.height).toBeGreaterThan(height - m.scroll.top - 120);
      expect(m.footer).toBeLessThanOrEqual(height);
    }
    if (width === 3840)
      await page.screenshot({
        path: "tests/responsive-4k.png",
        fullPage: true,
      });
    if (width === 390) {
      await expect(page.locator(".mobile-programs")).toBeVisible();
      await expect(page.locator(".desktop-timeline")).toBeHidden();
      await page.screenshot({
        path: "tests/responsive-mobile.png",
        fullPage: true,
      });
    }
  }
} finally {
  await Promise.race([
    browser.close(),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
}
process.exit(0);
