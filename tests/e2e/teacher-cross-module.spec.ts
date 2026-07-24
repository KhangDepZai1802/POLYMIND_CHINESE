import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P17-T5` — quality gate liên module Giáo viên (M13 → M19).
 *
 * Bảy module được làm trong năm task khác nhau, hai agent khác nhau. Mỗi task
 * đều xanh theo tiêu chí của chính nó, nhưng tiêu chí đó **chỉ nhìn màn của
 * mình**. Ba lớp lỗi lọt qua được, và lượt này đi tìm đúng ba lớp đó:
 *
 * 1. **Bề rộng nằm giữa hai mốc.** M13/M14/M15 chưa từng có spec responsive —
 *    ba module này đóng trước khi thang 360/390/430/768/1024/1280 thành chuẩn.
 * 2. **Lệch nhau giữa các màn.** Cùng một mẫu giao diện mà màn này làm đủ, màn
 *    kia làm thiếu (tiền lệ `UX-UIUX-M21-009`, `UX-UIUX-M25-010`).
 * 3. **Thứ chỉ lộ ra khi MỞ dialog.** Bài học `UX-UIUX-M18-008`: `<Select>` nằm
 *    trong dialog nên spec M16/M17 quét trang tĩnh không bao giờ thấy. Gate
 *    phải mở dialog ra mà quét.
 *
 * Lượt này **không mở lại thiết kế** của từng module.
 */

const DB = "supabase_db_Polymind_Chinese";

/*
 * Tra theo MÃ LỚP, không hard-code UUID: `seed.sql` insert `public.classes` mà
 * không chỉ định `id`, nên UUID sinh mới sau **mỗi lần `db reset`**.
 *
 * `LOP-02` chứ không phải `LOP-01`. `LOP-01` **cố ý** không có buổi nào —
 * `D-11`: "lịch linh hoạt, không có recurrence, đúng nghiệp vụ chứ không phải
 * thiếu dữ liệu". Lấy nó làm fixture thì màn Điểm danh và Nhật ký buổi rỗng, và
 * spec sẽ báo xanh trên một trang không có gì để đo.
 */
const CLASS_ID = sql(`select id from public.classes where code = 'LOP-02';`);

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;
const AXE_WIDTHS = [360, 768, 1280] as const;

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/**
 * Buổi học để mở màn Điểm danh (M15) và Nhật ký buổi (M14 màn C). Lấy từ DB
 * chứ không hard-code: seed đổi thì spec phải đổi theo, không đo nhầm màn rỗng.
 */
const SESSION_ID = sql(`
  select s.id
  from public.class_sessions s
  where s.class_id = '${CLASS_ID}'
  order by s.starts_at
  limit 1;
`);

if (!SESSION_ID) {
  throw new Error("Không tìm được buổi học nào của lớp fixture — seed đã đổi?");
}

const TEACHER_USER_ID = "22222222-2222-2222-2222-222222222221";

/*
 * Seed **không có câu hỏi nào** (`select count(*) from questions` = 0), nên
 * ngân hàng câu hỏi rỗng và menu kebab không tồn tại. Bài kiểm dialog sẽ tự
 * skip — mà skip đúng chỗ này thì mất luôn bài học `UX-UIUX-M18-008`. Dựng một
 * câu hỏi của chính giáo viên đang đăng nhập, đánh dấu bằng tiêu đề để dọn đúng
 * phần mình.
 */
const FIXTURE_TITLE = "E2E P17-T5 — câu hỏi kiểm dialog";

function purgeQuestionFixture() {
  sql(`delete from public.questions where title = '${FIXTURE_TITLE}';`);
}

function setupQuestionFixture() {
  purgeQuestionFixture();
  sql(`
    insert into public.questions (owner_id, title, skill, created_by)
    values ('${TEACHER_USER_ID}', '${FIXTURE_TITLE}', 'vocabulary', '${TEACHER_USER_ID}');
  `);
}

/** Bảy module, đúng tên module để khi đỏ biết ngay phải mở báo cáo nào. */
const SURFACES = [
  { module: "M13", name: "Hôm nay", path: "/teacher", h1: "Hôm nay" },
  { module: "M14", name: "Lớp của tôi", path: "/teacher/classes", h1: "Lớp của tôi" },
  {
    module: "M14",
    name: "Chi tiết lớp",
    path: `/teacher/classes/${CLASS_ID}`,
    h1: null,
  },
  {
    module: "M14",
    name: "Nhật ký buổi",
    path: `/teacher/sessions/${SESSION_ID}`,
    h1: null,
  },
  {
    module: "M15",
    name: "Điểm danh",
    path: `/teacher/attendance?session=${SESSION_ID}`,
    h1: null,
  },
  { module: "M16", name: "Bài tập", path: "/teacher/exercises", h1: null },
  { module: "M16", name: "Bộ đề bài tập", path: "/teacher/exercises/sets", h1: null },
  {
    module: "M16",
    name: "Ngân hàng câu hỏi (bài tập)",
    path: "/teacher/exercises/question-bank",
    h1: null,
  },
  { module: "M17", name: "Kiểm tra / Thi", path: "/teacher/exams", h1: null },
  { module: "M17", name: "Bộ đề thi", path: "/teacher/exams/sets", h1: null },
  {
    module: "M17",
    name: "Ngân hàng câu hỏi (thi)",
    path: "/teacher/exams/question-bank",
    h1: null,
  },
  {
    module: "M18",
    name: "Đánh giá & Ghi chú",
    path: `/teacher/evaluations?class=${CLASS_ID}`,
    h1: null,
  },
  {
    module: "M19",
    name: "Báo cáo lớp",
    path: `/teacher/progress?class=${CLASS_ID}`,
    h1: null,
  },
] as const;

async function loginTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.a@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
}

async function visit(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: "domcontentloaded" });

  /*
   * KHÔNG đủ nếu chỉ chờ `<main>`: `<main>` do `(dashboard)/layout.tsx` cấp nên
   * nó hiện ngay, trong khi phân đoạn trang vẫn đang stream về (RSC). Đo ở
   * khoảnh khắc đó có lần đếm được `h1=0` trên màn thật sự CÓ `PageHeader` —
   * bài kiểm sai chứ không phải sản phẩm sai, và sai kiểu "đỏ ngẫu nhiên" thì
   * còn tệ hơn không có bài kiểm (tiền lệ `P15-T9`, `UX-UIUX-M19-002`).
   *
   * Chờ tới khi phân đoạn trang thật sự có nội dung rồi mới đo.
   */
  await page.locator("main").first().waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");
}

async function overflowPx(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

test("Bảy module không tràn ngang ở cả sáu bề rộng", async ({ page }) => {
  test.slow();
  await loginTeacher(page);

  /*
   * Điều hướng MỘT lần mỗi màn rồi đổi bề rộng, thay vì tải lại trang cho từng
   * mốc. Bố cục ở đây do CSS quyết định nên đổi viewport là đủ để media query
   * tính lại — mà 13 lần tải + 78 lần resize thì nhanh hơn hẳn 78 lần tải, vì
   * `next dev` biên dịch mỗi route theo yêu cầu.
   */
  const overflowing: string[] = [];
  for (const surface of SURFACES) {
    await visit(page, surface.path, WIDTH_LADDER[0]);
    for (const width of WIDTH_LADDER) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await overflowPx(page);
      if (overflow > 1) {
        overflowing.push(
          `${surface.module} ${surface.name} @${width}px tràn ${overflow}px`,
        );
      }
    }
  }

  expect(overflowing, overflowing.join("\n")).toEqual([]);
});

test("Mỗi màn đúng một landmark main và một footer", async ({ page }) => {
  await loginTeacher(page);

  /*
   * Tiền lệ `UX-UIUX-M17-002`: `grading-workspace.tsx` render `<main>` lồng
   * trong `<main>` của layout. Lỗi đó chỉ lộ khi ĐẾM, không lộ khi nhìn.
   */
  const broken: string[] = [];
  for (const surface of SURFACES) {
    await visit(page, surface.path, 1280);
    const mains = await page.locator("main").count();
    const footers = await page.locator("footer").count();
    const h1s = await page.getByRole("heading", { level: 1 }).count();
    if (mains !== 1 || footers !== 1 || h1s !== 1) {
      broken.push(
        `${surface.module} ${surface.name}: main=${mains} footer=${footers} h1=${h1s}`,
      );
    }
  }

  expect(broken, broken.join("\n")).toEqual([]);
});

test("Bảy module sạch axe ở 360/768/1280", async ({ page }) => {
  test.slow();
  await loginTeacher(page);

  const failures: string[] = [];
  for (const surface of SURFACES) {
    await visit(page, surface.path, AXE_WIDTHS[0]);
    for (const width of AXE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      for (const violation of results.violations) {
        failures.push(
          `${surface.module} ${surface.name} @${width}px — ${violation.id} (${violation.impact}): ${violation.nodes
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
        );
      }
    }
  }

  expect(failures, failures.join("\n")).toEqual([]);
});

test("Mọi vùng cuộn ngang đều đi được bằng bàn phím", async ({ page }) => {
  await loginTeacher(page);

  /*
   * Tiền lệ `UX-UIUX-M21-009` (`/student/class`) và `UX-UIUX-M19-002`
   * (`/teacher/progress`): vùng cuộn ngang mà không focus được thì người dùng
   * bàn phím không tới được phần bên phải.
   *
   * Radix `Tabs` dùng **roving tabindex** — chỉ tab đang chọn có `tabindex=0`,
   * các tab còn lại là `-1`. Nên "bên trong có link/nút" KHÔNG đủ để vùng cuộn
   * thành đi được bằng bàn phím; chính vùng cuộn phải nhận được focus.
   *
   * Đo ở 360px: đây là chỗ hẹp nhất, dải tab chắc chắn phải cuộn.
   */
  const broken: string[] = [];
  for (const surface of SURFACES) {
    await visit(page, surface.path, 360);

    const scrollers = page.locator(
      'div[class*="overflow-x-auto"], nav[class*="overflow-x-auto"]',
    );
    const count = await scrollers.count();
    for (let i = 0; i < count; i += 1) {
      const scroller = scrollers.nth(i);
      if (!(await scroller.isVisible())) continue;

      const info = await scroller.evaluate((el) => ({
        scrolls: el.scrollWidth > el.clientWidth + 1,
        tabindex: el.getAttribute("tabindex"),
        tabbableInside: Array.from(
          el.querySelectorAll<HTMLElement>("a[href], button, [tabindex]"),
        ).filter((child) => (child.getAttribute("tabindex") ?? "0") !== "-1")
          .length,
      }));

      // Chỉ tính là lỗi khi vùng đó THẬT SỰ cuộn. Cho `tabindex` một vùng không
      // bao giờ cuộn chỉ tạo thêm một chặng Tab vô nghĩa (`UX-UIUX-M19-002`).
      if (info.scrolls && info.tabindex !== "0" && info.tabbableInside <= 1) {
        broken.push(
          `${surface.module} ${surface.name}: vùng cuộn thứ ${i + 1} không focus được (tabindex=${info.tabindex}, phần tử Tab tới được bên trong=${info.tabbableInside})`,
        );
      }
    }
  }

  expect(broken, broken.join("\n")).toEqual([]);
});

test.describe("Dialog", () => {
  test.beforeAll(setupQuestionFixture);
  test.afterAll(purgeQuestionFixture);

  test("Dialog mở ra vẫn sạch axe — không chỉ quét trang tĩnh", async ({
    page,
  }) => {
    await loginTeacher(page);

    /*
     * Bài học `UX-UIUX-M18-008`: `question-actions.tsx` có combobox vô danh mức
     * **critical**, thuộc M16/M17 vừa đóng, mà spec hai module đó không bắt được
     * — vì `<Select>` nằm trong dialog và spec chỉ quét trang tĩnh.
     */
    await visit(page, "/teacher/exercises/question-bank", 1280);

    await expect(page.getByText(FIXTURE_TITLE)).toBeVisible();

    await page.getByRole("button", { name: "Thao tác câu hỏi" }).first().click();
    await page.getByRole("menuitem", { name: /Chia sẻ/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    /*
     * `toBeVisible()` trả về ngay khi phần tử hiện, KHÔNG chờ animation xong.
     * Dialog của Radix mở bằng `fade-in`, nên quét axe ngay lúc đó là đo màu
     * đang hoà dở: lần đầu chạy ra "contrast 4.45, nền #efefef" trong khi token
     * thật là `--muted-foreground: #5b6b80` trên nền trắng. Đó là **lỗi đo**,
     * không phải lỗi sản phẩm — chờ mọi animation dừng rồi mới đo.
     */
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    );

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      results.violations
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        )
        .join("\n"),
    ).toEqual([]);

    // Combobox trong dialog phải có tên gọi được (`UX-UIUX-M18-008`).
    await expect(
      dialog.getByRole("combobox", { name: /Giáo viên/ }),
    ).toBeVisible();
  });
});

test("M14 — đổi tab giữ nguyên trang, không nạp lại toàn bộ", async ({
  page,
}) => {
  await loginTeacher(page);
  await visit(page, `/teacher/classes/${CLASS_ID}`, 1280);

  /*
   * Ô gate còn mở của M14: "tốc độ đổi tab sau `DS-024` chưa đo". `DS-024` cho
   * M14 dùng `?tab=` thay vì state — đúng để chia sẻ link được, nhưng nếu mỗi
   * lần bấm tab là một lần điều hướng đầy đủ thì màn làm việc hằng ngày của
   * giáo viên trở nên chậm.
   *
   * Đo bằng cách đánh dấu vào `window`: nếu tài liệu bị thay mới thì dấu mất.
   */
  await page.evaluate(() => {
    (window as unknown as { __gateMark?: number }).__gateMark = Date.now();
  });

  const started = Date.now();
  await page.getByRole("tab", { name: "Học viên" }).click();
  await page.waitForURL(/tab=students/);
  await expect(
    page.getByRole("tab", { name: "Học viên" }),
  ).toHaveAttribute("aria-selected", "true");
  const elapsed = Date.now() - started;

  const survived = await page.evaluate(
    () => (window as unknown as { __gateMark?: number }).__gateMark !== undefined,
  );

  expect(
    survived,
    "đổi tab phải là điều hướng phía client, không nạp lại tài liệu",
  ).toBe(true);
  expect(elapsed, `đổi tab mất ${elapsed}ms`).toBeLessThan(5000);
});

test("M14 — danh sách lớp hiện đủ tên lớp ở 360px, không cắt cụt", async ({
  page,
}) => {
  await loginTeacher(page);
  await visit(page, "/teacher/classes", 360);

  /*
   * Bài học `UX-UIUX-M19-007`: `toContainText` đọc DOM nên vẫn xanh khi CSS cắt
   * chữ — phải đo bề rộng thật. Ở đây phần bị cắt đúng là hậu tố phân biệt hai
   * lớp cùng khóa ("(Lớp 02)" / "(Ban Giám đốc)"), tức là mất đúng thứ khiến
   * trang này có ích.
   */
  const names = page.getByRole("heading", { level: 2 });
  const total = await names.count();
  expect(total).toBeGreaterThan(0);

  const clipped: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const name = names.nth(i);
    if (await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1)) {
      clipped.push((await name.textContent())?.trim() ?? `lớp ${i}`);
    }
  }

  expect(clipped, `tên lớp bị cắt cụt: ${clipped.join(" | ")}`).toEqual([]);
});

test("M14 — dải 8 tab chi tiết lớp đọc được đủ nhãn ở 360px", async ({
  page,
}) => {
  await loginTeacher(page);
  await visit(page, `/teacher/classes/${CLASS_ID}`, 360);

  /*
   * Bài học `UX-UIUX-M19-007`: E2E xanh không thay thế được việc NHÌN. Nhãn bị
   * CSS cắt cụt thì `toContainText` vẫn xanh vì DOM đủ chữ. Đo bề rộng thật.
   */
  const tabs = page.getByRole("tab");
  const total = await tabs.count();
  expect(total).toBe(8);

  const clipped: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const tab = tabs.nth(i);
    const label = (await tab.textContent())?.trim() ?? `tab ${i}`;
    if (await tab.evaluate((el) => el.scrollWidth > el.clientWidth + 1)) {
      clipped.push(label);
    }
  }

  expect(clipped, `nhãn tab bị cắt chữ: ${clipped.join(", ")}`).toEqual([]);
});
