import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const U = "22222222-2222-2222-2222-222222222221";
/*
 * Tra theo MÃ LỚP chứ không hard-code UUID. `seed.sql` insert `public.classes`
 * mà KHÔNG chỉ định `id`, nên UUID sinh mới sau **mỗi lần `db reset`** — bản cũ
 * ghim '7dd9b79a-997b-4c14-a627-2165422eaccc' nên chỉ chạy được trên DB
 * chưa reset, reset xong là cả file không nạp nổi (`P17-T5`). `code` là khóa
 * nghiệp vụ ổn định, seed luôn tạo 'LOP-02'.
 */
const C = sql(`select id from public.classes where code = 'LOP-02';`);
/*
 * Tra ghi danh qua mỏ neo ổn định (auth user hv1 + mã lớp), không ghim UUID:
 * `enrollments.id` sinh mới sau mỗi `db reset` (`P17-T5`).
 */
const E = sql(`
  select e.id from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.students s on s.id = e.student_id
  where c.code = 'LOP-02' and s.user_id = '33333333-3333-3333-3333-333333333331'
    and e.status not in ('withdrawn', 'transferred')
  limit 1;`);
const Q = "f2300000-0000-4000-8000-000000000001";
const QV = "f2300000-0000-4000-8000-000000000002";
const S = "f2300000-0000-4000-8000-000000000003";
const SV = "f2300000-0000-4000-8000-000000000004";
const I = "f2300000-0000-4000-8000-000000000005";
const READY = "f2300000-0000-4000-8000-000000000010";
const ACTIVE = "f2300000-0000-4000-8000-000000000011";
const RESULT = "f2300000-0000-4000-8000-000000000012";
const ACTIVE_ATTEMPT = "f2300000-0000-4000-8000-000000000021";
const RESULT_ATTEMPT = "f2300000-0000-4000-8000-000000000022";
const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

function sql(query: string) {
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

function purge() {
  sql(`set session_replication_role=replica;
    delete from public.exam_integrity_events where attempt_id in ('${ACTIVE_ATTEMPT}','${RESULT_ATTEMPT}');
    delete from public.exam_answers where attempt_id in ('${ACTIVE_ATTEMPT}','${RESULT_ATTEMPT}');
    delete from public.exam_attempts where id in ('${ACTIVE_ATTEMPT}','${RESULT_ATTEMPT}');
    delete from public.exam_deliveries where id in ('${READY}','${ACTIVE}','${RESULT}');
    update public.question_sets set current_version_id=null where id='${S}';
    update public.questions set current_version_id=null where id='${Q}';
    delete from public.question_set_items where id='${I}'; delete from public.question_set_versions where id='${SV}'; delete from public.question_sets where id='${S}';
    delete from public.question_options where question_version_id='${QV}'; delete from public.question_answer_keys where question_version_id='${QV}'; delete from public.question_versions where id='${QV}'; delete from public.questions where id='${Q}';
    set session_replication_role=origin;`);
}

function setup() {
  purge();
  sql(`begin;
    insert into public.questions(id,owner_id,title,skill,difficulty,visibility,status,created_by) values('${Q}','${U}','Câu UIUX M23','vocabulary','medium','private','ready','${U}');
    insert into public.question_versions(id,question_id,version_no,question_type,prompt_text,prompt_content,explanation_text,created_by) values('${QV}','${Q}',1,'single_choice','“考试” có nghĩa là gì?','{}','考试 nghĩa là kỳ thi.','${U}');
    insert into public.question_options(question_version_id,option_key,content,order_index) values('${QV}','a','Kỳ thi',0),('${QV}','b','Bài tập',1);
    insert into public.question_answer_keys(question_version_id,answer_key,created_by) values('${QV}','{"value":"a"}','${U}'); update public.questions set current_version_id='${QV}' where id='${Q}';
    insert into public.question_sets(id,owner_id,kind,title,status) values('${S}','${U}','exam','Bộ đề UIUX M23','ready');
    insert into public.question_set_versions(id,question_set_id,version_no,title_snapshot,raw_max_score,created_by) values('${SV}','${S}',1,'Bộ đề UIUX M23',10,'${U}');
    insert into public.question_set_items(id,set_version_id,question_version_id,order_index,points,required) values('${I}','${SV}','${QV}',0,10,true);
    update public.question_set_versions set locked_at=clock_timestamp() where id='${SV}'; update public.question_sets set current_version_id='${SV}' where id='${S}';
    insert into public.exam_deliveries(id,class_id,set_version_id,title,opens_at,closes_at,duration_minutes,status,published_at,results_published_at,created_by) values
      ('${READY}','${C}','${SV}','Kỳ thi sẵn sàng',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',30,'open',clock_timestamp(),null,'${U}'),
      ('${ACTIVE}','${C}','${SV}','Kỳ thi đang làm',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',30,'open',clock_timestamp(),null,'${U}'),
      ('${RESULT}','${C}','${SV}','Kỳ thi đã có kết quả',clock_timestamp()-interval '2 day',clock_timestamp()-interval '1 day',30,'results_published',clock_timestamp()-interval '2 day',clock_timestamp()-interval '12 hour','${U}');
    insert into public.exam_attempts(id,exam_delivery_id,enrollment_id,status,started_at,deadline_at,submitted_at,submission_reason,raw_score,final_score_100,graded_at) values
      ('${ACTIVE_ATTEMPT}','${ACTIVE}','${E}','in_progress',clock_timestamp()-interval '5 minute',clock_timestamp()+interval '25 minute',null,null,null,null,null),
      ('${RESULT_ATTEMPT}','${RESULT}','${E}','graded',clock_timestamp()-interval '2 day',clock_timestamp()-interval '2 day'+interval '30 minute',clock_timestamp()-interval '2 day'+interval '20 minute','manual',8,80,clock_timestamp()-interval '1 day');
    insert into public.exam_answers(attempt_id,set_item_id,answer_payload,auto_score,final_score,feedback) values('${RESULT_ATTEMPT}','${I}','{"value":"a"}',8,8,'Em đã hoàn thành tốt.'); commit;`);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
}

async function accessible(page: Page, label: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
    label,
  ).toBeLessThanOrEqual(1);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations, label).toEqual([]);
}

test.beforeAll(setup);
test.afterAll(purge);

test("M23 responsive/a11y đủ list, waiting, attempt và result", async ({
  page,
}) => {
  await login(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/student/exams", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Kiểm tra / Thi", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("1 sẵn sàng · 1 đang thi")).toBeVisible();
    await page.getByRole("button", { name: "Vào phòng chờ" }).click();
    await expect(
      page.getByRole("heading", { name: "1. Kiểm tra âm thanh" }),
    ).toBeVisible();
    await page.waitForTimeout(300);
    await accessible(page, `list-waiting-${viewport.name}`);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    await page.waitForTimeout(300);
    if (process.env.UIUX_CAPTURE === "1")
      await page.screenshot({
        path: `C:/tmp/polymind-m23-list-${viewport.name}.png`,
        fullPage: true,
      });

    await page.goto(`/student/exams/results/${RESULT_ATTEMPT}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
    await accessible(page, `result-${viewport.name}`);
    if (process.env.UIUX_CAPTURE === "1")
      await page.screenshot({
        path: `C:/tmp/polymind-m23-result-${viewport.name}.png`,
        fullPage: true,
      });

    await page.goto(`/student/exams/${ACTIVE}/attempt/${ACTIVE_ATTEMPT}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Kỳ thi đang làm", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("timer")).toBeVisible();
    await accessible(page, `attempt-${viewport.name}`);
    if (process.env.UIUX_CAPTURE === "1")
      await page.screenshot({
        path: `C:/tmp/polymind-m23-attempt-${viewport.name}.png`,
        fullPage: true,
      });
  }
});
