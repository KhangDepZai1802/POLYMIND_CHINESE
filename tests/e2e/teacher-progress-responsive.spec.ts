import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P17-T4` / UIUX-M19 — màn Báo cáo lớp của giáo viên.
 *
 * Cùng tinh thần M16/M17/M18 (`DS-031`): công cụ làm việc, giữ token dùng chung,
 * không áp Learning Journey Bento.
 *
 * Đặc thù của M19: đây là màn **đọc số** duy nhất của giáo viên, và theo `DS-037`
 * nó **không có** export lẫn bộ lọc thời gian — chỉ chọn lớp. Vì vậy bài kiểm tập
 * trung vào: đọc được số (cỡ chữ, tương phản), đi được bằng bàn phím (vùng bảng
 * cuộn ngang), và biểu đồ mới không được trở thành thứ chỉ người sáng mắt hiểu.
 *
 * Fixture cố ý tạo **tương phản tối đa**: một học viên có mặt cả 2 buổi (100%),
 * một học viên vắng cả 2 buổi (0%). Nhờ vậy biểu đồ xếp hạng chứng minh được nó
 * thật sự xếp hạng, chứ không phải vẽ hai thanh bằng nhau rồi bảo là đúng.
 */

const DB = "supabase_db_Polymind_Chinese";
const TEACHER_USER_ID = "22222222-2222-2222-2222-222222222221";
/*
 * Tra theo MÃ LỚP chứ không hard-code UUID. `seed.sql` insert `public.classes`
 * mà KHÔNG chỉ định `id`, nên UUID sinh mới sau **mỗi lần `db reset`** — bản cũ
 * ghim '7dd9b79a-997b-4c14-a627-2165422eaccc' nên chỉ chạy được trên DB
 * chưa reset, reset xong là cả file không nạp nổi (`P17-T5`). `code` là khóa
 * nghiệp vụ ổn định, seed luôn tạo 'LOP-02'.
 */
const CLASS_ID = sql(`select id from public.classes where code = 'LOP-02';`);

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;

function sql(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      DB,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-A",
      "-t",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}

/** Điểm danh do fixture tạo ra được đánh dấu bằng `note` để dọn đúng phần mình. */
const FIXTURE_NOTE = "E2E UIUX M19";

function purgeFixture() {
  sql(`delete from public.attendance_records where note = '${FIXTURE_NOTE}';`);
}

/**
 * Hai học viên của lớp, sắp xếp theo tên để lấy ra ổn định giữa các lần chạy.
 * Trả về `[mặt đủ, vắng hết]`.
 */
function fixtureStudents() {
  const raw = sql(`
    select e.id || '~' || s.full_name
    from public.enrollments e
    join public.students s on s.id = e.student_id
    where e.class_id = '${CLASS_ID}'
      and e.status not in ('withdrawn', 'transferred')
    order by s.full_name;
  `);
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("~");
      return {
        id: line.slice(0, separator),
        fullName: line.slice(separator + 1),
      };
    });
}

const students = fixtureStudents();

/*
 * Fixture đứng hay đổ phụ thuộc vào lớp có đúng 2 học viên. Nếu seed đổi mà bài
 * kiểm im lặng chạy tiếp thì nó sẽ đo nhầm chứ không báo lỗi — kiểm ngay ở đây.
 */
if (students.length < 2) {
  throw new Error(
    `Lớp fixture phải có ít nhất 2 học viên đang học, hiện có ${students.length}.`,
  );
}
const best = students[0]!;
const worst = students[1]!;

function setupFixture() {
  purgeFixture();
  sql(`
    insert into public.attendance_records (session_id, enrollment_id, status, marked_by, note)
    select s.id, '${best.id}', 'present', '${TEACHER_USER_ID}', '${FIXTURE_NOTE}'
    from public.class_sessions s
    where s.class_id = '${CLASS_ID}'
      and s.status in ('completed', 'scheduled')
      and s.starts_at <= now();

    insert into public.attendance_records (session_id, enrollment_id, status, marked_by, note)
    select s.id, '${worst.id}', 'absent', '${TEACHER_USER_ID}', '${FIXTURE_NOTE}'
    from public.class_sessions s
    where s.class_id = '${CLASS_ID}'
      and s.status in ('completed', 'scheduled')
      and s.starts_at <= now();
  `);
}

async function loginTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.a@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
}

async function gotoReport(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/teacher/progress?class=${CLASS_ID}`, {
    waitUntil: "domcontentloaded",
  });
}

async function expectAccessibleAndContained(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label}: tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, label).toEqual([]);
}

test.beforeAll(setupFixture);
test.afterAll(purgeFixture);

test("Báo cáo lớp sạch axe và không tràn ngang", async ({ page }) => {
  await loginTeacher(page);

  for (const width of [360, 768, 1280]) {
    await gotoReport(page, width);
    await expect(
      page.getByRole("heading", { name: "Báo cáo lớp", level: 1 }),
    ).toBeVisible();
    await expectAccessibleAndContained(page, `bao-cao@${width}`);

    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m19-${width}.png`,
        fullPage: true,
      });
    }
  }
});

test("Báo cáo lớp không tràn ngang ở cả sáu bề rộng", async ({ page }) => {
  await loginTeacher(page);

  for (const width of WIDTH_LADDER) {
    await gotoReport(page, width);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `@ ${width}px tràn ngang ${overflow}px`).toBeLessThanOrEqual(
      1,
    );
  }
});

test("Trang có heading thật cho từng khối, không chỉ mỗi h1", async ({
  page,
}) => {
  await loginTeacher(page);
  await gotoReport(page);

  /*
   * Trước `P17-T4`, `CardTitle` render `<div>` nên cả trang chỉ có ĐÚNG MỘT
   * heading (h1 của `PageHeader`). Người dùng trình đọc màn hình không nhảy được
   * giữa các khối mà phải cuộn tuần tự qua toàn bộ bảng.
   */
  await expect(
    page.getByRole("heading", { name: "Chuyên cần theo học viên", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Học viên cần chú ý/, level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chi tiết từng học viên", level: 2 }),
  ).toBeVisible();
});

test("Vùng bảng cuộn ngang đi được bằng bàn phím", async ({ page }) => {
  await loginTeacher(page);
  await gotoReport(page, 360);

  /*
   * Tiền lệ `UX-UIUX-M21-009`: một vùng cuộn ngang mà không focus được thì người
   * dùng bàn phím không bao giờ tới được các cột bên phải. Bảng này có 7 cột nên
   * ở 360px chắc chắn phải cuộn.
   */
  const scroller = page.locator('[data-slot="table-scroller"]');
  await expect(scroller).toHaveAttribute("tabindex", "0");

  const name = await scroller.getAttribute("aria-label");
  expect(name, "vùng cuộn phải có tên gọi được").toBeTruthy();

  /*
   * Phải chờ vùng cuộn hiện ra RỒI mới đo. Đo ngay sau `domcontentloaded` có
   * lần trả về `scrollWidth: 0, clientWidth: 0` vì trình duyệt chưa bố trí xong
   * — đó là bài kiểm sai chứ không phải sản phẩm sai, và nó "đỏ" một cách ngẫu
   * nhiên nên còn tệ hơn là không có bài kiểm.
   */
  await expect(scroller).toBeVisible();

  const measured = await scroller.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    measured.scrollWidth,
    `ở 360px bảng 7 cột phải thật sự cuộn ngang — đo được ${JSON.stringify(measured)}`,
  ).toBeGreaterThan(measured.clientWidth);
});

test("Bảng số liệu có caption và scope cho mọi ô tiêu đề", async ({ page }) => {
  await loginTeacher(page);
  await gotoReport(page);

  await expect(page.locator("table caption")).toHaveCount(1);

  const headers = page.locator("table thead th");
  const total = await headers.count();
  expect(total).toBeGreaterThan(0);
  for (let index = 0; index < total; index += 1) {
    await expect(headers.nth(index)).toHaveAttribute("scope", "col");
  }
});

test("Số liệu học viên cần chú ý không bị thu nhỏ còn 12px", async ({
  page,
}) => {
  await loginTeacher(page);
  await gotoReport(page);

  const meta = page
    .getByRole("listitem")
    .filter({ hasText: "Tỉ lệ chuyên cần" })
    .first()
    .locator("p")
    .nth(1);
  const fontSize = await meta.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).fontSize),
  );
  expect(
    fontSize,
    "lý do cảnh báo và số liệu học viên yếu phải ≥ 14px",
  ).toBeGreaterThanOrEqual(14);
});

test("Biểu đồ chuyên cần xếp hạng đúng và đọc được không cần nhìn màu", async ({
  page,
}) => {
  await loginTeacher(page);
  await gotoReport(page);

  const chart = page.getByRole("img", { name: /Chuyên cần theo học viên/ });
  await expect(chart).toBeVisible();

  /*
   * Biểu đồ phải TỰ NÓI RA con số, không để màu/độ dài thanh là kênh duy nhất
   * (`color-not-only`, `direct-labeling`). Fixture: một em 100%, một em 0%.
   */
  const rows = page.locator('[data-slot="attendance-bar"]');
  await expect(rows).toHaveCount(students.length);

  await expect(rows.first()).toContainText(worst.fullName);
  await expect(rows.first()).toContainText("0%");
  await expect(rows.last()).toContainText(best.fullName);
  await expect(rows.last()).toContainText("100%");

  /*
   * Xếp tăng dần: em yếu nhất nằm TRÊN CÙNG. Đây là toàn bộ lý do biểu đồ này
   * tồn tại — bảng bên dưới xếp theo tên nên không trả lời được "ai đang đuối
   * nhất". Đo bằng toạ độ thật chứ không tin thứ tự DOM.
   */
  const firstBox = await rows.first().boundingBox();
  const lastBox = await rows.last().boundingBox();
  expect(firstBox!.y).toBeLessThan(lastBox!.y);

  /*
   * Nhãn "Cần chú ý" phải hiện ĐỦ CHỮ. Ảnh chụp 1280px lần đầu cho ra
   * "· Cần ch…" vì cả cụm nằm chung một phần tử `truncate` — mà đây đúng là chữ
   * đóng vai trò thay thế cho màu, cắt nó đi là mất luôn kênh thông tin không
   * phụ thuộc màu. `toContainText` không bắt được lỗi này vì DOM vẫn đủ chữ,
   * nên phải đo bề rộng thật.
   */
  const marker = page.getByText("Cần chú ý").first();
  await expect(marker).toBeVisible();
  const clipped = await marker.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
  expect(clipped, "nhãn 'Cần chú ý' bị cắt chữ").toBe(false);

  // Bảng đầy đủ vẫn còn nguyên làm bản thay thế đọc được cho biểu đồ.
  await expect(page.locator("table")).toBeVisible();
});

test("Nút Ghi nhận xét của từng học viên có tên gọi được riêng", async ({
  page,
}) => {
  await loginTeacher(page);
  await gotoReport(page);

  /*
   * Cùng loại lỗi đã sửa ở M18: nhiều nút trùng tên thì trình đọc màn hình liệt
   * kê ra một loạt "Ghi nhận xét" không phân biệt được của em nào.
   */
  await expect(
    page.getByRole("link", { name: "Ghi nhận xét", exact: true }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("link", { name: `Ghi nhận xét ${worst.fullName}` }),
  ).toBeVisible();
});
