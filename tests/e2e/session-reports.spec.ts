import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

/**
 * `TEACHER-REPORT-1` — đo bằng TRÌNH DUYỆT THẬT.
 *
 * WORKLOG phiên trước đóng lại với đúng một món nợ: *"CHƯA ĐO BẰNG TRÌNH DUYỆT
 * THẬT — chưa mở 360/375/390/414px, chưa bấm thử luồng điểm danh → báo cáo →
 * gửi → giáo vụ xem → tải DOCX."* File này trả món nợ đó.
 *
 * Năm thứ được ghim, mỗi thứ vì một lý do đã có tiền sự trong repo:
 *
 *  1. **Cổng điểm danh ở CẢ HAI tầng nhìn thấy được** — danh sách nói "Chờ điểm
 *     danh", và gõ THẲNG URL biểu mẫu vẫn bị chặn. Tầng thứ ba (RPC) đã có
 *     pgTAP; ở đây đo hai tầng mà người dùng thật chạm vào.
 *
 *  2. **Ghé qua một mục KHÔNG biến nó thành đã điền** (`D-43` điểm 6). Mở mục 7
 *     rồi vuốt đi thì mục lục vẫn phải nói "Chưa điền".
 *
 *  3. **Chuyên cần chụp lại lúc gửi** — sửa điểm danh SAU khi ký không được làm
 *     đổi báo cáo đã gửi. Bài này sửa thật ở DB rồi tải lại trang giáo vụ.
 *
 *  4. **Tải DOCX** — bắt sự kiện tải thật, kiểm tên file, kích thước và chữ ký
 *     zip. Kiểm mỗi cái nút có tồn tại thì một trang lỗi 500 cũng lọt.
 *
 *  5. **Bốn bề rộng điện thoại** — và đo bằng PHÉP ĐO ĐÚNG. `UX-MOBILE-1` đã
 *     tốn một phiên vì `documentElement.scrollWidth - innerWidth` **vẫn là 0**
 *     khi cuộn ngang nằm TRONG khung con; phải đếm cả phần tử con có
 *     `scrollWidth > clientWidth` kèm `overflow-x: auto|scroll`.
 */

const DB = "supabase_db_Polymind_Chinese";
const PASSWORD = "Polymind@2026";

/** Bốn bề rộng điện thoại thật, đúng mốc `UX-MOBILE-1`/`UX-MOBILE-2` đã dùng. */
const PHONE_WIDTHS = [360, 375, 390, 414] as const;

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/**
 * Buổi để đo: buổi ĐÃ DẠY gần nhất của LOP-02 (lớp của gv.a) mà chưa bị huỷ.
 * Đọc từ DB chứ không chép cứng UUID — `db reset` sinh lại id mỗi lần.
 */
const SESSION_ID = sql(`
  select cs.id from public.class_sessions cs
  join public.classes c on c.id = cs.class_id
  where c.code = 'LOP-02' and cs.starts_at < now() and cs.status <> 'cancelled'
  order by cs.starts_at desc limit 1;
`);

const SESSION_NUMBER = sql(
  `select session_number from public.class_sessions where id = '${SESSION_ID}';`,
);

/** Hai học viên của LOP-02, thứ tự cố định theo tên để bài kiểm lặp lại được. */
const ROSTER = sql(`
  select string_agg(s.full_name, '|' order by s.full_name)
  from public.enrollments e
  join public.students s on s.id = e.student_id
  join public.classes c on c.id = e.class_id
  where c.code = 'LOP-02' and e.status in ('pending','active','paused');
`).split("|");

/**
 * Người vắng của kịch bản. `??` chứ không phải `!`: seed hụt một học viên thì
 * bài phải hỏng ở `beforeAll` với câu nói rõ lý do, không phải hỏng ở giữa
 * chừng với một locator rỗng khó truy.
 */
const ABSENT_STUDENT = ROSTER[1] ?? "";
const TOPIC = `Buổi ${SESSION_NUMBER} — Đàm phán lãi suất`;
const ABSENCE_REASON = "Ốm, có báo trước";

/**
 * Trả buổi về đúng trạng thái "vừa dạy xong, chưa ai đụng vào".
 *
 * ⚠️ Phải trả cả `class_sessions.status` về `scheduled`: gửi báo cáo gọi
 * `save_session_log(..., p_complete => true)` nên buổi chuyển sang `completed`.
 * Không trả lại thì lần chạy thứ hai đo một buổi đã hoàn tất — khác hình dạng.
 */
function purgeFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.session_report_students
      where report_id in (select id from public.session_reports where session_id = '${SESSION_ID}');
    delete from public.session_report_evidence
      where report_id in (select id from public.session_reports where session_id = '${SESSION_ID}');
    delete from public.session_reports where session_id = '${SESSION_ID}';
    delete from public.attendance_records where session_id = '${SESSION_ID}';
    update public.class_sessions
      set status = 'scheduled', lesson_id = null, lesson_log = null, completed_at = null
      where id = '${SESSION_ID}';
    set session_replication_role = origin;
  `);
}

async function login(page: Page, email: string) {
  // Xoá cookie trước: bài kiểm đổi vai giữa chừng (giáo viên → giáo vụ), mà vào
  // `/login` khi còn phiên cũ thì bị đá thẳng về dashboard của vai cũ.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/**
 * 🔴 PHÉP ĐO ĐÚNG, không phải phép đo tiện tay.
 *
 * `documentElement.scrollWidth - innerWidth` chỉ bắt được TRANG tràn. Một lưới
 * 1050px nằm trong `overflow-x-auto` thì con số đó vẫn là **0** trong khi người
 * dùng vẫn phải vuốt ngang — đúng cái bẫy `UX-MOBILE-1` ghi lại. Nên trả về cả
 * hai: tràn trang, và danh sách khung con thật sự cuộn ngang được.
 */
async function measureHorizontal(page: Page) {
  return page.evaluate(() => {
    const pageOverflow = document.documentElement.scrollWidth - window.innerWidth;

    const scrollers = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        if (el.scrollWidth <= el.clientWidth + 1) return false;
        const overflowX = getComputedStyle(el).overflowX;
        return overflowX === "auto" || overflowX === "scroll";
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}[${(el.getAttribute("class") ?? "").slice(0, 60)}] ${el.scrollWidth}>${el.clientWidth}`,
      );

    return { pageOverflow, scrollers };
  });
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const { pageOverflow, scrollers } = await measureHorizontal(page);
  expect(pageOverflow, `${label} — tràn ngang cả trang`).toBeLessThanOrEqual(1);
  expect(scrollers, `${label} — khung con cuộn ngang`).toEqual([]);
}

/** Điểm danh THẬT qua giao diện: 1 có mặt, 1 vắng. */
async function markAttendance(page: Page) {
  await page.goto(`/teacher/attendance?session=${SESSION_ID}`);
  await page.getByRole("button", { name: "Tất cả có mặt" }).click();
  await page
    .getByRole("group", { name: `Điểm danh ${ABSENT_STUDENT}` })
    .getByRole("button", { name: "Vắng" })
    .click();
  await page.getByRole("button", { name: "Lưu điểm danh" }).click();
  await expect
    .poll(
      () =>
        sql(
          `select count(*) from public.attendance_records where session_id = '${SESSION_ID}';`,
        ),
      { message: "điểm danh đã ghi vào DB" },
    )
    .toBe("2");
}

/** Thang 1–5: bám vào legend của chính fieldset đó, không đếm thứ tự DOM. */
function scale(page: Page, legend: string, option: string | RegExp) {
  return page
    .locator("fieldset")
    .filter({ hasText: legend })
    .getByRole("radio", { name: option });
}

/** Điền đủ 9 mục rồi tick xác nhận. KHÔNG bấm Gửi — để bài gọi tự quyết. */
async function fillReport(page: Page) {
  // --- Mục 1 -----------------------------------------------------------------
  await page.getByRole("radio", { name: "Offline" }).click();
  await page.locator("#topic").fill(TOPIC);

  // --- Mục 2: chỉ lý do vắng. KHÔNG có ô nào để gõ lại sĩ số (`D-43` điểm 2) --
  await page.getByLabel(`Lý do của ${ABSENT_STUDENT}`).fill(ABSENCE_REASON);

  // --- Mục 3 -----------------------------------------------------------------
  await page.locator("#lesson").click();
  await page.getByRole("option").first().click();
  await page.getByRole("radio", { name: "90–100%" }).click();
  await page.locator("#lesson-log").fill("Ôn từ vựng bài trước; luyện mẫu câu thương lượng.");

  // --- Mục 4 -----------------------------------------------------------------
  await scale(page, "4.1 Mức độ tiếp thu chung", /^4 — Tốt/).click();
  await scale(page, "4.2 Mức độ tương tác", /^4 — Tích cực/).click();
  await scale(page, "4.3 Mức độ tập trung", /^4 — Tốt/).click();
  await page.getByRole("radio", { name: "Trên 90%" }).click();

  // --- Mục 5: nói rõ "không có gì" mới được tính là xong (`D-43` điểm 5) -------
  await page
    .getByRole("checkbox", { name: "Không có học viên cần lưu ý trong buổi học này" })
    .click();

  // --- Mục 6: cũng phải trả lời rõ "Không", bỏ trống không phải câu trả lời ----
  await page
    .locator("fieldset")
    .filter({ hasText: "Buổi học có vấn đề phát sinh không?" })
    .getByRole("radio", { name: "Không", exact: true })
    .click();

  // --- Mục 7 -----------------------------------------------------------------
  await page.locator("#next-content").fill("Bài kế tiếp — hợp đồng tín dụng");

  // --- Mục 8: loại minh chứng KHÔNG đòi ảnh -----------------------------------
  await page.getByRole("checkbox", { name: "Tài liệu sử dụng trong buổi học" }).click();

  // --- Mục 9 -----------------------------------------------------------------
  await page.getByRole("radio", { name: /^Tốt — Đạt mục tiêu đề ra/ }).click();

  await page.getByRole("checkbox", { name: /^Tôi xác nhận thông tin báo cáo/ }).click();
}

async function submitReport(page: Page) {
  await page.getByRole("button", { name: "Gửi báo cáo" }).click();
  await expect(page.getByText(/Báo cáo đã gửi lúc/)).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(() => {
  expect(SESSION_ID, "tìm được buổi đã dạy của LOP-02").toMatch(/^[0-9a-f-]{36}$/);
  expect(ROSTER, "LOP-02 có đúng 2 học viên đang học").toHaveLength(2);
});

test.beforeEach(purgeFixture);
test.afterAll(purgeFixture);

test("điểm danh → báo cáo → gửi → giáo vụ xem → tải DOCX", async ({ page }) => {
  await login(page, "gv.a@polymind.test");

  // === 1. CỔNG ĐIỂM DANH — tầng danh sách ===================================
  await page.goto("/teacher/reports");
  await expect(
    page.getByRole("heading", { name: "Báo cáo buổi dạy", level: 1 }),
  ).toBeVisible();

  const row = page.locator("li").filter({ hasText: `Buổi ${SESSION_NUMBER}` }).first();
  await expect(row).toContainText("Chờ điểm danh");
  await expect(row).toContainText("mới điểm danh 0/2");
  await expect(row.getByRole("link", { name: "Điểm danh trước" })).toBeVisible();
  // Nút "Làm báo cáo" KHÔNG được xuất hiện khi chưa điểm danh xong.
  await expect(row.getByRole("link", { name: "Làm báo cáo" })).toHaveCount(0);

  // === 2. CỔNG ĐIỂM DANH — gõ THẲNG URL biểu mẫu ============================
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.getByText("Cần điểm danh xong trước khi làm báo cáo.")).toBeVisible();
  await expect(page.getByText("Buổi này mới điểm danh")).toContainText("0/2");
  // Biểu mẫu KHÔNG được dựng ra — không phải chỉ ẩn nút Gửi.
  await expect(page.getByRole("button", { name: "Gửi báo cáo" })).toHaveCount(0);
  await expect(page.locator('[data-section="1"]')).toHaveCount(0);
  // Ngõ cụt là lỗi (`UX-MOBILE-3`): phải có đường đi tiếp.
  await expect(page.getByRole("link", { name: "Đi điểm danh" })).toBeVisible();

  // === 3. Điểm danh thật rồi cổng mở ========================================
  await markAttendance(page);

  await page.goto("/teacher/reports");
  await expect(
    page
      .locator("li")
      .filter({ hasText: `Buổi ${SESSION_NUMBER}` })
      .first()
      .getByRole("link", { name: /Làm báo cáo|Viết tiếp/ }),
  ).toBeVisible();

  // === 4. Ghé qua một mục KHÔNG làm nó thành đã điền (`D-43` điểm 6) =========
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();

  const rail = page.getByRole("navigation", { name: "Mục lục báo cáo" });
  const section7Link = rail.getByRole("button").filter({ hasText: "Kế hoạch cho buổi học" });
  await section7Link.click();
  await expect(page.locator('[data-section="7"]')).toBeInViewport();
  // Đã cuộn tới nơi, đã là mục đang xem — mà trạng thái vẫn phải là "Chưa điền".
  await expect(section7Link.getByRole("img")).toHaveAttribute("aria-label", "Chưa điền");
  await expect(rail).toContainText("0/9");

  // Mục 2 lấy thẳng từ điểm danh — 1 có mặt, 1 vắng, không ô nào gõ lại số.
  const section2 = page.locator('[data-section="2"]');
  await expect(section2).toContainText("Lấy từ điểm danh");
  await expect(section2.getByText(ABSENT_STUDENT)).toBeVisible();

  // === 5. Điền + gửi ========================================================
  await fillReport(page);
  // Mục lục phải báo 9/9 TRƯỚC khi bấm gửi — cùng một luật với nút Gửi.
  await expect(rail).toContainText("9/9");
  await submitReport(page);

  // Sự thật ở DB, không tin chữ trên màn hình.
  expect(
    sql(`select status from public.session_reports where session_id = '${SESSION_ID}';`),
    "báo cáo đã ở trạng thái submitted",
  ).toBe("submitted");
  expect(
    sql(`
      select (attendance_snapshot->>'present') || '/' || (attendance_snapshot->>'absent')
        || '/' || (attendance_snapshot->>'roster_size')
      from public.session_reports where session_id = '${SESSION_ID}';
    `),
    "chuyên cần được chụp lại lúc gửi",
  ).toBe("1/1/2");
  // Gửi báo cáo = hoàn tất buổi, đi qua đúng `save_session_log` (`BUG_M10_01`).
  expect(
    sql(`select status from public.class_sessions where id = '${SESSION_ID}';`),
    "buổi chuyển sang hoàn tất qua đúng một đường ghi",
  ).toBe("completed");

  // === 6. Giáo vụ xem =======================================================
  const reportId = sql(
    `select id from public.session_reports where session_id = '${SESSION_ID}';`,
  );

  await login(page, "gv.vu@polymind.test");
  await page.goto("/admin/reports?tab=bao-cao-gv");
  await expect(page.getByRole("heading", { name: "Báo cáo", level: 1 })).toBeVisible();
  await expect(page.getByText(TOPIC).first()).toBeVisible();

  await page.goto(`/admin/reports/bao-cao/${reportId}`);
  await expect(
    page.getByRole("heading", { name: `Báo cáo · Buổi ${SESSION_NUMBER}`, level: 1 }),
  ).toBeVisible();
  // Đủ 9 mục, không thiếu mục nào.
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(9);
  await expect(page.getByText(ABSENCE_REASON)).toBeVisible();

  // === 7. Tải DOCX — bắt sự kiện tải THẬT ===================================
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.getByRole("link", { name: "Tải DOCX" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^bao-cao-buoi-day-\d{4}-\d{2}-\d{2}\.docx$/,
  );
  const file = await download.path();
  expect(statSync(file).size, "file DOCX không rỗng").toBeGreaterThan(4_000);
  // DOCX là zip — hai byte đầu phải là "PK".
  expect(readFileSync(file).subarray(0, 2).toString()).toBe("PK");

  // === 8. Sửa điểm danh SAU khi ký không được đổi báo cáo ====================
  sql(`
    update public.attendance_records set status = 'present', note = null
    where session_id = '${SESSION_ID}' and status = 'absent';
  `);
  expect(
    sql(
      `select count(*) from public.attendance_records where session_id = '${SESSION_ID}' and status = 'present';`,
    ),
    "đã sửa điểm danh thành 2 có mặt",
  ).toBe("2");

  await page.goto(`/admin/reports/bao-cao/${reportId}`);
  // Báo cáo vẫn nói 1 vắng và vẫn giữ nguyên lý do — đọc từ `attendance_snapshot`,
  // không đọc lại bảng điểm danh. Đây chính là vế (3) của `D-43`.
  await expect(page.getByText(ABSENCE_REASON)).toBeVisible();
  expect(
    sql(`
      select (attendance_snapshot->>'present') || '/' || (attendance_snapshot->>'absent')
      from public.session_reports where session_id = '${SESSION_ID}';
    `),
    "ảnh chụp chuyên cần KHÔNG đổi sau khi sửa điểm danh",
  ).toBe("1/1");
});

/**
 * Mục lục dính KHÔNG được nằm sau header.
 *
 * User báo kèm ảnh 2026-08-13: *"thanh các mục bên trái có đi theo khi cuộn
 * xuống nhưng bị che mất mục 1"*. Header dashboard là `sticky top-0 z-30 h-16`
 * (64px), còn cột mục lục dính ở `top-4` (16px) ⇒ nó trượt xuống DƯỚI header và
 * ăn mất đúng một dòng — dòng đầu tiên.
 *
 * Bài này đo HÌNH HỌC THẬT sau khi cuộn, không kiểm tên class: đổi class mà
 * nhìn vẫn bị che thì bài vẫn phải đỏ.
 */
test("mục lục dính không bị header che mất mục 1", async ({ page }) => {
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();

  const headerBottom = await page.evaluate(() => {
    const header = document.querySelector("header");
    return header ? header.getBoundingClientRect().bottom : 0;
  });
  expect(headerBottom, "header dashboard đang dính ở đỉnh màn").toBeGreaterThan(0);

  // Cuộn đủ sâu để cột mục lục vào trạng thái dính.
  await page.locator('[data-section="8"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-section="8"]')).toBeInViewport();

  const rail = page.getByRole("navigation", { name: "Mục lục báo cáo" });
  const railBox = await rail.boundingBox();
  expect(railBox, "cột mục lục có mặt ở màn rộng").not.toBeNull();
  expect(
    railBox!.y,
    `đỉnh cột mục lục (${railBox!.y}px) phải nằm DƯỚI đáy header (${headerBottom}px)`,
  ).toBeGreaterThanOrEqual(headerBottom);

  // Và mục 1 — dòng đầu tiên — phải thật sự nhìn thấy được, không bị cắt.
  const firstItem = rail.getByRole("button").first();
  await expect(firstItem).toContainText("Thông tin buổi học");
  const itemBox = await firstItem.boundingBox();
  expect(
    itemBox!.y,
    `mục 1 (${itemBox!.y}px) không được nằm sau header (${headerBottom}px)`,
  ).toBeGreaterThanOrEqual(headerBottom);

  // Bản di động: thanh chọn mục cũng dính, cũng không được lọt sau header.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/teacher/reports/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-section="1"]')).toBeVisible();
  await page.locator('[data-section="8"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-section="8"]')).toBeInViewport();

  const pickerBox = await page.locator('[data-slot="report-section-picker"]').boundingBox();
  expect(
    pickerBox!.y,
    `thanh chọn mục (${pickerBox!.y}px) không được nằm sau header (${headerBottom}px)`,
  ).toBeGreaterThanOrEqual(headerBottom);
});

/**
 * Bốn bề rộng điện thoại × bốn màn của tính năng này.
 *
 * Chạy trên một báo cáo ĐÃ GỬI để bản xem của giáo vụ có nội dung thật — đo một
 * biểu mẫu rỗng thì phần lớn bề mặt chưa được dựng ra, đúng lỗ hổng fixture của
 * `UX-MOBILE-2`.
 */
test("bốn bề rộng điện thoại: không màn nào phải vuốt ngang", async ({ page }) => {
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();

  for (const width of PHONE_WIDTHS) {
    await page.setViewportSize({ width, height: 800 });

    await page.goto("/teacher/reports", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Báo cáo buổi dạy", level: 1 }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `hàng đợi báo cáo @${width}px`);

    await page.goto(`/teacher/reports/${SESSION_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-section="1"]')).toBeVisible();
    await expectNoHorizontalScroll(page, `biểu mẫu báo cáo @${width}px`);

    // Bảng trượt mục lục MỞ — `UX-MOBILE-2` cho thấy Radix khoá cuộn body có
    // thể bóp bố cục trên một trang vốn đã tràn, nên phải đo cả lúc mở.
    await page.locator('[data-slot="report-section-picker"]').click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoHorizontalScroll(page, `mục lục báo cáo MỞ @${width}px`);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  // Gửi ở bề rộng điện thoại — đây là ca dùng thật: giáo viên bấm gửi trên máy.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await fillReport(page);
  await submitReport(page);
  const reportId = sql(
    `select id from public.session_reports where session_id = '${SESSION_ID}';`,
  );

  await login(page, "gv.vu@polymind.test");
  for (const width of PHONE_WIDTHS) {
    await page.setViewportSize({ width, height: 800 });

    await page.goto("/admin/reports?tab=bao-cao-gv", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Báo cáo", level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page, `bảng giáo vụ @${width}px`);

    await page.goto(`/admin/reports/bao-cao/${reportId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: `Báo cáo · Buổi ${SESSION_NUMBER}`, level: 1 }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, `bản xem báo cáo @${width}px`);
  }
});
