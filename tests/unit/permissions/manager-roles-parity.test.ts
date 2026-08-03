import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isManagerRole, MANAGER_ROLES, USER_ROLES } from "@/types/roles";

/**
 * `MANAGER_ROLES` (TS) và `app.is_manager()` (SQL) là HAI BẢN SAO của cùng một
 * luật. Bài kiểm này ghim chúng phải bằng nhau.
 *
 * Vì sao đáng một file riêng: lệch hai bên không gây lỗi biên dịch, không gây
 * lỗi lúc chạy, và không lộ ra ở bất kỳ bài kiểm nào khác — nó chỉ hiện thành
 * "giáo vụ bấm nút thì báo lỗi khó hiểu" (TS rộng hơn SQL), hoặc tệ hơn nhiều
 * là "app ẩn nút nhưng RLS vẫn cho ghi" (SQL rộng hơn TS), tức đúng thứ `D-13`
 * gọi là ẩn menu ≠ phân quyền.
 *
 * Cùng hình dạng với bài ghim `scripts/lib/student-username.mjs` ↔
 * `src/features/users/account.ts` của `D-42`.
 */
const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260803000087_academic_manager_rls.sql",
);

function rolesInsideIsManager(): string[] {
  const sql = readFileSync(MIGRATION, "utf8");

  const body = sql.match(
    /create or replace function app\.is_manager\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/,
  )?.[1];
  if (!body) {
    throw new Error("không tìm thấy thân hàm app.is_manager() trong migration");
  }

  const list = body.match(/app\.current_role\(\)\s+in\s*\(([^)]*)\)/)?.[1];
  if (!list) {
    throw new Error("app.is_manager() không còn dạng `current_role() in (...)`");
  }

  return [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!).sort();
}

describe("MANAGER_ROLES khớp app.is_manager() dưới DB", () => {
  it("hai danh sách trùng khít từng phần tử", () => {
    expect(rolesInsideIsManager()).toEqual([...MANAGER_ROLES].sort());
  });

  it("mọi phần tử của MANAGER_ROLES đều là role có thật", () => {
    for (const role of MANAGER_ROLES) {
      expect(USER_ROLES).toContain(role);
    }
  });

  it("isManagerRole đúng cho cả bốn role", () => {
    expect(isManagerRole("super_admin")).toBe(true);
    expect(isManagerRole("academic_manager")).toBe(true);
    expect(isManagerRole("teacher")).toBe(false);
    expect(isManagerRole("student")).toBe(false);
  });

  it("giáo vụ KHÔNG lọt vào nhóm quản trị tài khoản/audit", () => {
    // `app.is_super_admin()` phải giữ nguyên nghĩa cũ. Nếu ai đó sửa nó thành
    // "quản lý" cho tiện thì `audit_logs` và đường ghi `profiles` mở luôn cho
    // giáo vụ — đúng hai thứ user đã loại.
    const helpers = readFileSync(
      join(process.cwd(), "supabase/migrations/20260713000010_app_helpers.sql"),
      "utf8",
    );
    expect(helpers).toContain("app.current_role() = 'super_admin'");
    expect(helpers).not.toContain("academic_manager");
  });
});
