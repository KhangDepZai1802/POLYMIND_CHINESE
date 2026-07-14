import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const TITLE = "Bài tập VERIFY guard";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function purge() {
  sql(`update assignments set status = 'draft', published_at = null where title = '${TITLE}'`);
  sql(`delete from assignments where title = '${TITLE}'`);
}

test.beforeEach(purge);
test.afterAll(purge);

/**
 * Xác minh độc lập BUG-M08-001 + BUG-M11-002 (fix của Codex: guard UUID).
 *
 * Góc soi riêng: rủi ro thật của việc thêm guard **không phải** là "URL rác còn
 * 500", mà là **guard chặn nhầm đường đi đúng**. Nên kiểm đủ ba ca, không chỉ ca
 * Codex đã test.
 */
test("guard UUID: URL rác 404 · lớp khác 404 · nhưng lớp MÌNH vẫn mở được", async ({
  page,
}) => {
  const ownSession = sql(
    `select cs.id from class_sessions cs join classes c on c.id = cs.class_id
     where c.code = 'LOP-02' order by cs.session_number limit 1`,
  );
  const foreignSession = sql(
    `select cs.id from class_sessions cs join classes c on c.id = cs.class_id
     where c.code = 'LOP-03' order by cs.session_number limit 1`,
  );

  const ownAssignment = sql(
    `insert into assignments (class_id, title, max_score, created_by)
     values ((select id from classes where code = 'LOP-02'), '${TITLE}', 100,
             (select id from auth.users where email = 'gv.a@polymind.test'))
     returning id`,
  );
  sql(
    `update assignments set status = 'published', published_at = now() where id = '${ownAssignment}'`,
  );

  await page.goto("/login");
  await page.fill('input[name="email"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  // 1) URL rác → 404, KHÔNG phải 500 kèm stack (đúng bug Codex sửa).
  for (const url of [
    "/teacher/sessions/khong-phai-uuid",
    "/teacher/assignments/khong-phai-uuid",
    "/teacher/sessions/123",
    "/teacher/assignments/../etc",
  ]) {
    const response = await page.goto(url);
    expect(response?.status(), `URL rác phải 404: ${url}`).toBe(404);
  }

  // 2) UUID hợp lệ nhưng thuộc lớp GV khác → vẫn 404 (guard không được nới IDOR).
  const foreign = await page.goto(`/teacher/sessions/${foreignSession}`);
  expect(foreign?.status()).toBe(404);

  // 3) REGRESSION: lớp của chính mình vẫn phải mở được bình thường.
  const ownSessionResponse = await page.goto(`/teacher/sessions/${ownSession}`);
  expect(ownSessionResponse?.status()).toBe(200);
  await expect(page.getByText("LOP-02").first()).toBeVisible();

  const ownAssignmentResponse = await page.goto(
    `/teacher/assignments/${ownAssignment}`,
  );
  expect(ownAssignmentResponse?.status()).toBe(200);
  await expect(page.getByText(TITLE).first()).toBeVisible();

  purge();
});
