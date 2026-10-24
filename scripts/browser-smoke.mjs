import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  console.log("step 7");
  await page.goto("http://localhost:3000/");
  console.log("step 8");
  await page.getByRole("button", { name: "サンプルを試す" }).click();
  console.log("step 9");
  await page
    .getByRole("heading", { name: "スケジュール", exact: false })
    .waitFor();
  console.log("step 10");
  await page.locator(".toast").waitFor({ state: "hidden" });
  console.log("step 11");
  await page.screenshot({
    path: "tests/desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const scroller = page.locator(".timeline-scroll");
  console.log("step 13");
  await scroller.evaluate((el) => {
    el.scrollLeft = 400;
    el.scrollTop = 100;
  });
  console.log("step 14");
  await expect
    .poll(async () =>
      page
        .locator(".row-label")
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().left)),
    )
    .toBe(269);
  console.log("step 15");
  await scroller.evaluate((el) => {
    el.scrollLeft = 0;
    el.scrollTop = 0;
  });
  console.log("step 16");
  console.log("drag, resize, undo, vertical");
  const firstBar = page.locator(".schedule-bar").first();
  const box = await firstBar.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(firstBar).toHaveAttribute("title", /09:15/);
  await page.getByTitle("取り消し (Ctrl+Z)", { exact: true }).click();
  await expect(firstBar).toHaveAttribute("title", /09:00/);
  const endHandle = firstBar.locator(".resize-handle.end");
  const handle = await endHandle.boundingBox();
  await page.mouse.move(handle.x + 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 32, handle.y + handle.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(firstBar).toHaveAttribute("title", /09:40/);
  await page.getByTitle("取り消し (Ctrl+Z)", { exact: true }).click();
  await page.getByTitle("時間軸を反転", { exact: true }).click();
  await expect(page.locator(".timeline-scroll.vertical")).toBeVisible();
  await page.getByTitle("時間軸を反転", { exact: true }).click();
  await page.getByRole("button", { name: "プログラム追加" }).click();
  console.log("step 17");
  await page.getByLabel("プログラム名 *").fill("ブラウザ検証用プログラム");
  console.log("step 18");
  await page.getByRole("button", { name: "追加する", exact: true }).click();
  console.log("step 19");
  await page.getByText("保存済み", { exact: true }).waitFor();
  console.log("step 20");
  await page.getByRole("button", { name: "共有する", exact: true }).click();
  const dialog = page.getByRole("dialog");
  console.log("step 22");
  await dialog
    .getByLabel("人物", { exact: true })
    .selectOption({ label: "田中 はるか" });
  console.log("step 23");
  await dialog.getByRole("button", { name: "この内容でリンクを作成" }).click();
  const link = await dialog
    .getByLabel("共有リンク", { exact: true })
    .inputValue();
  const shared = await browser.newPage();
  shared.on("pageerror", (e) => errors.push(e.message));
  await shared.goto(link);
  console.log("step 26");
  await expect(shared.getByText("閲覧専用", { exact: true })).toBeVisible();
  console.log("step 27");
  await expect(shared.locator("body")).not.toContainText("佐藤 みのり");
  console.log("step 28");
  await expect(shared.locator("body")).not.toContainText(
    "スタッフ用の確認メモ",
  );
  console.log("step 29");
  await expect(
    shared.getByRole("button", { name: "プログラム追加" }),
  ).toHaveCount(0);
  const before = await shared.locator(".snapshot-cards").innerText();
  console.log("step 31");
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  console.log("step 32");
  await page.getByRole("button", { name: "一覧", exact: true }).click();
  console.log("step 33");
  await page
    .getByRole("heading", { name: "オープニング", exact: true })
    .click();
  console.log("step 34");
  await page.getByLabel("プログラム名 *").fill("更新されたオープニング");
  console.log("step 35");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  console.log("step 36");
  await shared.reload();
  console.log("step 37");
  await shared.locator(".snapshot-card").first().waitFor();
  if ((await shared.locator(".snapshot-cards").innerText()) !== before)
    throw new Error("スナップショットが変更されました");
  console.log("step 38");
  await page.getByText("保存済み", { exact: true }).waitFor();
  console.log("step 39");
  await page.reload();
  console.log("step 40");
  await page.locator(".project-open").first().click();
  console.log("step 41");
  await page.getByRole("button", { name: "一覧", exact: true }).click();
  console.log("step 42");
  await expect(
    page.getByRole("heading", { name: "ブラウザ検証用プログラム" }),
  ).toBeVisible();
  console.log("step 43");
  await expect(
    page.getByRole("heading", { name: "更新されたオープニング" }),
  ).toBeVisible();
  console.log("step 44");
  await page.getByRole("button", { name: "エクスポート", exact: true }).click();
  console.log("step 45");
  await page
    .getByRole("button", { name: "プレビューを作成", exact: true })
    .click();
  console.log("step 46");
  await page.locator(".image-preview img").first().waitFor();
  console.log("step 47");
  await expect
    .poll(() =>
      page
        .locator(".image-preview img")
        .first()
        .evaluate((el) => el.naturalWidth),
    )
    .toBe(2800);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-content")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  const src = await page
    .locator(".image-preview img")
    .first()
    .getAttribute("src");
  await fs.writeFile(
    "tests/export.png",
    Buffer.from(src.split(",")[1], "base64"),
  );
  console.log("step 49");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  console.log("step 50");
  await page.setViewportSize({ width: 390, height: 844 });
  console.log("step 51");
  await expect
    .poll(async () =>
      page
        .locator(".sidebar")
        .evaluate((el) => Math.round(el.getBoundingClientRect().right)),
    )
    .toBe(0);
  console.log("step 52");
  await page.getByRole("button", { name: "プログラム追加" }).click();
  console.log("step 53");
  await page.getByLabel("プログラム名 *").fill("スマートフォンから追加");
  console.log("step 54");
  await page.getByRole("button", { name: "追加する", exact: true }).click();
  console.log("step 55");
  await expect(
    page.getByRole("heading", { name: "スマートフォンから追加" }),
  ).toBeVisible();
  console.log("step 56");
  await page.screenshot({
    path: "tests/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log("step 57");
  await shared.setViewportSize({ width: 390, height: 844 });
  await shared.screenshot({
    path: "tests/shared-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    JSON.stringify({
      runtimeErrors: errors,
      checks: [
        "作成",
        "固定列スクロール",
        "編集",
        "保存と再読み込み",
        "人物別共有",
        "共有の独立性",
        "閲覧専用",
        "PNG全件出力",
        "モバイル追加",
      ],
    }),
  );
} catch (error) {
  console.log("FAILED: " + String(error.message).slice(0, 1500));
  process.exitCode = 1;
} finally {
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}
process.exit(process.exitCode || 0);
