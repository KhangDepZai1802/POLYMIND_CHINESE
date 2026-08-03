import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTeacherAction,
  resetTeacherPasswordAction,
} from "@/features/teachers/server/actions";
import { provisionPasswordAccount } from "@/features/users/server/account";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// `@/lib/audit` và `@/features/users/server/invite` kéo theo `server-only`,
// module này ném lỗi ngay lúc import trong môi trường jsdom của vitest.
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/features/users/server/invite", () => ({ setUserActive: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireRole: vi.fn(),
  requireManager: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/features/users/server/account", () => ({
  provisionPasswordAccount: vi.fn(),
}));

const TEACHER_ID = "33333333-3333-4333-8333-333333333331";
const USER_ID = "44444444-4444-4444-8444-444444444441";

/**
 * Vai trò trong `profiles` phải sống sót qua các thao tác KHÔNG nói gì về vai trò.
 *
 * `provisionPasswordAccount` upsert thẳng cột `role`, nên mọi lời gọi nó đều là
 * một lần ghi đè vai trò — kể cả khi người gọi chỉ định đổi mật khẩu. Từ khi có
 * giáo vụ (`D-2`), bảng `teachers` chứa CẢ giáo viên lẫn giáo vụ, nên chỗ này
 * không còn được đoán bừa là "teacher".
 */
describe("trang Giáo viên không được lặng lẽ đổi vai trò", () => {
  const logAuditQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => logAuditQuery),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never);
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({
            data: { id: TEACHER_ID, teacher_code: "GV009" },
            error: null,
          }),
      })),
      auth: { admin: { deleteUser: vi.fn() } },
    } as never);
    vi.mocked(provisionPasswordAccount).mockResolvedValue({
      ok: true,
      userId: USER_ID,
      created: true,
    } as never);
  });

  it("đổi mật khẩu cho GIÁO VỤ giữ nguyên vai trò academic_manager", async () => {
    // Trước khi sửa, chỗ này đóng cứng `role: "teacher"` ⇒ thao tác đổi mật
    // khẩu hạ giáo vụ xuống giáo viên. Không có lỗi nào được ném, toast vẫn báo
    // thành công; người bị hạ chỉ biết ở lần đăng nhập sau khi menu Quản lý
    // biến mất.
    logAuditQuery.maybeSingle.mockResolvedValue({
      data: {
        id: TEACHER_ID,
        user_id: USER_ID,
        profile: {
          full_name: "Giáo vụ Vũ",
          phone: null,
          email: null,
          role: "academic_manager",
        },
      },
      error: null,
    });

    const fd = new FormData();
    fd.set("id", TEACHER_ID);
    fd.set("username", "vu.giaovu");
    fd.set("password", "Polymind@2026");

    await resetTeacherPasswordAction({}, fd);

    expect(provisionPasswordAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: "academic_manager" }),
    );
  });

  it("đổi mật khẩu cho giáo viên thường vẫn là teacher", async () => {
    logAuditQuery.maybeSingle.mockResolvedValue({
      data: {
        id: TEACHER_ID,
        user_id: USER_ID,
        profile: {
          full_name: "Giáo viên A",
          phone: null,
          email: null,
          role: "teacher",
        },
      },
      error: null,
    });

    const fd = new FormData();
    fd.set("id", TEACHER_ID);
    fd.set("username", "a.giaovien");
    fd.set("password", "Polymind@2026");

    await resetTeacherPasswordAction({}, fd);

    expect(provisionPasswordAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: "teacher" }),
    );
  });

  it("tạo mới: chọn Giáo vụ thì cấp đúng academic_manager", async () => {
    const fd = new FormData();
    fd.set("account_role", "academic_manager");
    fd.set("username", "vu.giaovu");
    fd.set("password", "Polymind@2026");
    fd.set("email", "");
    fd.set("full_name", "Giáo vụ Vũ");
    fd.set("phone", "");
    fd.set("specialization", "");
    fd.set("bio", "");

    await createTeacherAction({}, fd);

    expect(provisionPasswordAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: "academic_manager" }),
    );
  });

  it("tạo mới: không chọn gì thì mặc định là teacher, KHÔNG phải giáo vụ", async () => {
    // Fail-closed ở tầng form: thiếu field không được rơi vào vai trò nhiều
    // quyền hơn.
    const fd = new FormData();
    fd.set("username", "b.giaovien");
    fd.set("password", "Polymind@2026");
    fd.set("email", "");
    fd.set("full_name", "Giáo viên B");
    fd.set("phone", "");
    fd.set("specialization", "");
    fd.set("bio", "");

    await createTeacherAction({}, fd);

    expect(provisionPasswordAccount).toHaveBeenCalledWith(
      expect.objectContaining({ role: "teacher" }),
    );
  });
});
