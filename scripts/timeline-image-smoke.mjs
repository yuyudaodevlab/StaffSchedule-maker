import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://localhost:3000/");
  await page.getByRole("button", { name: "サンプルを試す" }).click();
  await page.locator(".timeline-canvas").waitFor();
  await page.locator(".timeline-scroll").evaluate((el) => {
    el.scrollLeft = 500;
    el.scrollTop = 200;
  });
  const dims = await page
    .locator(".timeline-canvas")
    .evaluate((el) => ({ width: el.offsetWidth, height: el.offsetHeight }));
  await page.getByRole("button", { name: "画像にする", exact: true }).click();
  await page
    .getByRole("button", { name: "タイムライン画像をプレビュー", exact: true })
    .click();
  const img = page.getByRole("img", { name: "運営タイムライン 1枚目" });
  await expect(img).toBeVisible({ timeout: 60000 });
  const result = await img.evaluate((el) => ({
    width: el.naturalWidth,
    height: el.naturalHeight,
    src: el.src,
  }));
  const colors = await img.evaluate((el) => {
    const canvas = document.createElement("canvas");
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(el, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const unique = new Set();
    let opaque = 0;
    for (let i = 0; i < data.length; i += 400) {
      if (data[i + 3] === 255) opaque++;
      unique.add(data.slice(i, i + 4).join(","));
    }
    return { unique: unique.size, opaque };
  });
  expect(colors.unique).toBeGreaterThan(20);
  expect(colors.opaque).toBeGreaterThan(1000);
  expect(result.width).toBe(dims.width * 2);
  expect(result.height).toBe(dims.height * 2);
  await fs.writeFile(
    "tests/timeline-image.png",
    Buffer.from(result.src.split(",")[1], "base64"),
  );
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect
    .poll(() =>
      page.locator(".timeline-scroll").evaluate((el) => el.scrollLeft),
    )
    .toBe(500);
  await page.getByTitle("時間軸を反転", { exact: true }).click();
  await page.getByRole("button", { name: "画像にする", exact: true }).click();
  await page.getByLabel("タイムライン画像の解像度").selectOption("1");
  await page
    .getByRole("button", { name: "タイムライン画像をプレビュー", exact: true })
    .click();
  await expect(img).toBeVisible({ timeout: 60000 });
  const images = page.locator(".image-preview img");
  expect(await images.count()).toBeGreaterThan(1);
  const last = await images
    .last()
    .evaluate((el) => ({
      src: el.src,
      width: el.naturalWidth,
      height: el.naturalHeight,
    }));
  expect(last.width).toBeGreaterThan(80);
  expect(last.height).toBeGreaterThan(90);
  await fs.writeFile(
    "tests/timeline-image-vertical.png",
    Buffer.from(last.src.split(",")[1], "base64"),
  );
  expect(errors).toEqual([]);
  console.log(
    "Timeline PNG: full content, scroll restoration, vertical split, no browser errors passed",
    dims,
  );
} finally {
  await Promise.race([
    browser.close(),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
}
process.exit(0);
