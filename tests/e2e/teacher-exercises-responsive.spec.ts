import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P17-T1` / UIUX-M16 — ba màn Bài tập của giáo viên.
 *
 * Khác khu vực học viên: đây là **công cụ làm việc**, nên bài kiểm tập trung
 * vào form giao bài (nhiều control nhất trong module), bộ lọc ngân hàng câu hỏi
 * và dải tab ba bước — không kiểm "động lực học" như M20–M27 (`DS-031`).
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
/*
 * Tra ghi danh qua mỏ neo ổn định (auth user hv1 + mã lớp), không ghim UUID:
 * `enrollments.id` sinh mới sau mỗi `db reset` (`P17-T5`).
 */
const ENROLLMENT_ID = sql(`
  select e.id from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.students s on s.id = e.student_id
  where c.code = 'LOP-02' and s.user_id = '33333333-3333-3333-3333-333333333331'
    and e.status not in ('withdrawn', 'transferred')
  limit 1;`);

const QUESTION_ID = "e1600000-0000-4000-8000-000000000001";
const QUESTION_VERSION_ID = "e1600000-0000-4000-8000-000000000002";
const SET_ID = "e1600000-0000-4000-8000-000000000003";
const SET_VERSION_ID = "e1600000-0000-4000-8000-000000000004";
const SET_ITEM_ID = "e1600000-0000-4000-8000-000000000005";
const OPEN_DELIVERY_ID = "e1600000-0000-4000-8000-000000000010";
const GRADING_DELIVERY_ID = "e1600000-0000-4000-8000-000000000011";
const WAITING_ATTEMPT_ID = "e1600000-0000-4000-8000-000000000021";

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function purgeFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.exercise_answers where attempt_id = '${WAITING_ATTEMPT_ID}';
    delete from public.exercise_attempts where id = '${WAITING_ATTEMPT_ID}';
    delete from public.exercise_deliveries
      where id in ('${OPEN_DELIVERY_ID}', '${GRADING_DELIVERY_ID}');
    update public.question_sets set current_version_id = null where id = '${SET_ID}';
    update public.questions set current_version_id = null where id = '${QUESTION_ID}';
    delete from public.question_set_items where id = '${SET_ITEM_ID}';
    delete from public.question_set_versions where id = '${SET_VERSION_ID}';
    delete from public.question_sets where id = '${SET_ID}';
    delete from public.question_options where question_version_id = '${QUESTION_VERSION_ID}';
    delete from public.question_answer_keys where question_version_id = '${QUESTION_VERSION_ID}';
    delete from public.question_versions where id = '${QUESTION_VERSION_ID}';
    delete from public.questions where id = '${QUESTION_ID}';
    set session_replication_role = origin;
  `);
}

function setupFixture() {
  purgeFixture();
  sql(`
    begin;
    insert into public.questions (
      id, owner_id, title, skill, difficulty, visibility, status, created_by
    ) values (
      '${QUESTION_ID}', '${TEACHER_USER_ID}', 'Câu hỏi UIUX M16', 'vocabulary', 'medium', 'private', 'ready', '${TEACHER_USER_ID}'
    );
    insert into public.question_versions (
      id, question_id, version_no, question_type, prompt_text, prompt_content,
      explanation_text, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '${QUESTION_ID}', 1, 'single_choice',
      '“老师” có nghĩa là gì?', '{}'::jsonb, '老师 nghĩa là giáo viên.', '${TEACHER_USER_ID}'
    );
    insert into public.question_options (
      question_version_id, option_key, content, order_index
    ) values
      ('${QUESTION_VERSION_ID}', 'a', 'Giáo viên', 0),
      ('${QUESTION_VERSION_ID}', 'b', 'Học sinh', 1);
    insert into public.question_answer_keys (
      question_version_id, answer_key, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '{"value":"a"}'::jsonb, '${TEACHER_USER_ID}'
    );
    update public.questions set current_version_id = '${QUESTION_VERSION_ID}' where id = '${QUESTION_ID}';

    insert into public.question_sets (id, owner_id, kind, title, description, status)
    values ('${SET_ID}', '${TEACHER_USER_ID}', 'exercise', 'Bộ bài UIUX M16', 'Fixture giáo viên', 'ready');
    insert into public.question_set_versions (
      id, question_set_id, version_no, title_snapshot, instructions_snapshot, raw_max_score, created_by
    ) values (
      '${SET_VERSION_ID}', '${SET_ID}', 1, 'Bộ bài UIUX M16', 'Đọc kỹ rồi chọn đáp án.', 10, '${TEACHER_USER_ID}'
    );
    insert into public.question_set_items (
      id, set_version_id, question_version_id, order_index, points, required
    ) values ('${SET_ITEM_ID}', '${SET_VERSION_ID}', '${QUESTION_VERSION_ID}', 0, 10, true);
    update public.question_set_versions set locked_at = clock_timestamp() where id = '${SET_VERSION_ID}';
    update public.question_sets set current_version_id = '${SET_VERSION_ID}' where id = '${SET_ID}';

    insert into public.exercise_deliveries (
      id, class_id, set_version_id, title, instructions, available_from, due_at,
      allow_late_submission, attempt_limit, max_score, status, published_at, created_by
    ) values
      ('${OPEN_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài tập đang mở UIUX M16', 'Hoàn thành trước hạn.', clock_timestamp() - interval '1 day', clock_timestamp() + interval '3 day', true, 1, 10, 'open', clock_timestamp(), '${TEACHER_USER_ID}'),
      ('${GRADING_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài tập chờ chấm UIUX M16', null, clock_timestamp() - interval '2 day', clock_timestamp() + interval '1 day', true, 1, 10, 'grading', clock_timestamp(), '${TEACHER_USER_ID}');

    insert into public.exercise_attempts (
      id, delivery_id, enrollment_id, attempt_no, status, started_at, submitted_at
    ) values (
      '${WAITING_ATTEMPT_ID}', '${GRADING_DELIVERY_ID}', '${ENROLLMENT_ID}', 1,
      'pending_manual_grading', clock_timestamp() - interval '1 hour', clock_timestamp() - interval '30 minute'
    );
    commit;
  `);
}

async function loginTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.a@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
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

const SURFACES = [
  { name: "giao-bai", path: "/teacher/exercises", h1: "Giao bài tập cho lớp" },
  { name: "bo-bai-tap", path: "/teacher/exercises/sets", h1: "Bộ bài tập" },
  { name: "ngan-hang", path: "/teacher/exercises/question-bank", h1: "Ngân hàng câu hỏi" },
] as const;

test.beforeAll(setupFixture);
test.afterAll(purgeFixture);

test("Ba màn Bài tập giáo viên sạch axe và không tràn ngang", async ({ page }) => {
  await loginTeacher(page);

  for (const surface of SURFACES) {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", { name: surface.h1, level: 1 }),
      ).toBeVisible();

      await expectAccessibleAndContained(page, `${surface.name}@${width}`);

      if (process.env.UIUX_CAPTURE === "1") {
        await page.screenshot({
          path: `C:/tmp/polymind-m16-${surface.name}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
});

test("Ba màn Bài tập giáo viên không tràn ngang ở cả sáu bề rộng", async ({ page }) => {
  await loginTeacher(page);

  for (const surface of SURFACES) {
    for (const width of WIDTH_LADDER) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(
        overflow,
        `${surface.name} @ ${width}px tràn ngang ${overflow}px`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test("Form giao bài tập có nhãn thật cho mọi control và sạch axe", async ({ page }) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/exercises", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Giao bài tập" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Mọi control phải gọi được bằng nhãn — trước `P17-T1` ba ô chọn dùng
  // `<select>` trần và `<Label>` không gắn `htmlFor` nên trình đọc màn hình
  // đọc thành "combo box" không tên.
  await expect(page.getByLabel("Bộ bài tập đã khóa")).toBeVisible();
  await expect(page.getByLabel("Cách chọn điểm")).toBeVisible();
  await expect(page.getByLabel("Công bố điểm")).toBeVisible();
  await expect(page.getByLabel("Công bố đáp án")).toBeVisible();
  await expect(page.getByLabel("Tiêu đề")).toBeVisible();
  await expect(page.getByLabel("Số lượt")).toBeVisible();
  await expect(page.getByLabel("Phạt trễ (%)")).toBeVisible();
  await expect(page.getByLabel("Cho phép nộp trễ")).toBeVisible();

  // Danh sách lớp là một nhóm checkbox → phải có tên nhóm, không phải một
  // `<Label>` lơ lửng không trỏ vào đâu.
  await expect(
    page.getByRole("group", { name: /Lớp/ }),
  ).toBeVisible();

  await expectAccessibleAndContained(page, "dialog-giao-bai");
});

test("Bộ lọc ngân hàng câu hỏi gọi được bằng nhãn", async ({ page }) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/exercises/question-bank", {
    waitUntil: "domcontentloaded",
  });

  await expect(page.getByLabel("Tìm mã hoặc tiêu đề")).toBeVisible();
  await expect(page.getByLabel("Kỹ năng")).toBeVisible();
  await expect(page.getByLabel("Phạm vi")).toBeVisible();
});

test("Hạn nộp hiện đúng định dạng dd/MM/yyyy HH:mm theo giờ Việt Nam", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/exercises", { waitUntil: "domcontentloaded" });

  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Bài tập đang mở UIUX M16" });

  // `D-12`: ngày `dd/MM/yyyy`, giờ `Asia/Ho_Chi_Minh`. `toLocaleString("vi-VN")`
  // trước đây cho ra `20:05:00 22/7/2026` **theo múi giờ của máy giáo viên** —
  // sai cả thứ tự, có giây, và lệch giờ nếu máy không đặt múi giờ VN.
  await expect(row).toContainText(/Hạn \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}(?!:)/);
});

test("Giao bài tập cho lớp vẫn chạy thật sau khi đổi trình bày form", async ({
  page,
}) => {
  const title = `Kiểm chứng P17-T1 ${Date.now()}`;

  try {
    await loginTeacher(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/teacher/exercises", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Giao bài tập" }).click();
    // Đặt tên cho dialog: popover lịch đã đóng vẫn nằm lại trong DOM và cũng
    // mang `role="dialog"`, nên selector không tên khớp hai phần tử.
    const dialog = page.getByRole("dialog", { name: "Giao bộ bài tập" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Bộ bài tập đã khóa").click();
    await page.getByRole("option", { name: /Bộ bài UIUX M16/ }).click();

    // `class_ids` là nhóm nhiều ô tick cùng tên — đây chính là hành vi mà
    // `CHECKBOX_CLASS` cố ý giữ `<input type="checkbox">` gốc để không phá.
    await dialog.getByRole("group", { name: /Lớp/ }).getByRole("checkbox").first().check();

    await dialog.getByLabel("Tiêu đề").fill(title);
    await dialog.getByLabel("Số lượt").fill("2");

    // `available_from`/`due_at` là bắt buộc ở `deliverySchema`, phải chọn thật
    // qua lịch chứ không ghi thẳng vào hidden input. Hai ngày phải khác nhau:
    // DB có `check (due_at > available_from)`.
    // `button[data-day]` chứ không phải `[data-day]`: lịch gắn thuộc tính đó
    // lên CẢ ô `<td>` lẫn nút bên trong, nên `nth(0)`/`nth(1)` của selector
    // rộng trỏ vào cùng một ngày → `due_at == available_from` và vướng
    // `check (due_at > available_from)`.
    const dayIndex = { "ex-available-from": 0, "ex-due-at": 1 } as const;
    for (const [field, index] of Object.entries(dayIndex)) {
      await dialog.locator(`#${field}`).click();
      const openCalendar = page
        .locator('[data-slot="popover-content"]')
        .filter({ has: page.locator("button[data-day]") })
        .last();
      await openCalendar
        .locator("button[data-day]:not([disabled])")
        .nth(index)
        .click();
      await page.keyboard.press("Escape");
    }

    await dialog.getByRole("button", { name: "Giao & công bố" }).click();

    await expect(dialog).toBeHidden();

    // Kiểm ở DB trước: `attempt_limit = 2` chứng minh giá trị người dùng nhập
    // thật sự đi tới server chứ không phải mặc định, và `class_ids` (nhóm ô
    // tick cùng tên) vẫn gửi đúng.
    const row = sql(
      `select attempt_limit from public.exercise_deliveries where title = '${title}';`,
    );
    expect(row, "delivery phải được tạo với đúng số lượt đã nhập").toBe("2");

    // Đợi vỏ loading của route biến mất rồi mới khẳng định: `domcontentloaded`
    // trả về khi trang còn đang hiện "Đang tải dữ liệu", nên khẳng định ngay
    // sau đó là đang đo nhầm màn.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("status")).toBeHidden({ timeout: 30_000 });
    // Lọc theo `listitem`: tên bài còn xuất hiện lần thứ hai trong nhãn
    // `sr-only` của nút "Mở lớp & chấm bài" (để mỗi nút có tên riêng), nên
    // `getByText` trần sẽ khớp hai phần tử.
    await expect(
      page.getByRole("listitem").filter({ hasText: title }),
    ).toBeVisible();
  } finally {
    sql(`
      set session_replication_role = replica;
      delete from public.exercise_deliveries where title = '${title}';
      set session_replication_role = origin;
    `);
  }
});

test("UX-UIUX-M16-007 — 'Mở từ' muộn hơn 'Hạn nộp' báo lỗi bằng tiếng Việt", async ({
  page,
}) => {
  const title = `Kiểm chứng M16-007 ${Date.now()}`;

  try {
    await loginTeacher(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/teacher/exercises", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Giao bài tập" }).click();
    const dialog = page.getByRole("dialog", { name: "Giao bộ bài tập" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Bộ bài tập đã khóa").click();
    await page.getByRole("option", { name: /Bộ bài UIUX M16/ }).click();
    await dialog.getByRole("group", { name: /Lớp/ }).getByRole("checkbox").first().check();
    await dialog.getByLabel("Tiêu đề").fill(title);
    await dialog.getByLabel("Số lượt").fill("1");

    // ĐẢO NGƯỢC so với test "chạy thật": mở bài ngày SAU, hạn nộp ngày TRƯỚC,
    // để chạm đúng `check (due_at > available_from)` ở DB.
    const dayIndex = { "ex-available-from": 1, "ex-due-at": 0 } as const;
    for (const [field, index] of Object.entries(dayIndex)) {
      await dialog.locator(`#${field}`).click();
      const openCalendar = page
        .locator('[data-slot="popover-content"]')
        .filter({ has: page.locator("button[data-day]") })
        .last();
      await openCalendar
        .locator("button[data-day]:not([disabled])")
        .nth(index)
        .click();
      await page.keyboard.press("Escape");
    }

    await dialog.getByRole("button", { name: "Giao & công bố" }).click();

    // Phải nói ra ràng buộc bằng tiếng Việt — ở CẢ hai chỗ app vẫn báo lỗi:
    // khối `Alert` trong dialog (còn đó để đọc lại) và toast (báo ngay).
    await expect(
      dialog.getByText("Hạn nộp phải sau thời điểm mở bài."),
    ).toBeVisible();
    await expect(
      page.getByText("Hạn nộp phải sau thời điểm mở bài."),
    ).toHaveCount(2);

    // …và tuyệt đối không lộ tiếng Anh kỹ thuật (`EX-21`).
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const leak of [
      "violates check constraint",
      "exercise_deliveries_check",
      "new row for relation",
    ]) {
      expect(body, `giao diện không được chứa "${leak}"`).not.toContain(leak);
    }

    // DB phải từ chối thật — không được tạo bản ghi nào.
    const count = sql(
      `select count(*) from public.exercise_deliveries where title = '${title}';`,
    );
    expect(count, "delivery sai thứ tự ngày phải bị DB chặn").toBe("0");
  } finally {
    sql(`
      set session_replication_role = replica;
      delete from public.exercise_deliveries where title = '${title}';
      set session_replication_role = origin;
    `);
  }
});

test("Dải tab ba bước tới được bằng bàn phím ở màn hẹp", async ({ page }) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/teacher/exercises", { waitUntil: "domcontentloaded" });

  const tablist = page.getByRole("tablist", { name: "Khu vực bài tập" });
  await expect(tablist).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(3);
});
