import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";
import sharp from "sharp";

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
/** `TEACHER-REPORT-2` — chữ giáo viên tự gõ ở mục 3, không tra giáo trình. */
const LESSON_TITLE = "Bài 11 — Đàm phán lãi suất vay doanh nghiệp";

/**
 * Ảnh minh chứng của bài kiểm mục 8 (`TEACHER-REPORT-3`).
 *
 * 🔴 **1400px là con số CÓ Ý NGHĨA, đừng thu nhỏ cho nhanh.** Cạnh dài vượt
 * `FLASHCARD_IMAGE_MAX_EDGE` (1280) nên bộ nén ở trình duyệt buộc phải chạy, và
 * nó mã hoá ra **WebP** — đúng thứ mà một tấm ảnh chụp bảng từ điện thoại sẽ
 * thành sau khi tải lên. WebP chính là gốc của lỗi user báo: `docx` KHÔNG nhận
 * định dạng đó, nên nhét thẳng vào là file Word ra ô ảnh vỡ.
 *
 * Ảnh 8×8 thì đi thẳng không qua nén, vẫn là PNG, và bài kiểm sẽ xanh mà **bỏ
 * lọt đúng đường code hỏng**.
 */
const EVIDENCE_FILE_STEM = "bang-giang";
const EVIDENCE_FILE_NAME = `${EVIDENCE_FILE_STEM}.png`;

/** Ảnh thật, giải mã được — `createImageBitmap` của trình duyệt đọc nó. */
async function evidencePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1400,
      height: 1000,
      channels: 3,
      background: { r: 15, g: 90, b: 168 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * Trả buổi về đúng trạng thái "vừa dạy xong, chưa ai đụng vào".
 *
 * ⚠️ Phải trả cả `class_sessions.status` về `scheduled`: gửi báo cáo gọi
 * `save_session_log(..., p_complete => true)` nên buổi chuyển sang `completed`.
 * Không trả lại thì lần chạy thứ hai đo một buổi đã hoàn tất — khác hình dạng.
 *
 * 🔴 Và phải trả cả BA CỘT CỜ MIỄN BÁO CÁO (`TEACHER-REPORT-5`). Bản đầu của hàm
 * này không dọn chúng, nên một lượt chạy hỏng giữa chừng để buổi ở trạng thái
 * *"không cần báo cáo"* và làm **đỏ hai bài khác** ở lượt sau — với câu lỗi
 * *"không thấy nút Làm báo cáo"*, chẳng liên quan gì tới chỗ thật sự sai. Luật:
 * fixture phải trả lại MỌI cột nó chạm vào, kể cả cột do một bài khác ghi.
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
      set status = 'scheduled', lesson_id = null, lesson_log = null, completed_at = null,
          report_waived_at = null, report_waived_by = null, report_waive_reason = null
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

/**
 * Điền đủ 9 mục rồi tick xác nhận. KHÔNG bấm Gửi — để bài gọi tự quyết.
 *
 * `absenceReason: false` bỏ trống ô lý do vắng — dùng cho bài ghim
 * `TEACHER-REPORT-3`.
 */
async function fillReport(page: Page, { absenceReason = true } = {}) {
  // --- Mục 1 -----------------------------------------------------------------
  await page.getByRole("radio", { name: "Offline" }).click();
  await page.locator("#topic").fill(TOPIC);

  // --- Mục 2: chỉ lý do vắng, và lý do là TUỲ CHỌN (`TEACHER-REPORT-3`).
  // KHÔNG có ô nào để gõ lại sĩ số (`D-43` điểm 2).
  if (absenceReason) {
    await page.getByLabel(`Lý do của ${ABSENT_STUDENT}`).fill(ABSENCE_REASON);
  }

  // --- Mục 3 -----------------------------------------------------------------
  // `TEACHER-REPORT-2`: ô gõ tay, KHÔNG còn dropdown tra giáo trình. Đây là
  // chỗ từng khoá cứng nút Gửi khi khoá học chưa nhập bài học nào.
  await page.locator("#lesson-title").fill(LESSON_TITLE);
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

/**
 * Bấm Gửi và NÓI RÕ vì sao hỏng.
 *
 * Bản đầu chỉ `expect(…/Báo cáo đã gửi lúc/).toBeVisible()`, nên mọi kiểu hỏng
 * đều ra cùng một câu *"element(s) not found"* — không phân biệt được "biểu mẫu
 * còn thiếu mục" với "RPC ném lỗi". Hai đường hỏng đó có hai chỗ sửa khác hẳn
 * nhau, nên bài kiểm phải phân biệt được.
 */
async function submitReport(page: Page) {
  await page.getByRole("button", { name: "Gửi báo cáo" }).click();

  const missingDialog = page.getByRole("dialog").filter({ hasText: "Chưa gửi được" });
  const locked = page.getByText(/Báo cáo đã gửi lúc/);
  const toast = page.locator("[data-sonner-toast]");

  await expect
    .poll(
      async () => {
        if (await locked.isVisible().catch(() => false)) return "sent";
        if (await missingDialog.isVisible().catch(() => false)) {
          return `THIẾU MỤC: ${await missingDialog.innerText()}`;
        }
        if (await toast.first().isVisible().catch(() => false)) {
          const text = await toast.first().innerText();
          if (!/Đã gửi báo cáo/.test(text)) return `LỖI: ${text}`;
        }
        const dbStatus = sql(`
          select coalesce(status::text,'?') || ' | lesson_title=' || coalesce(lesson_title,'NULL')
            || ' | confirmed=' || confirmed
            || ' | att_done=' || app.session_attendance_complete(session_id)
          from public.session_reports where session_id = '${SESSION_ID}';
        `);
        return `chờ (DB=${dbStatus || "chưa có hàng"})`;
      },
      { timeout: 30_000, message: "kết quả bấm Gửi báo cáo" },
    )
    .toBe("sent");
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
  // `1/9` chứ không phải `0/9`: mục 2 xanh sẵn vì nó KHÔNG có ô nào để giáo viên
  // điền — số liệu đọc thẳng từ điểm danh và lý do vắng là tuỳ chọn
  // (`TEACHER-REPORT-3`). Tám mục còn lại vẫn phải trắng.
  await expect(rail).toContainText("1/9");

  /*
   * 🔴 `TEACHER-REPORT-2` — mục 3 KHÔNG còn phụ thuộc giáo trình.
   *
   * Bản đầu là dropdown tra bảng `lessons`; khoá chưa nhập giáo trình thì ô đó
   * chỉ hiện được câu *"Khóa học chưa có bài học"* và `lesson_id` không bao giờ
   * set được ⇒ mục 3 mãi "chưa xong" ⇒ nút Gửi bị chặn vĩnh viễn (user gặp trên
   * production 2026-08-13). Bài này ghim: ô là INPUT gõ tay, và câu chặn cũ
   * KHÔNG được xuất hiện dù dữ liệu giáo trình có hay không.
   */
  const section3 = page.locator('[data-section="3"]');
  await expect(section3.locator("#lesson-title")).toBeEditable();
  await expect(section3.getByRole("combobox")).toHaveCount(0);
  await expect(
    page.getByText("Khóa học chưa có bài học", { exact: false }),
  ).toHaveCount(0);

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
  // Chữ gõ tay ở mục 3 đi trọn vòng: RPC `save_session_report` ghi vào cột mới.
  expect(
    sql(
      `select lesson_title from public.session_reports where session_id = '${SESSION_ID}';`,
    ),
    "lesson_title lưu đúng chữ giáo viên gõ",
  ).toBe(LESSON_TITLE);
  // Và KHÔNG lén ghi vào cột liên kết giáo trình.
  expect(
    sql(`select coalesce(lesson_id::text, 'null') from public.class_sessions where id = '${SESSION_ID}';`),
    "biểu mẫu báo cáo không ghi vào class_sessions.lesson_id",
  ).toBe("null");

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
  /*
   * Đủ 9 mục, không thiếu mục nào — CỘNG khối XÁC NHẬN = 10 tiêu đề.
   *
   * 🔴 Con số này từng là 9 và bài kiểm đỏ khi `TEACHER-REPORT-5` tách bản in ra
   * `SessionReportPrintable`: hoá ra bản in TỪNG THIẾU khối XÁC NHẬN trong khi
   * bản DOCX vẫn có nó — một lỗ thật của "một nguồn cho ba bề mặt", chỉ lộ ra
   * lúc gom hai bản in về một component. Ghim cả tên khối để lần sau ai bỏ nó đi
   * thì bài đỏ với câu nói rõ thiếu cái gì, không phải chỉ ra một con số lệch.
   */
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(10);
  await expect(page.getByRole("heading", { name: "XÁC NHẬN", level: 2 })).toBeVisible();
  await expect(page.getByText(ABSENCE_REASON)).toBeVisible();
  // Bản xem của giáo vụ đọc đúng chữ giáo viên gõ, không tra lại bảng `lessons`.
  await expect(page.getByText(LESSON_TITLE)).toBeVisible();

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
 * 🔴 `TEACHER-REPORT-3`, vế 1 — user báo 2026-08-14: *"phần 2 chuyên cần học
 * viên, vắng không cần phải có lí do, đừng ràng buộc cái này dẫn đến không thể
 * gửi báo cáo"*.
 *
 * Bài này điền đủ tám mục còn lại nhưng **để trống hẳn ô lý do**, rồi bấm Gửi
 * bằng trình duyệt thật. Nó đỏ ngay nếu ai đó nối lại mục 2 với lý do vắng —
 * kể cả khi nối ở tầng giao diện chứ không ở `domain/completion.ts`.
 */
test("bỏ trống lý do vắng vẫn gửi được báo cáo", async ({ page }) => {
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();

  // Ô lý do CÓ mặt (giáo viên vẫn ghi được khi biết) nhưng nhãn nói rõ là tuỳ
  // chọn — hệ quả phải được nói TRƯỚC khi người dùng loay hoay đi tìm.
  const section2 = page.locator('[data-section="2"]');
  await expect(section2).toContainText("không bắt buộc");
  await expect(page.getByLabel(`Lý do của ${ABSENT_STUDENT}`)).toHaveValue("");

  await fillReport(page, { absenceReason: false });

  // Mục lục phải báo 9/9 dù ô lý do trống — cùng luật với nút Gửi (`D-43` điểm 6).
  await expect(page.getByRole("navigation", { name: "Mục lục báo cáo" })).toContainText(
    "9/9",
  );
  await submitReport(page);

  expect(
    sql(`select status from public.session_reports where session_id = '${SESSION_ID}';`),
    "gửi được dù không có lý do vắng nào",
  ).toBe("submitted");
  // Và ghi chú điểm danh vẫn trống — không có chỗ nào tự bịa một lý do vào hồ sơ.
  expect(
    sql(`
      select count(*) from public.attendance_records
      where session_id = '${SESSION_ID}' and coalesce(btrim(note), '') <> '';
    `),
    "không lý do nào bị bịa ra để lách cổng",
  ).toBe("0");
});

/**
 * 🔴 `TEACHER-REPORT-3`, vế 2 — user báo 2026-08-14: *"phần 8 minh chứng buổi
 * học khi xuất file docx hay in báo cáo ra không hiển thị 3 tệp đính kèm mà giáo
 * viên đã gửi lên"*.
 *
 * Bài này tải ảnh THẬT lên qua giao diện rồi đo hai bề mặt user nhắc tới:
 *
 *  • bản của giáo vụ (cũng chính là bản in) — `<img>` phải **tải được thật**,
 *    đo bằng `naturalWidth > 0` chứ không phải "thẻ img có tồn tại": URL ký hỏng
 *    thì thẻ vẫn còn đó mà ô ảnh trống trơn;
 *  • file DOCX — mở zip ra đếm `word/media`. Đây là chỗ lỗi gốc nằm.
 */
test("mục 8: ảnh minh chứng có thật trong bản của giáo vụ và trong file DOCX", async ({
  page,
}) => {
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();

  await fillReport(page);
  // Ảnh chỉ gắn được vào một bản nháp ĐÃ tồn tại (`attachReportEvidenceAction`),
  // nên phải đợi lượt tự lưu chạy xong trước khi tải lên.
  await expect(page.getByText(/Đã lưu nháp/)).toBeVisible({ timeout: 15_000 });

  const section8 = page.locator('[data-section="8"]');
  await section8.locator('input[type="file"][multiple]').setInputFiles({
    name: EVIDENCE_FILE_NAME,
    mimeType: "image/png",
    buffer: await evidencePng(),
  });

  /*
   * 🔴 Ô ảnh phải hiện NGAY, không đợi tải lại trang.
   *
   * Đây là chỗ bài kiểm này bắt được một lỗi thật lúc viết: danh sách ảnh từng
   * là `useState(data.report.evidence)`, mà `router.refresh()` cố ý giữ nguyên
   * state của Client Component ⇒ ảnh nằm sẵn trong bucket còn màn hình vẫn báo
   * "0/4 ảnh". Tên hiện ra cũng phải là tên tệp gốc, không phải chuỗi uuid.
   */
  await expect(section8.getByText(EVIDENCE_FILE_STEM)).toBeVisible({ timeout: 20_000 });
  await expect(section8).toContainText("1/4 ảnh");

  const storedPath = await expect
    .poll(
      () => sql(`
        select coalesce(max(ev.storage_path), 'chưa có') from public.session_report_evidence ev
        join public.session_reports r on r.id = ev.report_id
        where r.session_id = '${SESSION_ID}';
      `),
      { message: "hàng minh chứng đã ghi vào DB" },
    )
    .not.toBe("chưa có")
    .then(() =>
      sql(`
        select ev.storage_path from public.session_report_evidence ev
        join public.session_reports r on r.id = ev.report_id
        where r.session_id = '${SESSION_ID}';
      `),
    );

  // 🔴 Vế quan trọng nhất của fixture: bộ nén ở trình duyệt đã đổi PNG → WebP.
  // Nếu một ngày nào đó nó thôi đổi, bài kiểm dưới đây không còn canh đúng lỗi
  // gốc nữa — nên phải đỏ ở ĐÂY chứ không âm thầm xanh.
  expect(storedPath, "ảnh tải lên là WebP — đúng định dạng docx KHÔNG nhận").toMatch(
    /\.webp$/,
  );

  await submitReport(page);

  const reportId = sql(
    `select id from public.session_reports where session_id = '${SESSION_ID}';`,
  );

  // === Bản của giáo vụ = bản in ==============================================
  await login(page, "gv.vu@polymind.test");
  await page.goto(`/admin/reports/bao-cao/${reportId}`);

  const shot = page.locator("[data-report-evidence] img");
  await expect(shot).toHaveCount(1);
  await expect
    .poll(
      () => shot.first().evaluate((img: HTMLImageElement) => img.naturalWidth),
      { message: "ảnh minh chứng tải được thật, không phải ô trống" },
    )
    .toBeGreaterThan(0);
  await expect(page.locator("[data-report-evidence]")).toContainText(EVIDENCE_FILE_STEM);
  // Và dòng chữ của mục 8 nêu đích danh tệp, không chỉ đếm.
  await expect(page.getByText(/1 tệp đính kèm/)).toBeVisible();

  // === BẢN IN — user nói rõ "in báo cáo ra", không phải chỉ xem trên màn =====
  //
  // Đo bằng `emulateMedia({ media: "print" })` để `@media print` thật sự có hiệu
  // lực: một quy tắc in sai (ẩn ảnh, hoặc để ảnh cao hơn một trang A4) chỉ lộ ra
  // ở đây, còn bản trên màn hình vẫn đẹp như thường.
  await page.emulateMedia({ media: "print" });
  await expect(shot).toBeVisible();
  const printBox = await shot.first().boundingBox();
  expect(printBox!.height, "ảnh minh chứng có mặt trên bản in").toBeGreaterThan(0);
  // Trần 8cm ≈ 302px @96dpi — không có trần thì một tấm ảnh dọc chiếm trọn trang.
  expect(printBox!.height, "ảnh không chiếm trọn một trang giấy").toBeLessThanOrEqual(
    310,
  );
  // Và phần chrome của dashboard phải biến mất khỏi bản in.
  await expect(page.getByRole("link", { name: "Tải DOCX" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // === File DOCX =============================================================
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.getByRole("link", { name: "Tải DOCX" }).click(),
  ]);

  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const media = Object.entries(zip.files).filter(
    ([name, entry]) => !entry.dir && name.startsWith("word/media/"),
  );
  expect(media, "ảnh minh chứng nằm THẬT trong file Word").toHaveLength(1);

  // Và nó là ảnh Word ĐỌC ĐƯỢC, không phải WebP đổi tên: đọc ngược header bằng
  // sharp. Kiểm mỗi "có một tệp trong word/media" thì một buffer rác cũng lọt.
  const embedded = await sharp(await zip.files[media[0]![0]]!.async("nodebuffer"))
    .metadata();
  expect(
    ["jpeg", "png"],
    `ảnh nhúng phải là định dạng docx nhận, đang là ${embedded.format}`,
  ).toContain(embedded.format);
  expect(embedded.width, "ảnh nhúng còn nguyên nội dung, không phải 1px").toBeGreaterThan(
    100,
  );
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

// =============================================================================
// `TEACHER-REPORT-5` (user báo kèm 4 ảnh 2026-08-17)
// =============================================================================

/**
 * Ngày buổi đang đo, theo giờ VN, dạng `dd-MM-yyyy` — đúng đoạn ngày mà tên file
 * PDF phải có. Lấy từ DB bằng `at time zone` chứ không tính lại trong JS: mốc
 * `starts_at` là UTC, và cả `TEACHER-REPORT-4b` lẫn bài unit của `file-name.ts`
 * đều sinh ra từ đúng chỗ dễ lệch một ngày này.
 */
const SESSION_DAY_VN = sql(`
  select to_char(starts_at at time zone 'Asia/Ho_Chi_Minh', 'DD-MM-YYYY')
  from public.class_sessions where id = '${SESSION_ID}';
`);

const EXPECTED_PDF_STEM = `LOP-02_Buoi-${SESSION_NUMBER}_${SESSION_DAY_VN}`;

type PrintCall = { title: string; imagesTotal: number; imagesComplete: number };

/**
 * Bắt `window.print()` thay vì để nó mở hộp thoại thật.
 *
 * 🔴 Playwright KHÔNG điều khiển được hộp thoại In của hệ điều hành, nên đây là
 * cách duy nhất đo được thứ thật sự quan trọng: **`document.title` tại đúng thời
 * điểm `print()` được gọi** (Chrome/Edge/Firefox lấy chính chuỗi đó làm tên file
 * gợi ý rồi thêm `.pdf`), và **ảnh mục 8 đã tải xong hay chưa** tại thời điểm đó.
 *
 * Đo cái nút có tồn tại thì vô nghĩa: nút vẫn còn nguyên kể cả khi tên file sai.
 */
async function captureNextPrint(page: Page) {
  await page.addInitScript(() => {
    const store = window as unknown as { __printCalls: PrintCall[] };
    store.__printCalls = [];
    window.print = () => {
      const images = [
        ...document.querySelectorAll<HTMLImageElement>("[data-report-print] img"),
      ];
      store.__printCalls.push({
        title: document.title,
        imagesTotal: images.length,
        imagesComplete: images.filter((image) => image.complete).length,
      });
      // Trình duyệt thật phát `afterprint` sau khi hộp thoại đóng; phát lại ở đây
      // để đo được cả vế KHÔI PHỤC tiêu đề.
      window.dispatchEvent(new Event("afterprint"));
    };
  });
}

async function printCalls(page: Page): Promise<PrintCall[]> {
  return page.evaluate(
    () => (window as unknown as { __printCalls?: PrintCall[] }).__printCalls ?? [],
  );
}

/**
 * Màu chữ + nền của số đề mục, đo Ở CHẾ ĐỘ IN.
 *
 * Trả cả độ sáng tương đối để bài kiểm nói được "chữ này chìm" bằng một con số,
 * thay vì so chuỗi `rgb(...)` — so chuỗi thì đổi tông xanh một bậc là đỏ oan.
 */
async function measureSectionNumber(page: Page) {
  return page.evaluate(() => {
    const badge = document.querySelector<HTMLElement>("[data-report-number]");
    if (!badge) return null;
    const style = getComputedStyle(badge);

    const channels = (value: string) =>
      (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: string) => {
      const [r = 255, g = 255, b = 255] = channels(value);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };

    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      // Alpha 0 ⇒ nền trong suốt ⇒ trên giấy là màu giấy.
      backgroundAlpha: Number((style.backgroundColor.match(/[\d.]+/g) ?? [])[3] ?? 1),
      textLuminance: luminance(style.color),
    };
  });
}

/**
 * (a) SỐ ĐỀ MỤC 1–9 TRÊN BẢN IN — user: *"cái màu của số đang bị chìm quá"*.
 *
 * Gốc lỗi: trên màn hình số là chữ TRẮNG trên nền xanh; trình duyệt bỏ màu nền
 * khi in ⇒ còn chữ trắng trên giấy trắng. Bài này đo ở `media: "print"` và ghim
 * hai vế: nền phải trong suốt, và **độ sáng chữ phải thấp** (mực đậm). Ghim độ
 * sáng chứ không ghim mã màu để bài không đỏ oan khi đổi tông thương hiệu.
 *
 * Đo ở CẢ HAI bề mặt — bản in của giáo viên và bản xem của giáo vụ — vì user chỉ
 * nhìn thấy một bản, nhưng cả hai đều dùng `SessionReportPrintable`.
 */
test("bản in: số đề mục 1–9 không còn chìm vào giấy", async ({ page }) => {
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();
  await fillReport(page);
  await submitReport(page);

  const reportId = sql(
    `select id from public.session_reports where session_id = '${SESSION_ID}';`,
  );

  await page.emulateMedia({ media: "print" });
  await page.goto(`/teacher/reports/${SESSION_ID}/ban-in`);
  await expect(page.locator("[data-report-number]").first()).toBeVisible();
  await assertInkOnPaper(page, "bản in của giáo viên");

  await page.emulateMedia({ media: null });
  await login(page, "gv.vu@polymind.test");
  await page.emulateMedia({ media: "print" });
  await page.goto(`/admin/reports/bao-cao/${reportId}`);
  await expect(page.locator("[data-report-number]").first()).toBeVisible();
  await assertInkOnPaper(page, "bản xem của giáo vụ");

  /*
   * Vế ngược: TRÊN MÀN HÌNH số vẫn phải là chữ sáng trên nền đậm. Không có vế
   * này thì "sửa" bản in bằng cách làm hỏng bản xem cũng xanh.
   */
  await page.emulateMedia({ media: null });
  await page.goto(`/admin/reports/bao-cao/${reportId}`);
  await expect(page.locator("[data-report-number]").first()).toBeVisible();
  const onScreen = await measureSectionNumber(page);
  expect(onScreen!.backgroundAlpha, "trên màn hình nền số vẫn đậm").toBeGreaterThan(0);
  expect(onScreen!.textLuminance, "trên màn hình chữ số vẫn sáng").toBeGreaterThan(0.8);
});

async function assertInkOnPaper(page: Page, label: string) {
  const badge = await measureSectionNumber(page);
  expect(badge, `${label} — tìm được số đề mục`).not.toBeNull();

  expect(
    badge!.backgroundAlpha,
    `${label} — nền số đề mục phải trong suốt khi in, không dựa vào việc trình duyệt có in nền hay không`,
  ).toBe(0);

  expect(
    badge!.textLuminance,
    `${label} — chữ số phải là mực đậm, đang là ${badge!.color}`,
  ).toBeLessThan(0.4);

  expect(
    parseFloat(badge!.borderTopWidth),
    `${label} — có viền để ô số vẫn thành hình trên giấy`,
  ).toBeGreaterThan(0);
}

/**
 * (c) + (d) NÚT "XUẤT BÁO CÁO" CỦA GIÁO VIÊN VÀ TÊN FILE PDF.
 *
 * Ghim bốn vế, mỗi vế là một cách hỏng khác nhau:
 *   1. nút đứng CẠNH "Xem báo cáo" và chỉ ở buổi ĐÃ GỬI;
 *   2. `document.title` tại thời điểm `print()` = `lớp_buổi_ngày`, KHÔNG kèm
 *      `.pdf` (kèm là Chrome ra `....pdf.pdf`);
 *   3. ảnh mục 8 đã tải xong TRƯỚC khi in — in sớm là PDF ra ô trắng;
 *   4. tiêu đề tab được khôi phục sau khi in, không bị bỏ lại thành tên file.
 */
test("giáo viên xuất báo cáo: tên file lớp_buổi_ngày và ảnh mục 8 đã tải xong", async ({
  page,
}) => {
  await captureNextPrint(page);
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);
  await page.goto(`/teacher/reports/${SESSION_ID}`);
  await expect(page.locator('[data-section="1"]')).toBeVisible();

  await fillReport(page);
  await expect(page.getByText(/Đã lưu nháp/)).toBeVisible({ timeout: 15_000 });

  // Ảnh THẬT ở mục 8: không có ảnh thì vế "chờ ảnh xong mới in" không đo được gì.
  const section8 = page.locator('[data-section="8"]');
  await section8.locator('input[type="file"][multiple]').setInputFiles({
    name: EVIDENCE_FILE_NAME,
    mimeType: "image/png",
    buffer: await evidencePng(),
  });
  await expect(section8.getByText(EVIDENCE_FILE_STEM)).toBeVisible({ timeout: 20_000 });

  await submitReport(page);

  // --- 1. Nút ở đúng chỗ, đúng lúc ------------------------------------------
  await page.goto("/teacher/reports");
  const submittedRow = page
    .locator("li")
    .filter({ hasText: `Buổi ${SESSION_NUMBER}` })
    .filter({ hasText: "Đã gửi" })
    .first();
  await expect(submittedRow.getByRole("link", { name: "Xem báo cáo" })).toBeVisible();
  await expect(submittedRow.getByRole("link", { name: "Xuất báo cáo" })).toBeVisible();

  /*
   * 🔴 LÀM CHẬM CHÍNH REQUEST ẢNH — không làm vậy thì bài kiểm vô nghĩa.
   *
   * Đã thử: gỡ hẳn `await waitForReportImages()` khỏi `printWithFileName()` mà
   * bài này **vẫn xanh**, vì Storage local trả tấm ảnh nhanh hơn cả nhịp `useEffect`
   * đầu tiên nên `img.complete` đã là `true` lúc `print()` chạy. Đúng cái bẫy
   * `UX-MOBILE-3` đã ghi lại: máy local nhanh quá thì phép đo không đo gì cả.
   *
   * `{ times: 1 }` chứ KHÔNG `page.unroute`: `unroute` cắt ngang handler đang ngủ,
   * nó tỉnh dậy gọi `route.continue()` trên route đã xử lý xong ⇒ *"Route is
   * already handled!"* làm đỏ bài ở tận cuối (bẫy đã ghi ở `UX-MOBILE-3`).
   */
  await page.route(
    "**/session-report-evidence/**",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    },
    { times: 1 },
  );

  // --- 2 + 3. Bấm nút và đọc lại đúng lúc print() được gọi -------------------
  await submittedRow.getByRole("link", { name: "Xuất báo cáo" }).click();
  await page.waitForURL(`**/teacher/reports/${SESSION_ID}/ban-in`);

  await expect
    .poll(async () => (await printCalls(page)).length, {
      timeout: 30_000,
      message: "trang bản in đã gọi window.print()",
    })
    .toBe(1);

  const teacherCall = (await printCalls(page))[0]!;

  expect(teacherCall.title, "tên file gợi ý = lớp_buổi_ngày").toBe(EXPECTED_PDF_STEM);
  expect(teacherCall.title, "KHÔNG kèm .pdf — Chrome tự thêm").not.toContain(".pdf");

  expect(teacherCall.imagesTotal, "bản in có ảnh minh chứng để mà chờ").toBeGreaterThan(0);
  expect(
    teacherCall.imagesComplete,
    "mọi ảnh mục 8 đã tải xong TRƯỚC khi in — in sớm là PDF ra ô trắng",
  ).toBe(teacherCall.imagesTotal);

  // --- 4. Tiêu đề tab trả về nguyên trạng sau khi in -------------------------
  await expect
    .poll(() => page.title(), { message: "tiêu đề tab được khôi phục sau khi in" })
    .not.toBe(EXPECTED_PDF_STEM);

  // --- Bản của giáo vụ dùng ĐÚNG cái tên đó ---------------------------------
  const reportId = sql(
    `select id from public.session_reports where session_id = '${SESSION_ID}';`,
  );
  await login(page, "gv.vu@polymind.test");
  await page.goto(`/admin/reports/bao-cao/${reportId}`);
  await page.getByRole("button", { name: "Xuất báo cáo" }).click();

  await expect
    .poll(async () => (await printCalls(page)).at(-1)?.title, {
      timeout: 30_000,
      message: "giáo vụ và giáo viên xuất ra CÙNG một tên file (user yêu cầu)",
    })
    .toBe(EXPECTED_PDF_STEM);
});

/**
 * Giá trị của một ô số trên trang hàng đợi giáo viên (`Tile`).
 *
 * Thẻ có ba dòng `<p>`: nhãn · con số · chú thích. Đọc theo thứ tự đó chứ không
 * bằng regex trên cả thẻ — *"Cần báo cáo · 3 · đã dạy, chưa gửi"* có hai con số.
 */
async function teacherTileValue(page: Page, label: string): Promise<number> {
  const tile = page
    .locator('[data-slot="card-content"]')
    .filter({ hasText: label })
    .first();
  const raw = await tile.locator("p").nth(1).innerText();
  return Number(raw.replace(/\D/g, "") || 0);
}

/**
 * (b) "KHÔNG CẦN BÁO CÁO" — nút của giáo vụ, hiệu lực tới hàng đợi giáo viên.
 *
 * 🔴 Vế đắt nhất là vế cuối: cờ đặt ở trang giáo vụ phải làm buổi đó RỜI khỏi
 * danh sách việc-cần-làm của GIÁO VIÊN. Chỉ đo phía giáo vụ thì một cái nút chỉ
 * đổi màu chữ tại chỗ cũng xanh, trong khi giáo viên vẫn thấy "Quá hạn N ngày".
 */
test("giáo vụ đánh dấu không cần báo cáo: rời khỏi nợ ở CẢ HAI phía", async ({
  page,
}) => {
  // Buổi đã điểm danh xong nhưng CHƯA có báo cáo — đúng ba buổi trong ảnh user.
  await login(page, "gv.a@polymind.test");
  await markAttendance(page);

  await page.goto("/teacher/reports");
  const beforeRow = page
    .locator("li")
    .filter({ hasText: `Buổi ${SESSION_NUMBER}` })
    .first();
  await expect(
    beforeRow.getByRole("link", { name: /Làm báo cáo|Viết tiếp/ }),
    "trước khi miễn: giáo viên còn việc phải làm",
  ).toBeVisible();

  const needReportBefore = await teacherTileValue(page, "Cần báo cáo");
  expect(needReportBefore, "trước khi miễn: ô 'Cần báo cáo' đang đếm buổi này").toBeGreaterThan(0);

  // --- Giáo vụ bấm nút ------------------------------------------------------
  await login(page, "gv.vu@polymind.test");
  await page.goto("/admin/reports?tab=bao-cao-gv&range=all");

  const badgeBefore = Number(
    (await page.getByLabel(/buổi chưa có báo cáo/).innerText()).replace(/\D/g, "") || 0,
  );
  expect(badgeBefore, "trước khi miễn: tab đang đếm nợ").toBeGreaterThan(0);

  await page
    .locator("li")
    .filter({ hasText: `Buổi ${SESSION_NUMBER}` })
    .filter({ has: page.getByRole("button", { name: "Không cần báo cáo" }) })
    .first()
    .getByRole("button", { name: "Không cần báo cáo" })
    .click();

  await expect(page.locator("[data-sonner-toast]").first()).toContainText(
    /Đã đánh dấu buổi này không cần báo cáo/,
  );

  await expect
    .poll(
      () =>
        sql(
          `select coalesce(report_waived_by::text, 'NULL') from public.class_sessions where id = '${SESSION_ID}';`,
        ),
      { message: "cờ miễn đã ghi vào DB kèm người bấm" },
    )
    .not.toBe("NULL");

  // Con số đỏ trên tab phải giảm — đây là chỗ user nhìn để biết còn nợ bao nhiêu.
  await page.goto("/admin/reports?tab=bao-cao-gv&range=all");
  const badgeAfter = Number(
    (await page
      .getByLabel(/buổi chưa có báo cáo/)
      .innerText()
      .catch(() => "0")).replace(/\D/g, "") || 0,
  );
  expect(badgeAfter, `con số nợ trên tab giảm sau khi miễn (trước: ${badgeBefore})`).toBe(
    badgeBefore - 1,
  );

  // --- Phía GIÁO VIÊN: rời khỏi việc cần làm, không còn "quá hạn" -----------
  await login(page, "gv.a@polymind.test");
  await page.goto("/teacher/reports");

  const waivedSection = page
    .locator("section")
    .filter({ hasText: "Không cần báo cáo" })
    .first();
  await expect(waivedSection, "buổi được xếp vào nhóm 'Không cần báo cáo'").toContainText(
    `Buổi ${SESSION_NUMBER}`,
  );

  const waivedRow = waivedSection
    .locator("li")
    .filter({ hasText: `Buổi ${SESSION_NUMBER}` })
    .first();
  await expect(
    waivedRow.getByRole("link", { name: /Làm báo cáo|Viết tiếp|Điểm danh trước/ }),
    "không còn nút mời làm đúng việc vừa được miễn",
  ).toHaveCount(0);
  await expect(waivedRow).not.toContainText("quá hạn");

  /*
   * 🔴 HAI PHÉP ĐO NÀY MỚI LÀ THỨ BẮT ĐƯỢC LỖI.
   *
   * Đã thử kiểm ngược: gỡ vế `!item.reportWaived` khỏi nhóm `pending` mà mấy
   * assertion ở trên **vẫn xanh** — buổi đã miễn hiện ở CẢ hai nhóm, và hàng
   * trong nhóm "Không cần báo cáo" vẫn đúng hình dạng. Cái hỏng thật là hàng bị
   * NHÂN ĐÔI và ô "Cần báo cáo" vẫn đếm nó, tức giáo viên vẫn thấy một việc đã
   * được miễn nằm trong danh sách việc phải làm.
   */
  await expect(
    page.locator("li").filter({ hasText: "LOP-02" }).filter({
      hasText: `Buổi ${SESSION_NUMBER}`,
    }),
    "buổi đã miễn xuất hiện ĐÚNG MỘT lần, không nằm cả ở nhóm việc cần làm",
  ).toHaveCount(1);

  expect(
    await teacherTileValue(page, "Cần báo cáo"),
    "ô 'Cần báo cáo' thôi đếm buổi đã miễn",
  ).toBe(needReportBefore - 1);

  // --- Đường lùi: bỏ đánh dấu, buổi trở lại danh sách cần báo cáo -----------
  await login(page, "gv.vu@polymind.test");
  await page.goto("/admin/reports?tab=bao-cao-gv&range=all&state=waived");

  /*
   * `state=waived` lọc bảng còn ĐÚNG những buổi đã miễn, nên đếm nút là một phép
   * đo thật: đúng 1 nghĩa là bộ lọc thấy đúng một buổi vừa miễn.
   *
   * Nhãn nhận cả hai dạng: bảng ≥768px viết gọn *"Cần lại"* cho vừa cột, danh
   * sách thẻ ở màn hẹp viết đủ *"Cần báo cáo lại"*. Bài kiểm chạy trên cả hai
   * project (chromium + Pixel 7) nên không được ghim một dạng.
   */
  const undoButton = page.getByRole("button", { name: /^Cần (báo cáo )?lại$/ });
  await expect(
    undoButton,
    "bộ lọc state=waived hiện đúng một buổi đã miễn",
  ).toHaveCount(1);
  await undoButton.click();

  await expect
    .poll(
      () =>
        sql(
          `select coalesce(report_waived_at::text, 'NULL') from public.class_sessions where id = '${SESSION_ID}';`,
        ),
      { message: "bỏ đánh dấu đã ghi vào DB" },
    )
    .toBe("NULL");

  await login(page, "gv.a@polymind.test");
  await page.goto("/teacher/reports");
  await expect(
    page
      .locator("li")
      .filter({ hasText: `Buổi ${SESSION_NUMBER}` })
      .first()
      .getByRole("link", { name: /Làm báo cáo|Viết tiếp/ }),
    "sau khi bỏ đánh dấu: việc quay lại hàng đợi của giáo viên",
  ).toBeVisible();
});
