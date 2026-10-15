import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";
const scratch = path.resolve(".tmp-bai4-import");
const pages = JSON.parse(
  await fs.readFile(path.join(scratch, "pages.json"), "utf8"),
);
await fs.mkdir("public/bai4", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 800, height: 1100 },
    deviceScaleFactor: 2,
  });
  for (const number of pages) {
    await page.goto(
      pathToFileURL(path.join(scratch, `trang-${number}.html`)).href,
    );
    await page.evaluate(() => document.fonts.ready);
    const png = await page.locator(".sheet").screenshot();
    await sharp(png)
      .webp({ quality: 92 })
      .toFile(`public/bai4/trang-${number}.webp`);
    const info = await sharp(png).metadata();
    console.log(
      JSON.stringify({ page: number, width: info.width, height: info.height }),
    );
  }
} finally {
  await browser.close();
}
