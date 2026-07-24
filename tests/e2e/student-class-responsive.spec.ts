import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

const tabs = [
  "Tổng quan",
  "Lịch/Buổi",
  "Bài tập",
  "Kiểm tra",
  "Tiến độ",
  "Chuyên cần",
  "Tài liệu",
] as const;

test("Lớp của tôi giữ 7 tab, WCAG AA và responsive ba tầng", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
  await page.goto("/student/class", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Lớp của tôi", level: 1 }),
  ).toBeVisible();

  for (const tab of tabs) {
    await expect(page.getByRole("tab", { name: tab })).toBeAttached();
  }

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByRole("tab", { name: "Tổng quan" }).click();
    await expect(
      page.getByRole("heading", { name: "Thông tin lớp", level: 2 }),
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
        path: `C:/tmp/polymind-m21-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }

  await page.setViewportSize(viewports[0]);
  const overviewTab = page.getByRole("tab", { name: "Tổng quan" });
  await overviewTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Lịch/Buổi" })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Lịch học lặp", level: 2 }),
  ).toBeVisible();

  for (const tab of ["Tiến độ", "Chuyên cần", "Tài liệu"] as const) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(
      page.locator('[data-slot="tabs-content"][data-state="active"]'),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, tab).toBeLessThanOrEqual(1);
  }
});
