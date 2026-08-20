import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireManager: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { deleteAllSessionsAction } from "@/features/schedules/server/actions";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const CLASS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const S3 = "33333333-3333-4333-8333-333333333333";

function formOf() {
  const fd = new FormData();
  fd.set("class_id", CLASS_ID);
  return fd;
}

/**
 * Mock đúng hình dạng builder của supabase-js: mọi bước trả về chính nó, và
 * bản thân builder là thenable — `await` ở bước cuối mới ra kết quả.
 */
function createSupabaseMock(options: {
  scheduled: string[];
  attended: string[];
  rescheduled: string[];
  deleteError?: { code: string; message: string };
}) {
  const deletedIds: string[] = [];
  const rpc = vi.fn(async () => ({ data: null, error: null }));

  const from = vi.fn((table: string) => {
    if (table === "class_sessions") {
      let isDelete = false;
      const chain = {
        select: () => chain,
        eq: () => chain,
        delete: () => {
          isDelete = true;
          return chain;
        },
        in: (_column: string, ids: string[]) => {
          if (isDelete) deletedIds.push(...ids);
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            isDelete
              ? { data: null, error: options.deleteError ?? null }
              : {
                  data: options.scheduled.map((id) => ({ id })),
                  error: null,
                },
          ).then(resolve),
      };
      return chain;
    }

    const rows =
      table === "attendance_records"
        ? options.attended.map((id) => ({ session_id: id }))
        : options.rescheduled.map((id) => ({ source_session_id: id }));

    const chain = {
      select: () => chain,
      in: () => chain,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return chain;
  });

  return { client: { from, rpc }, deletedIds, rpc };
}

describe("deleteAllSessionsAction — một buổi vướng không được làm hỏng cả mẻ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireManager).mockResolvedValue(undefined as never);
  });

  it("bỏ buổi có vết xếp lịch bù ra khỏi mẻ xóa thay vì để DB ném 23503", async () => {
    // Trước khi sửa: buổi S2 là gốc của một lần "Nghỉ học / xếp lịch bù" nên FK
    // `class_session_schedule_changes.source_session_id` (ON DELETE RESTRICT)
    // chặn nó. DELETE là MỘT câu lệnh ⇒ cả S1 và S3 rollback theo, người dùng
    // chỉ thấy "dữ liệu đang được sử dụng ở nơi khác". Đo thật trên LOP-01.
    const mock = createSupabaseMock({
      scheduled: [S1, S2, S3],
      attended: [],
      rescheduled: [S2],
    });
    vi.mocked(createClient).mockResolvedValue(mock.client as never);

    const result = await deleteAllSessionsAction({}, formOf());

    expect(result.error).toBeUndefined();
    expect(mock.deletedIds).toEqual([S1, S3]);
    expect(result.success).toContain("Đã xóa 2 buổi chưa dạy.");
    expect(result.success).toMatch(/1 buổi có vết xếp lịch bù/);
  });

  it("đếm riêng hai lý do giữ lại, không gộp thành một con số", async () => {
    const mock = createSupabaseMock({
      scheduled: [S1, S2, S3],
      attended: [S1],
      rescheduled: [S2],
    });
    vi.mocked(createClient).mockResolvedValue(mock.client as never);

    const result = await deleteAllSessionsAction({}, formOf());

    expect(mock.deletedIds).toEqual([S3]);
    expect(result.success).toMatch(/1 buổi đã có điểm danh/);
    expect(result.success).toMatch(/1 buổi có vết xếp lịch bù/);
    expect(mock.rpc).toHaveBeenCalledWith(
      "log_audit",
      expect.objectContaining({
        p_action: "class.session.delete_all",
        p_after: { deleted: 1, kept_attendance: 1, kept_reschedule: 1 },
      }),
    );
  });

  it("buổi vừa có điểm danh vừa có vết lịch bù chỉ được đếm MỘT lần", async () => {
    // Không khử trùng thì thông báo nói giữ lại 2 buổi trong khi chỉ có 1 —
    // con số sai làm người dùng đi tìm một buổi không tồn tại.
    const mock = createSupabaseMock({
      scheduled: [S1, S2],
      attended: [S1],
      rescheduled: [S1],
    });
    vi.mocked(createClient).mockResolvedValue(mock.client as never);

    const result = await deleteAllSessionsAction({}, formOf());

    expect(mock.deletedIds).toEqual([S2]);
    expect(result.success).toMatch(/1 buổi đã có điểm danh/);
    expect(result.success).not.toMatch(/vết xếp lịch bù/);
  });

  it("không còn buổi nào xóa được thì nói rõ lý do, không báo 'đã xóa 0 buổi'", async () => {
    const mock = createSupabaseMock({
      scheduled: [S1, S2],
      attended: [S1],
      rescheduled: [S2],
    });
    vi.mocked(createClient).mockResolvedValue(mock.client as never);

    const result = await deleteAllSessionsAction({}, formOf());

    expect(mock.deletedIds).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.success).toMatch(/Không xóa buổi nào/);
    expect(result.success).toMatch(/1 buổi đã có điểm danh/);
    expect(result.success).toMatch(/1 buổi có vết xếp lịch bù/);
  });

  it("lớp không có buổi chưa dạy nào thì không gọi delete", async () => {
    const mock = createSupabaseMock({
      scheduled: [],
      attended: [],
      rescheduled: [],
    });
    vi.mocked(createClient).mockResolvedValue(mock.client as never);

    const result = await deleteAllSessionsAction({}, formOf());

    expect(result.success).toBe("Không có buổi nào chưa dạy để xóa.");
    expect(mock.deletedIds).toEqual([]);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
