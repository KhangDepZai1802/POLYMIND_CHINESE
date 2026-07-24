import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P15-T9` — quality gate liên module M20→M27.
 *
 * Mỗi module đã có spec riêng, nhưng spec riêng chỉ đo **ba** bề rộng
 * (360/768/1280) và chỉ nhìn màn của chính nó. File này đo **cả bậc thang
 * user chốt trong Definition of Done** (360/390/430/768/1024/1280) trên **mọi**
 * màn học viên trong một lượt, để bắt hai lớp lỗi mà spec từng module không
 * bắt được:
 *
 *  1. Bề rộng nằm giữa hai mốc cũ — 390/430 là iPhone thật, 1024 là iPad
 *     ngang, đúng chỗ `sm:`/`lg:` đổi cột.
 *  2. Lệch nhau giữa các màn — cùng một khu vực mà màn này có `<h1>`, màn kia
 *     không; màn này có landmark `<main>`, màn kia không.
 */

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;

/** Tám bề mặt học viên trong phạm vi M20→M27 (M24 nửa Flashcard đang hoãn). */
const STUDENT_SURFACES = [
  { module: "M20", path: "/student", h1: "Xin chào" },
  { module: "M21", path: "/student/class", h1: "Lớp của tôi" },
  { module: "M22", path: "/student/exercises", h1: "Bài tập" },
  { module: "M23", path: "/student/exams", h1: "Kiểm tra / Thi" },
  { module: "M24", path: "/student/review", h1: "Ôn tập" },
  { module: "M25", path: "/student/results", h1: "Kết quả" },
  { module: "M26", path: "/student/tuition", h1: "Học phí" },
  { module: "M27", path: "/student/profile", h1: "Hồ sơ" },
] as const;

async function loginStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label}: trang tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
}

test("Tám màn học viên không tràn ngang ở cả sáu bề rộng", async ({ page }) => {
  await loginStudent(page);

  for (const surface of STUDENT_SURFACES) {
    for (const width of WIDTH_LADDER) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });

      const label = `${surface.module} ${surface.path} @ ${width}px`;

      // Mỗi màn đúng một `<h1>` và nội dung của nó khớp tên màn — nếu một màn
      // rơi mất `PageHeader` thì người dùng trình đọc màn hình mất mốc định vị
      // đầu trang, mà nhìn bằng mắt thì gần như không thấy.
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1, label).toHaveCount(1);
      await expect(h1, label).toContainText(surface.h1);

      await expectNoHorizontalOverflow(page, label);
    }
  }
});

test("Tám màn học viên sạch axe A/AA ở mobile nhỏ nhất và desktop", async ({
  page,
}) => {
  await loginStudent(page);

  // Chỉ hai đầu bậc thang: axe tốn ~2s mỗi lượt, mà lỗi contrast/ARIA không
  // đổi theo bề rộng — cái đổi theo bề rộng là bố cục, đã do test trên bắt.
  for (const width of [360, 1280]) {
    for (const surface of STUDENT_SURFACES) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        results.violations,
        `${surface.module} ${surface.path} @ ${width}px`,
      ).toEqual([]);
    }
  }
});

test("Mọi màn học viên đều có landmark điều hướng và vùng nội dung chính", async ({
  page,
}) => {
  await loginStudent(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const surface of STUDENT_SURFACES) {
    await page.goto(surface.path, { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("main"),
      `${surface.module}: thiếu <main>`,
    ).toHaveCount(1);
    await expect(
      page.getByRole("contentinfo"),
      `${surface.module}: thiếu footer bản quyền (D-17)`,
    ).toHaveCount(1);
  }
});

test("Mọi dải tab học viên cuộn ngang đều tới được bằng bàn phím", async ({
  page,
}) => {
  await loginStudent(page);
  // 360px là chỗ dải tab thật sự tràn và phải cuộn — ở desktop nó vừa khung nên
  // lỗi không lộ ra.
  await page.setViewportSize({ width: 360, height: 800 });

  const tabStrips = [
    { path: "/student/class", label: "Nội dung lớp học" },
    { path: "/student/exercises", label: "Trạng thái bài tập" },
    { path: "/student/review", label: "Hình thức ôn tập" },
    { path: "/student/results", label: "Nhóm kết quả" },
  ];

  for (const strip of tabStrips) {
    await page.goto(strip.path, { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: strip.label });
    await expect(nav, `${strip.path}: không thấy dải tab`).toBeVisible();

    // Vùng cuộn ngang không focus được thì bàn phím không tới được các tab bị
    // đẩy ra ngoài khung (`P15-T9` — trước đó chỉ `/student/class` bị sót).
    await nav.focus();
    await expect(nav, `${strip.path}: dải tab không nhận được focus`).toBeFocused();
  }
});

test("Ô số liệu bento hiển thị số dạng bảng ở cả Tổng quan lẫn Kết quả", async ({
  page,
}) => {
  await loginStudent(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  // `StudentStatCard` gom từ ba bản sao (`P15-T9`). Ba bản cũ đã trôi khác nhau
  // ở `tabular-nums`: cột số ở Học phí thẳng hàng còn ở Tổng quan/Kết quả thì
  // không. Ở đây chỉ kiểm hai màn luôn có dữ liệu với tài khoản seed —
  // `/student/tuition` cần fixture hóa đơn nên do spec M26 lo, còn ràng buộc
  // "ba màn dùng chung một component" do test nguồn ở Vitest khoá.
  for (const path of ["/student", "/student/results"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const values = page.locator("p.tabular-nums.font-bold.text-xl");
    const count = await values.count();
    expect(count, `${path}: không thấy ô số liệu bento nào`).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const numeric = await values
        .nth(i)
        .evaluate((el) => getComputedStyle(el).fontVariantNumeric);
      expect(
        numeric,
        `${path}: ô số liệu ${i} không dùng tabular-nums`,
      ).toContain("tabular-nums");
    }
  }
});
