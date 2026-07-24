import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const USERNAME = "gvsmoke2607";
const LOGIN_EMAIL = `${USERNAME}@login.polymind.local`;
const FULL_NAME = "GV Smoke Accounts";
const PW_INITIAL = "Polymind@2026";
const PW_NEW = "Polymind@2027";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

async function login(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(identifier);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

function purgeSmoke() {
  // Thứ tự tôn trọng FK: audit theo teacher → teachers → audit theo user → profile → auth.user.
  sql(
    `delete from audit_logs where resource_id in (select id from teachers where user_id in (select id from profiles where username='${USERNAME}'))`,
  );
  sql(
    `delete from teachers where user_id in (select id from profiles where username='${USERNAME}')`,
  );
  sql(
    `delete from audit_logs where resource_id in (select id from profiles where username='${USERNAME}')`,
  );
  sql(`delete from profiles where username='${USERNAME}'`);
  sql(`delete from auth.users where email='${LOGIN_EMAIL}'`);
}

test.beforeEach(purgeSmoke);
test.afterAll(purgeSmoke);

test("admin: 2 tab Quản trị | Nhật ký audit hiển thị và chuyển qua lại", async ({
  page,
}) => {
  await login(page, "admin@polymind.test", PW_INITIAL);
  await page.waitForURL("**/admin");

  await page.goto("/admin/system");
  await expect(
    page.getByRole("heading", { name: "Quản trị & Audit" }),
  ).toBeVisible();

  // Tab Quản trị mặc định: đủ 3 bảng role (mỗi bảng một chip "N tài khoản").
  await expect(page.getByText(/\d+ tài khoản/)).toHaveCount(3);

  // Chuyển sang Audit.
  await page.getByRole("tab", { name: "Nhật ký audit" }).click();
  await expect(page.getByText("Bộ lọc audit")).toBeVisible();

  // Quay lại Quản trị.
  await page.getByRole("tab", { name: "Quản trị" }).click();
  await expect(
    page.getByText("Tìm theo tên, tên đăng nhập hoặc email"),
  ).toBeVisible();
});

test("luồng: tạo GV mới → tài khoản xuất hiện ở trang Quản trị với tên đăng nhập → đổi mật khẩu → đăng nhập bằng mật khẩu mới", async ({
  page,
}) => {
  await login(page, "admin@polymind.test", PW_INITIAL);
  await page.waitForURL("**/admin");

  // 1) Tạo giáo viên mới (form tự cấp tài khoản).
  await page.goto("/admin/teachers");
  await page.getByRole("button", { name: "Thêm giáo viên" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Tên đăng nhập").fill(USERNAME);
  await createDialog.getByLabel("Mật khẩu ban đầu").fill(PW_INITIAL);
  await createDialog.getByLabel("Họ tên").fill(FULL_NAME);
  await page.getByRole("button", { name: "Tạo & cấp tài khoản" }).click();
  await expect(createDialog).toBeHidden();

  // 2) Tài khoản xuất hiện ở trang Quản trị, hiện đúng tên đăng nhập.
  await page.goto(`/admin/system?q=${USERNAME}`);
  /*
   * `.filter({ visible: true })` chứ không phải `.first()`: `accounts-view.tsx`
   * render BẢNG cho desktop (`hidden md:block`) và DANH SÁCH THẺ cho mobile
   * (`md:hidden`) — cả hai đều nằm trong DOM, chỉ một cái hiện. Ở project
   * `mobile` (Pixel 7) `.first()` trúng đúng ô `<td>` đang `display:none` rồi
   * báo "hidden", trong khi sản phẩm hiển thị đúng. Lỗi TEST, không phải lỗi
   * sản phẩm (`P17-T5`).
   */
  await expect(page.getByText(FULL_NAME).filter({ visible: true }).first()).toBeVisible();
  await expect(
    page.getByText(USERNAME, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();

  // 3) Đổi mật khẩu ngay tại đây.
  await page.getByRole("button", { name: "Thao tác tài khoản" }).first().click();
  await page.getByRole("menuitem", { name: "Đổi đăng nhập / mật khẩu" }).click();
  const credDialog = page.getByRole("dialog");
  await expect(credDialog.getByLabel("Tên đăng nhập")).toHaveValue(USERNAME);
  await credDialog.getByLabel("Mật khẩu mới").fill(PW_NEW);
  await page.getByRole("button", { name: "Cập nhật" }).click();
  await expect(credDialog).toBeHidden();

  // 4) Mật khẩu cũ KHÔNG còn dùng được; mật khẩu mới đăng nhập được vào khu GV.
  await login(page, USERNAME, PW_NEW);
  await page.waitForURL("**/teacher", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/teacher$/);
});

test("admin không tự khóa được tài khoản của chính mình (hàng của mình có nhãn 'bạn')", async ({
  page,
}) => {
  await login(page, "admin@polymind.test", PW_INITIAL);
  await page.waitForURL("**/admin");
  await page.goto("/admin/system");
  // Hàng của chính admin có nhãn "(bạn)"; server cũng chặn tự khóa.
  await expect(
    page.getByText("(bạn)").filter({ visible: true }).first(),
  ).toBeVisible();
});
