import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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

const QUESTION_ID = "e2500000-0000-4000-8000-000000000001";
const QUESTION_VERSION_ID = "e2500000-0000-4000-8000-000000000002";
const SET_ID = "e2500000-0000-4000-8000-000000000003";
const SET_VERSION_ID = "e2500000-0000-4000-8000-000000000004";
const SET_ITEM_ID = "e2500000-0000-4000-8000-000000000005";
const DELIVERY_ID = "e2500000-0000-4000-8000-000000000006";
const ATTEMPT_ID = "e2500000-0000-4000-8000-000000000007";
const EVALUATION_ID = "e2500000-0000-4000-8000-000000000008";
const NOTE_ID = "e2500000-0000-4000-8000-000000000009";

const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

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
    delete from public.student_notes where id = '${NOTE_ID}';
    delete from public.learning_evaluations where id = '${EVALUATION_ID}';
    delete from public.exercise_answers where attempt_id = '${ATTEMPT_ID}';
    delete from public.exercise_attempts where id = '${ATTEMPT_ID}';
    delete from public.exercise_deliveries where id = '${DELIVERY_ID}';
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
      '${QUESTION_ID}', '${TEACHER_USER_ID}', 'Câu hỏi UIUX M25', 'vocabulary',
      'medium', 'private', 'ready', '${TEACHER_USER_ID}'
    );
    insert into public.question_versions (
      id, question_id, version_no, question_type, prompt_text, prompt_content,
      explanation_text, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '${QUESTION_ID}', 1, 'single_choice',
      '“成绩” có nghĩa là gì?', '{}'::jsonb, '成绩 nghĩa là kết quả, thành tích.',
      '${TEACHER_USER_ID}'
    );
    insert into public.question_options (
      question_version_id, option_key, content, order_index
    ) values
      ('${QUESTION_VERSION_ID}', 'a', 'Kết quả', 0),
      ('${QUESTION_VERSION_ID}', 'b', 'Bữa sáng', 1);
    insert into public.question_answer_keys (
      question_version_id, answer_key, created_by
    ) values ('${QUESTION_VERSION_ID}', '{"value":"a"}'::jsonb, '${TEACHER_USER_ID}');
    update public.questions
      set current_version_id = '${QUESTION_VERSION_ID}'
      where id = '${QUESTION_ID}';

    insert into public.question_sets (
      id, owner_id, kind, title, description, status
    ) values (
      '${SET_ID}', '${TEACHER_USER_ID}', 'exercise', 'Bộ bài UIUX M25',
      'Fixture trang Kết quả', 'ready'
    );
    insert into public.question_set_versions (
      id, question_set_id, version_no, title_snapshot, instructions_snapshot,
      raw_max_score, created_by
    ) values (
      '${SET_VERSION_ID}', '${SET_ID}', 1, 'Bộ bài UIUX M25',
      'Chọn nghĩa đúng của từ.', 10, '${TEACHER_USER_ID}'
    );
    insert into public.question_set_items (
      id, set_version_id, question_version_id, order_index, points, required
    ) values (
      '${SET_ITEM_ID}', '${SET_VERSION_ID}', '${QUESTION_VERSION_ID}', 0, 10, true
    );
    update public.question_set_versions
      set locked_at = clock_timestamp()
      where id = '${SET_VERSION_ID}';
    update public.question_sets
      set current_version_id = '${SET_VERSION_ID}'
      where id = '${SET_ID}';

    insert into public.exercise_deliveries (
      id, class_id, set_version_id, title, instructions, available_from, due_at,
      allow_late_submission, attempt_limit, max_score, status, published_at, created_by
    ) values (
      '${DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài đã có kết quả M25',
      null, clock_timestamp() - interval '3 day', clock_timestamp() - interval '1 day',
      true, 1, 10, 'results_published', clock_timestamp(), '${TEACHER_USER_ID}'
    );
    insert into public.exercise_attempts (
      id, delivery_id, enrollment_id, attempt_no, status, started_at,
      submitted_at, raw_score, final_score, graded_at, results_published_at
    ) values (
      '${ATTEMPT_ID}', '${DELIVERY_ID}', '${ENROLLMENT_ID}', 1, 'graded',
      clock_timestamp() - interval '2 day',
      clock_timestamp() - interval '2 day' + interval '20 minute',
      8, 8, clock_timestamp() - interval '1 day', clock_timestamp() - interval '1 day'
    );
    insert into public.exercise_answers (
      attempt_id, set_item_id, answer_payload, auto_score, final_score, feedback
    ) values (
      '${ATTEMPT_ID}', '${SET_ITEM_ID}', '{"value":"a"}'::jsonb, 8, 8,
      'Em đã nắm đúng nghĩa của từ.'
    );

    insert into public.learning_evaluations (
      id, enrollment_id, period_start, period_end, evaluation_date,
      overall_rating, listening_rating, speaking_rating,
      strengths, areas_for_improvement, action_plan, teacher_comment,
      visible_to_student, published_at, created_by
    ) values (
      '${EVALUATION_ID}', '${ENROLLMENT_ID}',
      current_date - 30, current_date - 1, current_date - 1,
      'good', 'excellent', 'average',
      'Phát âm thanh điệu đã chắc hơn nhiều so với đầu khóa.',
      'Cần luyện nghe câu dài, tốc độ nhanh.',
      'Mỗi ngày nghe 10 phút hội thoại và chép lại.',
      'Em tiến bộ đều, giữ nhịp học như hiện tại là đạt mục tiêu.',
      true, clock_timestamp(), '${TEACHER_USER_ID}'
    );
    insert into public.student_notes (
      id, enrollment_id, body, visibility, created_by
    ) values (
      '${NOTE_ID}', '${ENROLLMENT_ID}',
      'Buổi tới em mang theo vở chép từ nhé.', 'student_visible', '${TEACHER_USER_ID}'
    );
    commit;
  `);
}

async function loginStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
}

/**
 * `TabsTrigger` của Radix mang `transition-all`; đo contrast ngay sau khi đổi
 * tab sẽ trúng màu đang pha giữa hai trạng thái và báo lỗi không có thật
 * (xem `05_UIUX_SESSION_CHECKPOINT.md` → Current Findings mục `000`).
 *
 * M24 đợi tab **vừa nhả** trở về nền trong suốt. Ở M25 cách đó vẫn lọt: tab
 * vừa được chọn còn đang chuyển màu **vào** nền primary, và axe đọc trúng màu
 * pha `#3c78b6` → báo 3.51:1. Nên ở đây đợi thẳng vào thứ gây ra chuyện đó:
 * **không còn transition nào đang chạy trên bất kỳ tab nào**. Không so màu
 * bằng hằng số nên đổi token cũng không làm test giòn.
 */
async function waitForTabColorsToSettle(page: Page) {
  await expect
    .poll(() =>
      page
        .getByRole("tablist")
        .evaluate((list) =>
          Array.from(list.querySelectorAll('[role="tab"]')).every(
            (tab) => tab.getAnimations().length === 0,
          ),
        ),
    )
    .toBe(true);
}

async function expectAccessibleAndContained(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, label).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, label).toEqual([]);
}

test.beforeAll(setupFixture);
test.afterAll(purgeFixture);

test("Kết quả giữ đúng ba nhóm và responsive ba màn", async ({ page }) => {
  await loginStudent(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/student/results", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Kết quả", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tổng quan học tập", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(3);

    // Tab Điểm — mặc định.
    await expect(
      page.getByRole("heading", { name: "Điểm đã công bố", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", {
        name: "Tỉ lệ điểm của Bài đã có kết quả M25",
      }),
    ).toHaveAttribute("aria-valuenow", "80");
    await waitForTabColorsToSettle(page);
    await expectAccessibleAndContained(page, `results-diem-${viewport.name}`);

    // Tab Đánh giá.
    await page.getByRole("tab", { name: /Đánh giá/ }).click();
    await expect(
      page.getByRole("heading", { name: "Đánh giá học tập", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Nghe: Tốt")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Lời nhắn từ giáo viên/, level: 2 }),
    ).toBeVisible();
    await waitForTabColorsToSettle(page);
    await expectAccessibleAndContained(page, `results-danhgia-${viewport.name}`);

    // Tab Tiến độ.
    await page.getByRole("tab", { name: /Tiến độ/ }).click();
    await expect(
      page.getByRole("heading", { name: "Chặng đường khóa học", level: 2 }),
    ).toBeVisible();
    const courseBar = page.getByRole("progressbar", {
      name: "Tiến độ khóa học",
    });
    await expect(courseBar).toBeVisible();
    const now = Number(await courseBar.getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThanOrEqual(0);
    expect(now).toBeLessThanOrEqual(100);
    await waitForTabColorsToSettle(page);
    await expectAccessibleAndContained(page, `results-tiendo-${viewport.name}`);

    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m25-results-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }
});

test("Điểm dẫn sang trang chi tiết và tab mở đúng theo ?tab=", async ({
  page,
}) => {
  await loginStudent(page);
  await page.setViewportSize(viewports[2]);

  await page.goto("/student/results?tab=progress", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("tab", { name: /Tiến độ/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Giá trị lạ phải rơi về tab đầu tiên, không để khung rỗng.
  await page.goto("/student/results?tab=khong-ton-tai", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("tab", { name: /^Điểm/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page
    .getByRole("link", { name: "Xem chi tiết điểm, feedback và đáp án" })
    .click();
  await page.waitForURL(`**/student/exercises/results/${ATTEMPT_ID}`);
});
