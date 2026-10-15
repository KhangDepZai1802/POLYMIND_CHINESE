import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.BAI4_CHECK_URL ?? "http://localhost:3000"}/nghe`,
    { waitUntil: "domcontentloaded" },
  );
  await page.getByRole("link", { name: /Bài 4 – Phương hướng/ }).click();
  await expect(page).toHaveURL(/\/nghe\/bai-4$/);
  const links = await page
    .locator("main ol a")
    .evaluateAll((nodes) => nodes.map((node) => node.href));
  if (links.length !== 9) throw new Error("Expected nine lesson4 recordings");
  for (const href of links) {
    console.log("Checking " + new URL(href).pathname);
    await page.goto(href, { waitUntil: "domcontentloaded" });
    const audio = page.locator("audio");
    await expect(audio).toHaveCount(1);
    await audio.evaluate((node) => {
      node.preload = "auto";
      node.load();
    });
    await page.waitForFunction(
      () => {
        const node = document.querySelector("audio");
        return node && (node.readyState >= 1 || node.error);
      },
      undefined,
      { timeout: 15000 },
    );
    await audio.evaluate((node) => {
      if (node.error)
        throw new Error(`Audio decoding failed: ${node.error.code}`);
      if (!Number.isFinite(node.duration) || node.duration <= 0)
        throw new Error("Invalid audio duration");
    });
    await page
      .getByRole("button", { name: "Tốc độ 1.25x", exact: true })
      .click();
    if ((await audio.evaluate((node) => node.playbackRate)) !== 1.25)
      throw new Error("Playback speed failed");
    await audio.evaluate((node)=>node.play());
    await expect.poll(()=>audio.evaluate((node)=>node.currentTime)).toBeGreaterThan(0);
    await audio.evaluate((node)=>node.pause());
    await expect(page.locator("figure img")).toBeVisible();
    await expect
      .poll(() =>
        page.locator("figure img").evaluate((node) => node.naturalWidth),
      )
      .toBeGreaterThan(0);
    console.log(
      JSON.stringify({
        path: new URL(href).pathname,
        duration: await audio.evaluate((node) => node.duration),
      }),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(links[0]);
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw new Error("Mobile horizontal overflow");
  await page.getByRole("link", { name: /Về Bài 4/ }).click();
  await expect(page).toHaveURL(/\/nghe\/bai-4$/);
  await page.getByRole("link", { name: "Tất cả bài nghe" }).click();
  await page.getByRole("link", { name: /Bài 3 – Thời gian/ }).click();
  await expect(page.locator("main ol a")).toHaveCount(22);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Passed: 9 audio metadata/images/speed, mobile390, lesson navigation and 22 lesson3 entries.",
  );
} finally {
  await browser.close();
}
