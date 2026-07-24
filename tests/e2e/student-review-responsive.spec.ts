import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const TEACHER_USER_ID = "22222222-2222-2222-2222-222222222221";
/*
 * Tra `students.id` qua `user_id` — auth user của hv1 là UUID CỐ ĐỊNH trong seed,
 * còn `students.id` thì `gen_random_uuid()` nên đổi sau mỗi `db reset` (`P17-T5`).
 */
const STUDENT_ID = sql(`select id from public.students where user_id = '33333333-3333-3333-3333-333333333331';`);

const QUESTION_ID = "e2400000-0000-4000-8000-000000000001";
const VERSION_A_ID = "e2400000-0000-4000-8000-000000000002";
const VERSION_B_ID = "e2400000-0000-4000-8000-000000000003";
const SET_ID = "e2400000-0000-4000-8000-000000000004";
const SET_VERSION_ID = "e2400000-0000-4000-8000-000000000005";
const ITEM_A_ID = "e2400000-0000-4000-8000-000000000006";
const ITEM_B_ID = "e2400000-0000-4000-8000-000000000007";
const QUEUE_A_ID = "e2400000-0000-4000-8000-000000000008";
const QUEUE_B_ID = "e2400000-0000-4000-8000-000000000009";

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
    delete from public.wrong_answer_review_attempts
      where queue_id in ('${QUEUE_A_ID}', '${QUEUE_B_ID}');
    delete from public.wrong_answer_queue
      where id in ('${QUEUE_A_ID}', '${QUEUE_B_ID}');
    update public.question_sets set current_version_id = null where id = '${SET_ID}';
    update public.questions set current_version_id = null where id = '${QUESTION_ID}';
    delete from public.question_set_items where id in ('${ITEM_A_ID}', '${ITEM_B_ID}');
    delete from public.question_set_versions where id = '${SET_VERSION_ID}';
    delete from public.question_sets where id = '${SET_ID}';
    delete from public.question_options
      where question_version_id in ('${VERSION_A_ID}', '${VERSION_B_ID}');
    delete from public.question_answer_keys
      where question_version_id in ('${VERSION_A_ID}', '${VERSION_B_ID}');
    delete from public.question_versions where id in ('${VERSION_A_ID}', '${VERSION_B_ID}');
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
      '${QUESTION_ID}', '${TEACHER_USER_ID}', 'Câu hỏi UIUX M24', 'vocabulary',
      'medium', 'private', 'ready', '${TEACHER_USER_ID}'
    );
    insert into public.question_versions (
      id, question_id, version_no, question_type, prompt_text, prompt_content,
      explanation_text, created_by
    ) values
      ('${VERSION_A_ID}', '${QUESTION_ID}', 1, 'single_choice',
       '“复习” có nghĩa là gì?', '{}'::jsonb, '复习 nghĩa là ôn tập.', '${TEACHER_USER_ID}'),
      ('${VERSION_B_ID}', '${QUESTION_ID}', 2, 'single_choice',
       '“考试” có nghĩa là gì?', '{}'::jsonb, '考试 nghĩa là kỳ thi.', '${TEACHER_USER_ID}');
    insert into public.question_options (
      question_version_id, option_key, content, order_index
    ) values
      ('${VERSION_A_ID}', 'a', 'Ôn tập', 0),
      ('${VERSION_A_ID}', 'b', 'Nghỉ ngơi', 1),
      ('${VERSION_B_ID}', 'a', 'Kỳ thi', 0),
      ('${VERSION_B_ID}', 'b', 'Bài hát', 1);
    insert into public.question_answer_keys (
      question_version_id, answer_key, created_by
    ) values
      ('${VERSION_A_ID}', '{"value":"a"}'::jsonb, '${TEACHER_USER_ID}'),
      ('${VERSION_B_ID}', '{"value":"a"}'::jsonb, '${TEACHER_USER_ID}');
    update public.questions
      set current_version_id = '${VERSION_A_ID}'
      where id = '${QUESTION_ID}';

    insert into public.question_sets (
      id, owner_id, kind, title, description, status
    ) values (
      '${SET_ID}', '${TEACHER_USER_ID}', 'exercise', 'Bộ bài UIUX M24',
      'Fixture ôn câu sai', 'ready'
    );
    insert into public.question_set_versions (
      id, question_set_id, version_no, title_snapshot, instructions_snapshot,
      raw_max_score, created_by
    ) values (
      '${SET_VERSION_ID}', '${SET_ID}', 1, 'Bộ bài UIUX M24',
      'Chọn nghĩa đúng của từ.', 20, '${TEACHER_USER_ID}'
    );
    insert into public.question_set_items (
      id, set_version_id, question_version_id, order_index, points, required
    ) values
      ('${ITEM_A_ID}', '${SET_VERSION_ID}', '${VERSION_A_ID}', 0, 10, true),
      ('${ITEM_B_ID}', '${SET_VERSION_ID}', '${VERSION_B_ID}', 1, 10, true);
    update public.question_set_versions
      set locked_at = clock_timestamp()
      where id = '${SET_VERSION_ID}';
    update public.question_sets
      set current_version_id = '${SET_VERSION_ID}'
      where id = '${SET_ID}';

    -- Hai câu đang chờ ôn: một câu sai nhiều lần từ Bài tập, một câu từ Bài thi.
    insert into public.wrong_answer_queue (
      id, student_id, question_version_id, source_kind, source_set_item_id,
      first_seen_at, last_seen_at, wrong_count
    ) values
      ('${QUEUE_A_ID}', '${STUDENT_ID}', '${VERSION_A_ID}', 'exercise', '${ITEM_A_ID}',
       clock_timestamp() - interval '5 day', clock_timestamp() - interval '1 day', 3),
      ('${QUEUE_B_ID}', '${STUDENT_ID}', '${VERSION_B_ID}', 'exam', '${ITEM_B_ID}',
       clock_timestamp() - interval '2 day', clock_timestamp() - interval '2 day', 1);
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
 * `TabsTrigger` của Radix mang `transition-all`, nên ngay sau khi đổi tab thì
 * nền và chữ của tab vừa nhả còn đang chuyển màu. Axe đo trúng khoảnh khắc đó
 * sẽ đọc ra màu pha (ví dụ `#5b82ab` trên `#aac8e4` = 2.31:1) và báo lỗi
 * contrast không có thật. Đợi nền của tab không-được-chọn trở về trong suốt
 * mới là lúc trạng thái đã ổn định.
 */
async function waitForTabColorsToSettle(page: Page) {
  await expect
    .poll(() =>
      page
        .getByRole("tab", { name: /Flashcard Từ Vựng/ })
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgba(0, 0, 0, 0)");
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

test("Ôn câu sai giữ đúng hành trình và responsive ba màn", async ({
  page,
}) => {
  await loginStudent(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/student/review", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Ôn tập", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(2);

    await page.getByRole("tab", { name: /Ôn Tập Câu Sai/ }).click();
    await expect(
      page.getByRole("heading", { name: "Tổng quan câu cần ôn", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Tiến độ ôn câu sai" }),
    ).toHaveAttribute("aria-valuenow", "0");
    await expect(page.getByRole("heading", { name: "Câu 1/2" })).toBeVisible();

    await waitForTabColorsToSettle(page);
    await expectAccessibleAndContained(page, `review-${viewport.name}`);
    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m24-review-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }

  // Trả lời đúng thì câu rời hàng đợi và thanh tiến độ phải nhích lên.
  await page.setViewportSize(viewports[2]);
  await page.goto("/student/review", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /Ôn Tập Câu Sai/ }).click();
  await page.getByRole("radio", { name: "Ôn tập" }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Tiến độ ôn câu sai" }),
  ).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByRole("heading", { name: "Câu 1/1" })).toBeVisible();
});
