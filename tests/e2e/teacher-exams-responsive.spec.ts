import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P17-T2` / UIUX-M17 — màn Kiểm tra / Thi của giáo viên.
 *
 * Cùng tinh thần M16 (`DS-031`): đây là công cụ làm việc, bài kiểm nhắm vào
 * form lên lịch thi, danh sách kỳ thi và màn chấm — không kiểm "động lực học".
 *
 * Hai điểm đặc thù của M17 so với M16:
 *  - `closes_at` là chỗ múi giờ `D-12` **cuối cùng** còn lại trong `src/`, nên
 *    có một bài đo đúng chuỗi hiển thị từ một mốc UTC đã biết trước.
 *  - Màn chấm dùng chung với M16 và trước đây render `<main>` lồng trong
 *    `<main>` của layout, nên có một bài đếm landmark.
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

const QUESTION_ID = "e1700000-0000-4000-8000-000000000001";
const QUESTION_VERSION_ID = "e1700000-0000-4000-8000-000000000002";
const SET_ID = "e1700000-0000-4000-8000-000000000003";
const SET_VERSION_ID = "e1700000-0000-4000-8000-000000000004";
const SET_ITEM_ID = "e1700000-0000-4000-8000-000000000005";
const OPEN_DELIVERY_ID = "e1700000-0000-4000-8000-000000000010";
const GRADING_DELIVERY_ID = "e1700000-0000-4000-8000-000000000011";
const WAITING_ATTEMPT_ID = "e1700000-0000-4000-8000-000000000021";

/**
 * Mốc đóng thi cố định, ghi bằng UTC.
 *
 * `2026-08-14T17:30:00Z` = **15/08/2026 00:30** giờ `Asia/Ho_Chi_Minh` (UTC+7).
 * Chọn đúng mốc vắt qua nửa đêm để bài kiểm bắt được cả lỗi lệch NGÀY chứ không
 * chỉ lệch giờ: máy chạy test ở UTC sẽ hiện `14/08`, chỉ bản đã sửa mới ra
 * `15/08`.
 */
const CLOSES_AT_UTC = "2026-08-14 17:30:00+00";
const CLOSES_AT_VN = "15/08/2026 00:30";

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;

const CREATED_TITLE = "Kỳ thi tạo bằng E2E UIUX M17";

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
    delete from public.exam_answers where attempt_id = '${WAITING_ATTEMPT_ID}';
    delete from public.exam_attempts where id = '${WAITING_ATTEMPT_ID}';
    delete from public.exam_deliveries
      where id in ('${OPEN_DELIVERY_ID}', '${GRADING_DELIVERY_ID}')
         or title = '${CREATED_TITLE}';
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
      '${QUESTION_ID}', '${TEACHER_USER_ID}', 'Câu hỏi UIUX M17', 'vocabulary', 'medium', 'private', 'ready', '${TEACHER_USER_ID}'
    );
    insert into public.question_versions (
      id, question_id, version_no, question_type, prompt_text, prompt_content,
      explanation_text, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '${QUESTION_ID}', 1, 'single_choice',
      '“考试” có nghĩa là gì?', '{}'::jsonb, '考试 nghĩa là kỳ thi.', '${TEACHER_USER_ID}'
    );
    insert into public.question_options (
      question_version_id, option_key, content, order_index
    ) values
      ('${QUESTION_VERSION_ID}', 'a', 'Kỳ thi', 0),
      ('${QUESTION_VERSION_ID}', 'b', 'Bài hát', 1);
    insert into public.question_answer_keys (
      question_version_id, answer_key, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '{"value":"a"}'::jsonb, '${TEACHER_USER_ID}'
    );
    update public.questions set current_version_id = '${QUESTION_VERSION_ID}' where id = '${QUESTION_ID}';

    insert into public.question_sets (id, owner_id, kind, title, description, status)
    values ('${SET_ID}', '${TEACHER_USER_ID}', 'exam', 'Bộ đề UIUX M17', 'Fixture giáo viên', 'ready');
    insert into public.question_set_versions (
      id, question_set_id, version_no, title_snapshot, instructions_snapshot, raw_max_score, created_by
    ) values (
      '${SET_VERSION_ID}', '${SET_ID}', 1, 'Bộ đề UIUX M17', 'Đọc kỹ rồi chọn đáp án.', 10, '${TEACHER_USER_ID}'
    );
    insert into public.question_set_items (
      id, set_version_id, question_version_id, order_index, points, required
    ) values ('${SET_ITEM_ID}', '${SET_VERSION_ID}', '${QUESTION_VERSION_ID}', 0, 10, true);
    update public.question_set_versions set locked_at = clock_timestamp() where id = '${SET_VERSION_ID}';
    update public.question_sets set current_version_id = '${SET_VERSION_ID}' where id = '${SET_ID}';

    insert into public.exam_deliveries (
      id, class_id, set_version_id, title, exam_type, opens_at, closes_at,
      duration_minutes, passing_score, answer_release_mode, status, published_at, created_by
    ) values
      ('${OPEN_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Kỳ thi đang mở UIUX M17', 'custom',
        clock_timestamp() - interval '1 day', timestamptz '${CLOSES_AT_UTC}', 45, 50, 'never', 'open', clock_timestamp(), '${TEACHER_USER_ID}'),
      ('${GRADING_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Kỳ thi chờ chấm UIUX M17', 'custom',
        clock_timestamp() - interval '2 day', clock_timestamp() + interval '1 day', 45, 50, 'never', 'grading', clock_timestamp(), '${TEACHER_USER_ID}');

    insert into public.exam_attempts (
      id, exam_delivery_id, enrollment_id, status, started_at, deadline_at, submitted_at, created_at, updated_at
    ) values (
      '${WAITING_ATTEMPT_ID}', '${GRADING_DELIVERY_ID}', '${ENROLLMENT_ID}',
      'pending_manual_grading', clock_timestamp() - interval '1 hour',
      clock_timestamp() + interval '1 day', clock_timestamp() - interval '30 minute',
      clock_timestamp(), clock_timestamp()
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
  { name: "ky-thi", path: "/teacher/exams", h1: "Lên lịch thi cho lớp" },
  { name: "bo-de", path: "/teacher/exams/sets", h1: "Bộ đề thi" },
  { name: "ngan-hang", path: "/teacher/exams/question-bank", h1: "Ngân hàng câu hỏi" },
] as const;

test.beforeAll(setupFixture);
test.afterAll(purgeFixture);

test("Ba màn Kiểm tra/Thi sạch axe và không tràn ngang", async ({ page }) => {
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
          path: `C:/tmp/polymind-m17-${surface.name}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
});

test("Ba màn Kiểm tra/Thi không tràn ngang ở cả sáu bề rộng", async ({ page }) => {
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

test("Form lên lịch thi có nhãn thật cho mọi control và sạch axe", async ({ page }) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/exams", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Tạo kỳ thi" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await expect(page.getByLabel("Bộ đề đã khóa")).toBeVisible();
  // Trước `P17-T2` đây là `<select>` trần, `<Label>` có `htmlFor` nhưng viền
  // 1.27:1 và cao 9 thay vì 10 — nay đi qua `NativeSelect` như M16.
  await expect(page.getByLabel("Công bố đáp án")).toBeVisible();
  await expect(page.getByLabel("Tiêu đề")).toBeVisible();
  await expect(page.getByLabel("Thời lượng (phút)")).toBeVisible();
  await expect(page.getByLabel("Điểm đạt")).toBeVisible();

  // Danh sách lớp là một NHÓM checkbox: trước đây chỉ có `<Label>` lơ lửng
  // không trỏ vào đâu nên trình đọc màn hình không bao giờ nói đang chọn gì.
  await expect(page.getByRole("group", { name: /Lớp/ })).toBeVisible();

  await expectAccessibleAndContained(page, "dialog-lich-thi");
});

test("Giờ đóng thi hiện dd/MM/yyyy HH:mm theo giờ Việt Nam", async ({ page }) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/exams", { waitUntil: "domcontentloaded" });

  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Kỳ thi đang mở UIUX M17" });
  await expect(row).toBeVisible();

  /*
   * `D-12`: ngày `dd/MM/yyyy`, giờ `Asia/Ho_Chi_Minh`. Bản cũ dùng
   * `toLocaleString("vi-VN")` — chỉ đổi NGÔN NGỮ chứ không đổi MÚI GIỜ, nên nó
   * lấy múi giờ của MÁY giáo viên và in ra dạng `0:30:00 15/8/2026`.
   * Mốc fixture cố tình vắt qua nửa đêm nên bản cũ chạy ở UTC sẽ ra ngày 14.
   */
  await expect(row).toContainText(`Đóng ${CLOSES_AT_VN}`);
  await expect(row).not.toContainText("15/8/2026");
});

test("Màn chấm thi chỉ có MỘT landmark main và nói ra học viên đang chọn", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/teacher/exams/${GRADING_DELIVERY_ID}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.getByRole("heading", { name: "Chấm kỳ thi", level: 1 }),
  ).toBeVisible();

  /*
   * `GradingWorkspace` từng render `<main>` của riêng nó bên trong `<main>` của
   * `app/(dashboard)/layout.tsx` → hai landmark `main` lồng nhau trên cùng một
   * trang. Đếm bằng DOM thay vì tin axe, vì axe không phải lúc nào cũng gắn cờ
   * `main` lồng nhau.
   */
  expect(await page.locator("main").count()).toBe(1);

  // Học viên đang chọn phải tự nói ra, không chỉ đổi màu nền (`color-not-only`).
  const selected = page.locator('[aria-current="true"]');
  await expect(selected).toHaveCount(1);

  await expectAccessibleAndContained(page, "cham-thi@1280");
});

test("Lên lịch một kỳ thi THẬT rồi đọc DB xác nhận đã ghi đúng", async ({ page }) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/exams", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Tạo kỳ thi" }).click();
  // Đặt tên cho dialog: popover lịch đã đóng vẫn nằm lại trong DOM và cũng mang
  // `role="dialog"`, nên selector không tên sẽ khớp hai phần tử.
  const dialog = page.getByRole("dialog", { name: "Lên lịch kỳ thi" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Bộ đề đã khóa").click();
  await page.getByRole("option", { name: /Bộ đề UIUX M17/ }).click();

  // `class_ids` là nhóm nhiều ô tick cùng tên — chính là hành vi nghiệp vụ mà
  // `CHECKBOX_CLASS` cố ý giữ `<input type="checkbox">` gốc để không phá.
  await dialog.getByRole("group", { name: /Lớp/ }).getByRole("checkbox").first().check();
  await dialog.getByLabel("Tiêu đề").fill(CREATED_TITLE);
  await dialog.getByLabel("Thời lượng (phút)").fill("60");
  await dialog.getByLabel("Điểm đạt").fill("70");

  /*
   * `DateTimePicker` là nút mở popover lịch, KHÔNG phải `<input>` — `fill()`
   * không dùng được. Phải chọn thật qua lịch. Hai ngày phải khác nhau vì DB có
   * `check (opens_at < closes_at)`.
   *
   * `button[data-day]` chứ không phải `[data-day]`: lịch gắn thuộc tính đó lên
   * CẢ ô `<td>` lẫn nút bên trong, nên `nth(0)`/`nth(1)` của selector rộng trỏ
   * vào cùng một ngày → `opens_at == closes_at` và vướng constraint.
   */
  const dayIndex = { "exam-opens-at": 0, "exam-closes-at": 1 } as const;
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

  await dialog.getByRole("button", { name: "Lên lịch" }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  /*
   * Đọc thẳng DB: UI đóng dialog không có nghĩa là đã ghi đúng. `60|70` chứng
   * minh giá trị người dùng nhập thật sự đi tới server chứ không phải giá trị
   * mặc định của form (45 và 50).
   */
  // `passing_score` là `numeric` nên psql in ra `70.00`; ép về `int` để so sánh
  // đúng con số nghiệp vụ thay vì phụ thuộc cách psql định dạng số thập phân.
  const row = sql(
    `select duration_minutes || '|' || passing_score::int from public.exam_deliveries where title = '${CREATED_TITLE}';`,
  );
  expect(row, "kỳ thi phải được tạo với đúng thời lượng và điểm đạt đã nhập").toBe("60|70");
});
