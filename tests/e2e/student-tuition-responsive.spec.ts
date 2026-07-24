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
/*
 * Tra theo MÃ LỚP chứ không hard-code UUID. `seed.sql` insert `public.classes`
 * mà KHÔNG chỉ định `id`, nên UUID sinh mới sau **mỗi lần `db reset`** — bản cũ
 * ghim '7dd9b79a-997b-4c14-a627-2165422eaccc' nên chỉ chạy được trên DB
 * chưa reset, reset xong là cả file không nạp nổi (`P17-T5`). `code` là khóa
 * nghiệp vụ ổn định, seed luôn tạo 'LOP-02'.
 */
const CLASS_ID = sql(`select id from public.classes where code = 'LOP-02';`);

const PAID_INVOICE_ID = "e2600000-0000-4000-8000-000000000001";
const OVERDUE_INVOICE_ID = "e2600000-0000-4000-8000-000000000002";
const PAYMENT_ID = "e2600000-0000-4000-8000-000000000003";

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
    delete from public.tuition_payments where id = '${PAYMENT_ID}';
    delete from public.tuition_invoice_items
      where invoice_id in ('${PAID_INVOICE_ID}', '${OVERDUE_INVOICE_ID}');
    delete from public.tuition_invoices
      where id in ('${PAID_INVOICE_ID}', '${OVERDUE_INVOICE_ID}');
    set session_replication_role = origin;
  `);
}

function setupFixture() {
  purgeFixture();
  sql(`
    begin;
    -- Hóa đơn 1: có giảm trừ, đã thu một phần, còn trong hạn.
    insert into public.tuition_invoices (
      id, invoice_code, student_id, enrollment_id, class_id,
      issue_date, due_date, subtotal, discount, total, status, note, created_by
    ) values (
      '${PAID_INVOICE_ID}', 'HD-M25-0001', '${STUDENT_ID}', '${ENROLLMENT_ID}',
      '${CLASS_ID}', current_date - 10, current_date + 20,
      3000000, 500000, 2500000, 'partial',
      'Đã áp dụng ưu đãi học viên cũ.', '${TEACHER_USER_ID}'
    );
    insert into public.tuition_invoice_items (
      invoice_id, description, quantity, unit_amount, line_total
    ) values (
      '${PAID_INVOICE_ID}', 'Học phí khóa HSK 1', 1, 3000000, 3000000
    );
    insert into public.tuition_payments (
      id, payment_code, invoice_id, student_id, amount, paid_at, method,
      reference, note, recorded_by
    ) values (
      '${PAYMENT_ID}', 'TT-M25-0001', '${PAID_INVOICE_ID}', '${STUDENT_ID}',
      1000000, clock_timestamp() - interval '5 day', 'bank_transfer',
      'FT26071500123', 'Chuyển khoản đợt 1.', '${TEACHER_USER_ID}'
    );

    -- Hóa đơn 2: quá hạn, chưa thu đồng nào.
    insert into public.tuition_invoices (
      id, invoice_code, student_id, enrollment_id, class_id,
      issue_date, due_date, subtotal, discount, total, status, note, created_by
    ) values (
      '${OVERDUE_INVOICE_ID}', 'HD-M25-0002', '${STUDENT_ID}', '${ENROLLMENT_ID}',
      '${CLASS_ID}', current_date - 60, current_date - 5,
      1200000, 0, 1200000, 'overdue', null, '${TEACHER_USER_ID}'
    );
    insert into public.tuition_invoice_items (
      invoice_id, description, quantity, unit_amount, line_total
    ) values (
      '${OVERDUE_INVOICE_ID}', 'Phí tài liệu học kỳ', 2, 600000, 1200000
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

test("Học phí hiện đủ số tiền, hạn và phiếu thu ở ba màn", async ({ page }) => {
  await loginStudent(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/student/tuition", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Học phí", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tổng quan học phí", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Hóa đơn của bạn (2)", level: 2 }),
    ).toBeVisible();

    // Tổng 3.700.000, đã đóng 1.000.000 → 27%.
    const bar = page.getByRole("progressbar", {
      name: "Tiến độ đóng học phí",
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "27");

    // Giảm trừ vốn bị truy vấn rồi bỏ không — nay phải thấy.
    await expect(page.getByText("Giảm trừ")).toBeVisible();

    // Cảnh báo quá hạn nêu đúng số lượng.
    await expect(page.getByText(/1 hóa đơn đã quá hạn/)).toBeVisible();

    // Phiếu thu đọc được, không còn 12px.
    await expect(page.getByText("TT-M25-0001")).toBeVisible();
    await expect(page.getByText(/Tham chiếu: FT26071500123/)).toBeVisible();

    await expectAccessibleAndContained(page, `tuition-${viewport.name}`);

    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m26-tuition-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }
});

test("Hóa đơn không có giảm trừ thì không thêm dòng gây nhiễu", async ({
  page,
}) => {
  await loginStudent(page);
  await page.setViewportSize(viewports[2]);
  await page.goto("/student/tuition", { waitUntil: "domcontentloaded" });

  // Hai hóa đơn, chỉ một cái có giảm trừ → đúng một cặp Tạm tính/Giảm trừ.
  await expect(page.getByText("Tạm tính")).toHaveCount(1);
  await expect(page.getByText("Giảm trừ")).toHaveCount(1);
  // 3 = nhãn ô tóm tắt "Tổng hóa đơn" + một dòng trong mỗi hóa đơn.
  await expect(page.getByText("Tổng hóa đơn")).toHaveCount(3);
});
