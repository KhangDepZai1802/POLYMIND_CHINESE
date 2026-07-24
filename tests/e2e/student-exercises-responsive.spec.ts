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

const QUESTION_ID = "e2200000-0000-4000-8000-000000000001";
const QUESTION_VERSION_ID = "e2200000-0000-4000-8000-000000000002";
const SET_ID = "e2200000-0000-4000-8000-000000000003";
const SET_VERSION_ID = "e2200000-0000-4000-8000-000000000004";
const SET_ITEM_ID = "e2200000-0000-4000-8000-000000000005";
const TODO_DELIVERY_ID = "e2200000-0000-4000-8000-000000000010";
const DOING_DELIVERY_ID = "e2200000-0000-4000-8000-000000000011";
const SUBMITTED_DELIVERY_ID = "e2200000-0000-4000-8000-000000000012";
const GRADED_DELIVERY_ID = "e2200000-0000-4000-8000-000000000013";
const OVERDUE_DELIVERY_ID = "e2200000-0000-4000-8000-000000000014";
const DOING_ATTEMPT_ID = "e2200000-0000-4000-8000-000000000021";
const SUBMITTED_ATTEMPT_ID = "e2200000-0000-4000-8000-000000000022";
const GRADED_ATTEMPT_ID = "e2200000-0000-4000-8000-000000000023";

const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

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

function purgeFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.exercise_answers
      where attempt_id in ('${DOING_ATTEMPT_ID}', '${SUBMITTED_ATTEMPT_ID}', '${GRADED_ATTEMPT_ID}');
    delete from public.exercise_attempts
      where id in ('${DOING_ATTEMPT_ID}', '${SUBMITTED_ATTEMPT_ID}', '${GRADED_ATTEMPT_ID}');
    delete from public.exercise_deliveries
      where id in ('${TODO_DELIVERY_ID}', '${DOING_DELIVERY_ID}', '${SUBMITTED_DELIVERY_ID}', '${GRADED_DELIVERY_ID}', '${OVERDUE_DELIVERY_ID}');
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
      '${QUESTION_ID}', '${TEACHER_USER_ID}', 'Câu hỏi UIUX M22', 'vocabulary', 'medium', 'private', 'ready', '${TEACHER_USER_ID}'
    );
    insert into public.question_versions (
      id, question_id, version_no, question_type, prompt_text, prompt_content,
      explanation_text, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '${QUESTION_ID}', 1, 'single_choice',
      '“学习” có nghĩa là gì?', '{}'::jsonb,
      '学习 nghĩa là học tập.', '${TEACHER_USER_ID}'
    );
    insert into public.question_options (
      question_version_id, option_key, content, order_index
    ) values
      ('${QUESTION_VERSION_ID}', 'a', 'Học tập', 0),
      ('${QUESTION_VERSION_ID}', 'b', 'Làm việc', 1);
    insert into public.question_answer_keys (
      question_version_id, answer_key, created_by
    ) values (
      '${QUESTION_VERSION_ID}', '{"value":"a"}'::jsonb, '${TEACHER_USER_ID}'
    );
    update public.questions
      set current_version_id = '${QUESTION_VERSION_ID}'
      where id = '${QUESTION_ID}';

    insert into public.question_sets (
      id, owner_id, kind, title, description, status
    ) values (
      '${SET_ID}', '${TEACHER_USER_ID}', 'exercise', 'Bộ bài UIUX M22',
      'Fixture responsive học viên', 'ready'
    );
    insert into public.question_set_versions (
      id, question_set_id, version_no, title_snapshot, instructions_snapshot,
      raw_max_score, created_by
    ) values (
      '${SET_VERSION_ID}', '${SET_ID}', 1, 'Bộ bài UIUX M22',
      'Đọc kỹ câu hỏi và chọn đáp án phù hợp.', 10, '${TEACHER_USER_ID}'
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
    ) values
      ('${TODO_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài từ vựng cần làm', 'Hoàn thành trước hạn để duy trì nhịp học.', clock_timestamp() - interval '1 day', clock_timestamp() + interval '3 day', true, 1, 10, 'open', clock_timestamp(), '${TEACHER_USER_ID}'),
      ('${DOING_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài luyện đang làm', 'Đọc kỹ câu hỏi và chọn đáp án phù hợp.', clock_timestamp() - interval '1 day', clock_timestamp() + interval '2 day', true, 1, 10, 'open', clock_timestamp(), '${TEACHER_USER_ID}'),
      ('${SUBMITTED_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài đã nộp chờ chấm', null, clock_timestamp() - interval '2 day', clock_timestamp() + interval '1 day', true, 1, 10, 'grading', clock_timestamp(), '${TEACHER_USER_ID}'),
      ('${GRADED_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài đã có kết quả', null, clock_timestamp() - interval '3 day', clock_timestamp() - interval '1 day', true, 1, 10, 'results_published', clock_timestamp(), '${TEACHER_USER_ID}'),
      ('${OVERDUE_DELIVERY_ID}', '${CLASS_ID}', '${SET_VERSION_ID}', 'Bài cần xem lại vì quá hạn', null, clock_timestamp() - interval '3 day', clock_timestamp() - interval '2 hour', true, 1, 10, 'closed', clock_timestamp(), '${TEACHER_USER_ID}');

    insert into public.exercise_attempts (
      id, delivery_id, enrollment_id, attempt_no, status, started_at,
      submitted_at, raw_score, final_score, graded_at, results_published_at
    ) values
      ('${DOING_ATTEMPT_ID}', '${DOING_DELIVERY_ID}', '${ENROLLMENT_ID}', 1, 'in_progress', clock_timestamp() - interval '20 minute', null, null, null, null, null),
      ('${SUBMITTED_ATTEMPT_ID}', '${SUBMITTED_DELIVERY_ID}', '${ENROLLMENT_ID}', 1, 'pending_manual_grading', clock_timestamp() - interval '1 hour', clock_timestamp() - interval '30 minute', null, null, null, null),
      ('${GRADED_ATTEMPT_ID}', '${GRADED_DELIVERY_ID}', '${ENROLLMENT_ID}', 1, 'graded', clock_timestamp() - interval '2 day', clock_timestamp() - interval '2 day' + interval '20 minute', 8, 8, clock_timestamp() - interval '1 day', clock_timestamp() - interval '1 day');

    insert into public.exercise_answers (
      attempt_id, set_item_id, answer_payload, auto_score, final_score, feedback
    ) values (
      '${GRADED_ATTEMPT_ID}', '${SET_ITEM_ID}', '{"value":"a"}'::jsonb, 8, 8,
      'Em đã nắm đúng nghĩa của từ.'
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

test("Bài tập học viên giữ đúng hành trình và responsive ba màn", async ({
  page,
}) => {
  await loginStudent(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/student/exercises", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Bài tập", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(5);
    await expect(page.getByText("1 cần làm · 1 quá hạn")).toBeVisible();
    await expectAccessibleAndContained(page, `list-${viewport.name}`);
    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m22-list-${viewport.name}.png`,
        fullPage: true,
      });
    }

    await page.goto(
      `/student/exercises/${DOING_DELIVERY_ID}/attempt/${DOING_ATTEMPT_ID}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(
      page.getByRole("heading", { name: "Bài luyện đang làm", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText("Đọc kỹ câu hỏi và chọn đáp án phù hợp."),
    ).toBeVisible();
    await expectAccessibleAndContained(page, `attempt-${viewport.name}`);
    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m22-attempt-${viewport.name}.png`,
        fullPage: true,
      });
    }

    await page.goto(`/student/exercises/results/${GRADED_ATTEMPT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Kết quả bài tập", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Tỷ lệ điểm đạt được" }),
    ).toHaveAttribute("aria-valuenow", "80");
    await expectAccessibleAndContained(page, `result-${viewport.name}`);
    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m22-result-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }

  await page.goto("/student/exercises", { waitUntil: "domcontentloaded" });
  const todo = page.getByRole("tab", { name: /Cần làm/ });
  await todo.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Đang làm/ })).toBeFocused();
  await expect(todo).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /Đang làm/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
