import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

/**
 * `ADMIN-ATTENDANCE-1` — tab "Điểm danh" của `/admin/reports`, đo bằng TRÌNH
 * DUYỆT THẬT.
 *
 * Bốn thứ được ghim, mỗi thứ vì một lý do:
 *
 *  1. **Giáo vụ chỉ XEM** (`D-45` vế 4). pgTAP đã ghim cổng ở RPC; ở đây đo cái
 *     mà giáo vụ thật sự chạm vào — lưới hiện đủ số liệu nhưng ô KHÔNG phải nút.
 *     Hai tầng, vì tầng UI hỏng thì giáo vụ bấm vào một thứ chắc chắn báo lỗi.
 *
 *  2. **Admin sửa được, và DB đổi thật.** Kiểm mỗi "toast hiện lên" thì một
 *     action trả `success` mà không ghi gì cũng lọt.
 *
 *  3. **Buổi có báo cáo ĐÃ GỬI thì bản chụp trong báo cáo được dựng lại**
 *     (`D-45` vế 2, đảo `D-43` (c)) — và mang `revised_by`. Đây là vế đắt nhất
 *     của cả task: nó đổi một tài liệu đã ký.
 *
 *  4. **Không sinh cuộn ngang ở bề rộng điện thoại** — đo bằng phép đo đúng của
 *     `UX-MOBILE-1` (đếm phần tử con có `overflow-x`, KHÔNG dùng
 *     `documentElement.scrollWidth`), và CHO PHÉP đúng khung lưới được cuộn.
 */

const DB = "supabase_db_Polymind_Chinese";
const PASSWORD = "Polymind@2026";
const ADMIN = "admin@polymind.test";
const GIAOVU = "gv.vu@polymind.test";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/**
 * ⚠️ `seed.dev.sql` KHÔNG sinh một hàng `attendance_records` nào (đã đo:
 * `count = 0`). Bài kiểm này nói về việc *sửa lại* điểm danh **giáo viên đã
 * chốt**, nên nó phải TỰ dựng lấy trạng thái xuất phát đó — bám vào dữ liệu
 * seed là bám vào thứ không tồn tại, và lượt chạy đầu đã đỏ đúng vì vậy.
 */
const SESSION_ID = sql(`
  select cs.id
  from public.class_sessions cs
  join public.enrollments e on e.class_id = cs.class_id
    and e.status in ('pending','active','paused')
  where cs.starts_at < now() and cs.status <> 'cancelled'
  group by cs.id, cs.starts_at
  order by cs.starts_at desc
  limit 1;
`);

const CLASS_CODE = sql(`
  select c.code from public.classes c
  join public.class_sessions cs on cs.class_id = c.id
  where cs.id = '${SESSION_ID}';
`);

/**
 * 🔴 PHẢI CÓ, và lượt chạy đầu đã đỏ vì thiếu nó.
 *
 * Hàng của một học viên có N cột buổi. `.first()` bắt được cột **buổi sớm
 * nhất**, không phải buổi đang đo — nên bài kiểm sửa nhầm buổi khác rồi đi đọc
 * DB ở `SESSION_ID` và thấy "không có gì đổi". Nhãn trợ năng của ô là
 * `"<tên>, buổi <số>: <trạng thái>"`, nên số buổi chính là thứ chọn đúng cột.
 */
const SESSION_NUMBER = sql(
  `select session_number from public.class_sessions where id = '${SESSION_ID}';`,
);

/** Giáo viên phụ trách lớp — người "điểm danh gốc" mà audit phải giữ lại được. */
const TEACHER_USER_ID = sql(`
  select t.user_id
  from public.class_teachers ct
  join public.teachers t on t.id = ct.teacher_id
  join public.class_sessions cs on cs.class_id = ct.class_id
  where cs.id = '${SESSION_ID}'
  limit 1;
`);

/** Một ghi danh của chính lớp đó, chốt theo tên để lượt chạy nào cũng ra một người. */
const TARGET = sql(`
  select e.id || '|' || s.full_name
  from public.enrollments e
  join public.students s on s.id = e.student_id
  join public.class_sessions cs on cs.class_id = e.class_id
  where cs.id = '${SESSION_ID}' and e.status in ('pending','active','paused')
  order by s.full_name
  limit 1;
`);
const [ENROLLMENT_ID = "", STUDENT_NAME = ""] = TARGET.split("|");

// Fixture hỏng thì phải nổ NGAY ở đây với câu nói rõ nguyên nhân. Để nó chạy
// tiếp thì bài kiểm đỏ ở một selector nào đó với câu "element(s) not found" —
// mất nửa tiếng mới lần ra là do DB chưa seed. Lượt chạy đầu đã đúng như vậy.
if (!SESSION_ID || !ENROLLMENT_ID || !STUDENT_NAME || !TEACHER_USER_ID) {
  throw new Error(
    "Không tìm được buổi/ghi danh/giáo viên để đo. Chạy `npm run db:seed:dev` trước.",
  );
}

/** Trạng thái xuất phát: giáo viên đã điểm danh xong cả buổi, mọi người "có mặt". */
const START_STATUS = "present";

function seedFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.attendance_records where session_id = '${SESSION_ID}';
    insert into public.attendance_records (session_id, enrollment_id, status, marked_by)
    select '${SESSION_ID}', e.id, '${START_STATUS}'::public.attendance_status, '${TEACHER_USER_ID}'::uuid
    from public.enrollments e
    join public.class_sessions cs on cs.class_id = e.class_id
    where cs.id = '${SESSION_ID}' and e.status in ('pending','active','paused');
    delete from public.audit_logs
      where action = 'attendance.admin_override' and resource_id = '${SESSION_ID}';
    set session_replication_role = origin;
  `);
}

/**
 * Dọn sạch mọi cột đã chạm.
 *
 * ⚠️ Phải xoá cả dòng audit — không thì bài "đúng MỘT dòng audit" ở lượt chạy
 * sau đếm ra 2 và đỏ ở chỗ chẳng liên quan gì tới lỗi thật. Đúng luật đã ghi ở
 * `session-reports.spec.ts`: fixture phải trả lại MỌI thứ nó chạm vào.
 */
function purgeFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.session_reports where session_id = '${SESSION_ID}';
    delete from public.attendance_records where session_id = '${SESSION_ID}';
    delete from public.audit_logs
      where action = 'attendance.admin_override' and resource_id = '${SESSION_ID}';
    set session_replication_role = origin;
  `);
}

function currentStatus(): string {
  return sql(`
    select coalesce(status::text, '')
    from public.attendance_records
    where session_id = '${SESSION_ID}' and enrollment_id = '${ENROLLMENT_ID}';
  `);
}

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Ô của ĐÚNG buổi đang đo, không phải ô đầu hàng. */
function cellOf(page: Page) {
  return page.getByRole("button", {
    name: new RegExp(`${STUDENT_NAME}, buổi ${SESSION_NUMBER}:`),
  });
}

/**
 * Phép đo cuộn ngang — nguyên khuôn `UX-MOBILE-1` ở `session-reports.spec.ts`.
 *
 * ⚠️ Bản đầu của bài kiểm này tự chế một phép đo coi MỌI phần tử có
 * `scrollWidth > clientWidth` là lỗi, kể cả `overflow: hidden`. Kết quả: **25
 * "lỗi" ở 360px** — toàn bộ là các chuỗi `truncate` (tên lớp, tên học viên),
 * tức là đúng thứ đang làm việc của nó. Chỉ khung `overflow-x: auto|scroll`
 * mới thật sự bắt người dùng vuốt ngang.
 */
async function rogueScrollers(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        if (el.scrollWidth <= el.clientWidth + 1) return false;
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX !== "auto" && overflowX !== "scroll") return false;
        // Khung bảng được PHÉP cuộn: lựa chọn có chủ đích cho bảng rộng
        // (`D-31`), có nhãn vùng và bắt được tiêu điểm bàn phím.
        return el.dataset.slot !== "table-scroller";
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}[${(el.getAttribute("class") ?? "").slice(0, 60)}] ${el.scrollWidth}>${el.clientWidth}`,
      ),
  );
}

/**
 * Phần tử nào đang chìa ra ngoài khung nhìn.
 *
 * Con số `documentElement.scrollWidth - innerWidth` nói CÓ tràn nhưng không nói
 * tràn ở đâu — và đi tìm bằng mắt trong một cây DOM 900 ô là việc vô vọng. Trả
 * về thủ phạm ngay trong câu lỗi thì bài kiểm tự chỉ chỗ phải sửa.
 */
async function overflowingElements(page: Page) {
  return page.evaluate(() => {
    // Phần tử chìa ra ngoài mà nằm TRONG một khung cuộn thì vô can — khung cắt
    // nó đi, tài liệu không phình. Chỉ những phần tử không có tổ tiên cuộn nào
    // mới thật sự đẩy `documentElement.scrollWidth` lên.
    const insideScroller = (el: HTMLElement) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const overflowX = getComputedStyle(p).overflowX;
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") {
          return true;
        }
      }
      return false;
    };

    return [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .sort(
        (a, b) =>
          b.getBoundingClientRect().right - a.getBoundingClientRect().right,
      )
      .slice(0, 6)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return `${insideScroller(el) ? "(bị cắt) " : "🔴 "}${el.tagName.toLowerCase()}[${(el.getAttribute("class") ?? "").slice(0, 70)}] right=${Math.round(rect.right)}`;
      });
  });
}

async function openClassPanel(page: Page) {
  await page.goto("/admin/reports?tab=diem-danh&range=all");
  const header = page
    .getByRole("button", { name: new RegExp(CLASS_CODE) })
    .first();
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") {
    await header.click();
  }
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

test.beforeEach(() => seedFixture());
test.afterEach(() => purgeFixture());

test("tab Điểm danh hiện đủ bốn tab và mở được sổ của từng lớp", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/admin/reports?tab=diem-danh&range=all");

  const nav = page.getByRole("navigation", { name: "Loại báo cáo" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "Điểm danh" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Mục của lớp phải THU GỌN sẵn — mở trang thấy cấu trúc trước.
  const header = page.getByRole("button", { name: new RegExp(CLASS_CODE) }).first();
  await expect(header).toHaveAttribute("aria-expanded", "false");

  await header.click();
  await expect(page.locator("td button[data-cell]").first()).toBeVisible();
  await expect(page.getByText(STUDENT_NAME).first()).toBeVisible();
});

/**
 * 🔴 Bài của `D-45` vế 4 ở tầng giao diện.
 *
 * Giáo vụ phải thấy ĐẦY ĐỦ số liệu (họ vận hành hằng ngày) nhưng không có một
 * nút sửa nào. Đo bằng cách đếm nút trong lưới, không phải bằng "có thấy chữ
 * nào không" — một lưới chỉ đọc và một lưới sửa được trông gần như y hệt.
 */
test("giáo vụ xem được toàn bộ sổ điểm danh nhưng KHÔNG có ô nào bấm sửa được", async ({
  page,
}) => {
  await login(page, GIAOVU);
  await openClassPanel(page);

  await expect(page.getByText(STUDENT_NAME).first()).toBeVisible();
  await expect(page.getByText("Chỉ quản trị viên sửa được điểm danh")).toBeVisible();
  await expect(page.locator("td button[data-cell]")).toHaveCount(0);
});

test("admin sửa một ô: DB đổi thật, và bấm Lưu mới ghi", async ({ page }) => {
  const before = currentStatus();
  const next = before === "excused" ? "absent" : "excused";
  const nextLabel = next === "excused" ? "Có phép" : "Vắng";

  await login(page, ADMIN);
  await openClassPanel(page);

  await cellOf(page).click();
  await page.getByRole("radio", { name: nextLabel }).click();

  // 🔴 Chưa bấm Lưu thì DB PHẢI chưa đổi. Không có phép đo này thì một bản dựng
  // "ghi thẳng mỗi lần bấm ô" vẫn xanh, mà đó đúng là thứ thiết kế này từ chối.
  expect(currentStatus()).toBe(before);

  await page.keyboard.press("Escape");
  const saveBar = page.getByRole("button", { name: /^Lưu \d+ thay đổi$/ });
  await expect(saveBar).toBeVisible();
  await saveBar.click();

  // Đọc NGUYÊN VĂN toast chứ không chỉ hỏi "có khớp mẫu không": lượt chạy đầu
  // đỏ với câu *"element(s) not found"*, không nói được là action đã trả lỗi
  // hay chỉ sai chữ. Bắt toast rồi so nội dung thì lỗi tự khai ra.
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  expect(await toast.textContent()).toMatch(/Đã lưu \d+ ô điểm danh/);
  expect(currentStatus()).toBe(next);

  // Dấu vết: đúng một dòng audit, và `before` còn giữ trạng thái cũ.
  expect(
    sql(`select count(*) from public.audit_logs
         where action = 'attendance.admin_override' and resource_id = '${SESSION_ID}';`),
  ).toBe("1");
  expect(
    sql(`select before -> 0 ->> 'status' from public.audit_logs
         where action = 'attendance.admin_override' and resource_id = '${SESSION_ID}'
         order by created_at limit 1;`),
  ).toBe(before);
});

/**
 * 🔴 VẾ ĐẮT NHẤT: sửa điểm danh của buổi ĐÃ CÓ BÁO CÁO KÝ thì bản chụp trong
 * báo cáo được dựng lại (`D-45` vế 2). Bài này dựng sẵn một báo cáo đã gửi cho
 * chính buổi đang đo, rồi đọc ngược `attendance_snapshot` sau khi lưu.
 */
test("buổi đã có báo cáo gửi: cảnh báo hiện ra và bản chụp trong báo cáo đổi theo", async ({
  page,
}) => {
  const classId = sql(
    `select class_id from public.class_sessions where id = '${SESSION_ID}';`,
  );
  const adminId = sql(`select id from auth.users where email = '${ADMIN}';`);

  // Fixture: một báo cáo ĐÃ GỬI mang bản chụp cũ hẳn (absent = 99) để phân biệt
  // rõ "đã dựng lại" với "vô tình trùng số".
  sql(`
    set session_replication_role = replica;
    delete from public.session_reports where session_id = '${SESSION_ID}';
    insert into public.session_reports
      (session_id, class_id, status, confirmed, created_by, submitted_by, submitted_at, attendance_snapshot)
    values ('${SESSION_ID}', '${classId}', 'submitted', true, '${adminId}', '${adminId}', now(),
            '{"captured_at":"2026-08-01T00:00:00+00:00","roster_size":99,"present":0,"late":0,"absent":99,"excused":0,"students":[]}'::jsonb);
    set session_replication_role = origin;
  `);

  try {
    const before = currentStatus();
    const next = before === "excused" ? "absent" : "excused";
    const nextLabel = next === "excused" ? "Có phép" : "Vắng";

    await login(page, ADMIN);
    await openClassPanel(page);

    await cellOf(page).click();

    // Cảnh báo phải đứng TRƯỚC khi bấm, không phải sau khi lưu xong.
    await expect(
      page.getByText(/Buổi này đã có báo cáo giáo viên gửi/),
    ).toBeVisible();

    await page.getByRole("radio", { name: nextLabel }).click();
    await page.keyboard.press("Escape");

    await expect(
      page.getByText(/buổi đã có báo cáo gửi — số liệu chuyên cần/),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Lưu \d+ thay đổi$/ }).click();
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toBeVisible();
    expect(await toast.textContent()).toMatch(/báo cáo đã gửi được cập nhật lại/);

    const snapshot = sql(`
      select (attendance_snapshot ->> 'roster_size') || '|' ||
             coalesce(attendance_snapshot ->> 'revised_by', '') || '|' ||
             coalesce(attendance_snapshot -> 'revised_from' ->> 'absent', '')
      from public.session_reports where session_id = '${SESSION_ID}';
    `);
    const [rosterSize, revisedBy, revisedFromAbsent] = snapshot.split("|");

    expect(rosterSize).not.toBe("99"); // đã dựng lại từ điểm danh thật
    expect(revisedBy).toBe(adminId); // mang dấu vết ai sửa
    expect(revisedFromAbsent).toBe("99"); // giữ con số LÚC KÝ
  } finally {
    sql(`
      set session_replication_role = replica;
      delete from public.session_reports where session_id = '${SESSION_ID}';
      set session_replication_role = origin;
    `);
  }
});

test("không sinh cuộn ngang ngoài đúng khung lưới ở bề rộng điện thoại", async ({
  page,
}) => {
  await login(page, ADMIN);

  for (const width of [360, 375, 390, 414]) {
    await page.setViewportSize({ width, height: 800 });
    await openClassPanel(page);

    expect(
      await rogueScrollers(page),
      `khung con cuộn ngang ngoài ý muốn ở ${width}px`,
    ).toEqual([]);

    /*
     * 🔴 `expect.poll`, KHÔNG phải một phép đo đơn.
     *
     * Đo ngay sau khi đổi khung nhìn thì bắt được `documentElement.scrollWidth`
     * của bố cục CŨ trong khi `innerWidth` đã là số MỚI — đọc ra "tràn 231px"
     * ở một trang hoàn toàn không tràn (đã đo riêng: doc=591 mà không một phần
     * tử nào chìa ra ngoài khung nhìn). Chờ cho hai con số cùng thuộc về một
     * lần bố cục rồi mới kết luận.
     */
    await expect
      .poll(
        async () => {
          const { doc, inner } = await page.evaluate(() => ({
            doc: document.documentElement.scrollWidth,
            inner: window.innerWidth,
          }));
          return doc - inner;
        },
        {
          message: `trang tràn ngang ở ${width}px — thủ phạm: ${JSON.stringify(
            await overflowingElements(page),
          )}`,
          timeout: 5_000,
        },
      )
      .toBeLessThanOrEqual(1);
  }
});
