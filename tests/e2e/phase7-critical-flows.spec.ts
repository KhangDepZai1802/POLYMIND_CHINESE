import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const COURSE_TITLE = "Khóa Phase 7 E2E";
const INVOICE_ITEM = "Học phí Phase 7 E2E";
const LIFECYCLE_NAMES = [
  "HV E2E chuyển lớp",
  "HV E2E rút học",
  "HV E2E hoàn thành",
];

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu").fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

function purgeCourse() {
  sql(`delete from audit_logs where resource_id in (select id from courses where title = '${COURSE_TITLE}')`);
  sql(`delete from courses where title = '${COURSE_TITLE}'`);
}

function purgeInvoice() {
  const invoices = `(select id from tuition_invoices where note = '${INVOICE_ITEM}')`;
  sql(`delete from notifications where resource_id in ${invoices}`);
  sql(`delete from audit_logs where resource_id in ${invoices}`);
  sql(`delete from tuition_receipts where payment_id in (select id from tuition_payments where invoice_id in ${invoices})`);
  sql(`delete from tuition_payments where invoice_id in ${invoices}`);
  sql(`delete from tuition_invoice_items where invoice_id in ${invoices}`);
  sql(`delete from tuition_invoices where id in ${invoices}`);
}

function purgeLifecycle() {
  const students = `(select id from students where full_name in ('${LIFECYCLE_NAMES.join("','")}'))`;
  const enrollments = `(select id from enrollments where student_id in ${students})`;
  sql(`delete from audit_logs where resource_id in ${enrollments}`);
  sql(`delete from enrollment_status_history where enrollment_id in ${enrollments}`);
  sql(`delete from enrollments where id in ${enrollments}`);
  sql(`delete from students where id in ${students}`);
}

test.beforeEach(() => {
  purgeCourse();
  purgeInvoice();
  purgeLifecycle();
});
test.afterAll(() => {
  purgeCourse();
  purgeInvoice();
  purgeLifecycle();
});

test("scenario 1 — admin tạo khóa và kiểm chứng chuỗi setup vận hành", async ({ page }) => {
  await login(page, "admin@polymind.test");
  await page.waitForURL("**/admin");
  await page.goto("/admin/courses");
  await page.getByRole("button", { name: "Thêm khóa học" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên khóa học *").fill(COURSE_TITLE);
  await dialog.getByRole("button", { name: "Tạo khóa học" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Đã tạo khóa học "${COURSE_TITLE}".`)).toBeVisible();

  expect(sql(`select code from courses where title = '${COURSE_TITLE}'`)).toMatch(/^KH\d{6}$/);
  expect(sql(`select exists(
    select 1 from courses c
    where c.title = '${COURSE_TITLE}'
      and c.created_by = (select id from auth.users where email = 'admin@polymind.test')
  )`)).toBe("t");
  expect(
    sql(`select
      exists(select 1 from teachers) and exists(select 1 from students)
      and exists(select 1 from classes where status = 'active')
      and exists(select 1 from class_teachers)
      and exists(select 1 from enrollments where status = 'active')
      and exists(select 1 from class_sessions)`),
  ).toBe("t");
});

test("scenario 4 — admin tạo invoice, thu tiền, sinh receipt; student chỉ xem", async ({
  page,
}) => {
  await login(page, "admin@polymind.test");
  await page.waitForURL("**/admin");
  await page.goto("/admin/tuition");
  await page.getByRole("button", { name: "Tạo hóa đơn" }).click();

  const invoiceDialog = page.getByRole("dialog");
  await invoiceDialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /HV001/ }).click();
  await invoiceDialog.getByLabel("Nội dung khoản mục 1").fill(INVOICE_ITEM);
  await invoiceDialog.getByLabel("Đơn giá khoản mục 1").fill("1250000");
  await invoiceDialog.getByLabel("Ghi chú").fill(INVOICE_ITEM);
  await invoiceDialog.getByRole("button", { name: "Tạo bản nháp" }).click();
  await expect(invoiceDialog).toBeHidden();

  const invoiceCode = sql(`select i.invoice_code from tuition_invoices i
    join tuition_invoice_items item on item.invoice_id = i.id
    where item.description = '${INVOICE_ITEM}'`);
  expect(invoiceCode).toMatch(/^HD/);

  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: `Phát hành ${invoiceCode}` }).click();
  await expect(page.getByText("Đã phát hành").first()).toBeVisible();
  await page.getByRole("button", { name: "Ghi nhận thu" }).click();
  const paymentDialog = page.getByRole("dialog");
  await paymentDialog.getByRole("button", { name: "Xác nhận thanh toán" }).click();
  await expect(paymentDialog).toBeHidden();

  expect(
    sql(`select count(*) || '|' || count(r.id) || '|' || min(i.status::text)
      from tuition_payments p
      join tuition_invoices i on i.id = p.invoice_id
      left join tuition_receipts r on r.payment_id = p.id
      where i.invoice_code = '${invoiceCode}'`),
  ).toBe("1|1|paid");

  await page.context().clearCookies();
  await login(page, "hv1@polymind.test");
  await page.waitForURL("**/student");
  await page.goto("/student/tuition");
  await expect(page.getByText(invoiceCode)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ghi nhận thu" })).toHaveCount(0);
});

test("scenario 5 — pause/transfer/withdraw/completion giữ lịch sử", async ({ page }) => {
  const adminId = sql("select id from auth.users where email = 'admin@polymind.test'");
  const sourceClass = sql("select id from classes where code = 'LOP-02'");
  const targetClass = sql("select id from classes where code = 'LOP-03'");

  for (const [index, name] of LIFECYCLE_NAMES.entries()) {
    sql(`insert into students (student_code, full_name) values ('HV-P7-LIFE-${index + 1}', '${name}')`);
  }
  const actorPrefix = `select set_config('request.jwt.claims', '{"sub":"${adminId}","role":"authenticated"}', false); set role authenticated;`;
  const actorSuffix = "reset role;";
  for (const name of LIFECYCLE_NAMES) {
    sql(`${actorPrefix} select public.enroll_student(
      (select id from students where full_name = '${name}'), '${sourceClass}', 'active', 'E2E tạo ghi danh'); ${actorSuffix}`);
  }

  const transferEnrollment = sql(`select e.id from enrollments e join students s on s.id=e.student_id where s.full_name='${LIFECYCLE_NAMES[0]}'`);
  const withdrawEnrollment = sql(`select e.id from enrollments e join students s on s.id=e.student_id where s.full_name='${LIFECYCLE_NAMES[1]}'`);
  const completeEnrollment = sql(`select e.id from enrollments e join students s on s.id=e.student_id where s.full_name='${LIFECYCLE_NAMES[2]}'`);
  sql(`${actorPrefix} select public.change_enrollment_status('${transferEnrollment}', 'paused', 'Tạm nghỉ'); select public.change_enrollment_status('${transferEnrollment}', 'active', 'Học lại'); select public.transfer_enrollment('${transferEnrollment}', '${targetClass}', 'Chuyển lớp E2E'); ${actorSuffix}`);
  sql(`${actorPrefix} select public.change_enrollment_status('${withdrawEnrollment}', 'withdrawn', 'Rút học E2E'); select public.change_enrollment_status('${completeEnrollment}', 'completed', 'Hoàn thành E2E'); ${actorSuffix}`);

  expect(
    sql(`select
      (select status from enrollments where id='${transferEnrollment}') || '|'
      || (select count(*) from enrollment_status_history where enrollment_id='${transferEnrollment}') || '|'
      || (select count(*) from enrollments e join students s on s.id=e.student_id where s.full_name='${LIFECYCLE_NAMES[0]}') || '|'
      || (select status from enrollments where id='${withdrawEnrollment}') || '|'
      || (select status from enrollments where id='${completeEnrollment}')`),
  ).toBe("transferred|4|2|withdrawn|completed");

  await login(page, "admin@polymind.test");
  await page.waitForURL("**/admin");
  await page.goto("/admin/classes");
  await expect(page.getByRole("heading", { name: "Lớp học" })).toBeVisible();
  expect(
    sql(`select string_agg(old_status::text || '>' || new_status::text, ',' order by changed_at)
      from enrollment_status_history where enrollment_id='${transferEnrollment}'`),
  ).toContain("active>paused,paused>active,active>transferred");
});
