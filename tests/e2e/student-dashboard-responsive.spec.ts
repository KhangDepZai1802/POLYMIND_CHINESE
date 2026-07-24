import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

test("dashboard học viên giữ hierarchy, WCAG AA và không tràn ở ba tầng", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("heading", { name: "Buổi học kế tiếp", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Bài tập cần nộp/, level: 2 }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, viewport.name).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, viewport.name).toEqual([]);

    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m20-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }

  await page.setViewportSize(viewports[0]);
  const heroMobile = await page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Buổi học kế tiếp" }) })
    .boundingBox();
  const exerciseStatMobile = await page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Bài chưa nộp" })
    .first()
    .boundingBox();
  expect(heroMobile).not.toBeNull();
  expect(exerciseStatMobile).not.toBeNull();
  expect(heroMobile!.y + heroMobile!.height).toBeLessThanOrEqual(
    exerciseStatMobile!.y,
  );

  await page.setViewportSize(viewports[1]);
  const exerciseStatTablet = await page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Bài chưa nộp" })
    .first()
    .boundingBox();
  expect(exerciseStatTablet).not.toBeNull();
  expect(exerciseStatTablet!.width).toBeGreaterThanOrEqual(180);

  await page.setViewportSize(viewports[2]);
  const heroDesktop = await page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Buổi học kế tiếp" }) })
    .boundingBox();
  const exerciseStatDesktop = await page
    .locator('[data-slot="card"]')
    .filter({ hasText: "Bài chưa nộp" })
    .first()
    .boundingBox();
  expect(heroDesktop).not.toBeNull();
  expect(exerciseStatDesktop).not.toBeNull();
  expect(heroDesktop!.x + heroDesktop!.width).toBeLessThanOrEqual(
    exerciseStatDesktop!.x,
  );
});
