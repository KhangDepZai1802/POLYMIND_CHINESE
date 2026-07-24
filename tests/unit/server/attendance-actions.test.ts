import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveAttendanceAction } from "@/features/attendance/server/actions";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ENROLLMENT_A = "22222222-2222-4222-8222-222222222221";
const ENROLLMENT_B = "22222222-2222-4222-8222-222222222222";

function formOf(entries: Record<string, string>) {
  const fd = new FormData();
  fd.set("session_id", SESSION_ID);
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

describe("saveAttendanceAction — ghi chú không được rơi im lặng", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    rpc.mockResolvedValue({ data: 2, error: null });
  });

  it("ghi chú mà quên chọn trạng thái → BÁO LỖI, không lưu gì cả", async () => {
    // Trước khi sửa: vòng lặp chỉ đọc field `status_*`, nên `note_B` không bao
    // giờ được đọc tới. Giáo viên gõ "xin nghỉ, mẹ báo ốm" rồi bấm Lưu → toast
    // báo THÀNH CÔNG trong khi ghi chú đã bốc hơi.
    const result = await saveAttendanceAction(
      {},
      formOf({
        [`status_${ENROLLMENT_A}`]: "present",
        [`note_${ENROLLMENT_B}`]: "xin nghỉ, mẹ báo ốm",
      }),
    );

    expect(result.error).toMatch(/chưa chọn trạng thái/i);
    expect(result.success).toBeUndefined();
    // Chặn cả lượt lưu: không được lưu A rồi lặng lẽ bỏ ghi chú của B.
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ghi chú đi kèm trạng thái → lưu bình thường", async () => {
    const result = await saveAttendanceAction(
      {},
      formOf({
        [`status_${ENROLLMENT_A}`]: "present",
        [`note_${ENROLLMENT_A}`]: "đến sớm 10 phút",
        [`status_${ENROLLMENT_B}`]: "absent",
        [`note_${ENROLLMENT_B}`]: "xin nghỉ, mẹ báo ốm",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("bulk_mark_attendance", {
      p_session_id: SESSION_ID,
      p_records: [
        {
          enrollment_id: ENROLLMENT_A,
          status: "present",
          note: "đến sớm 10 phút",
        },
        {
          enrollment_id: ENROLLMENT_B,
          status: "absent",
          note: "xin nghỉ, mẹ báo ốm",
        },
      ],
    });
  });

  it("ô ghi chú để trống thì không tính là ghi chú bị bỏ quên", async () => {
    // Mọi hàng đều render một ô `note_*`; rỗng là trạng thái bình thường nhất,
    // không được biến thành lỗi chặn người dùng.
    const result = await saveAttendanceAction(
      {},
      formOf({
        [`status_${ENROLLMENT_A}`]: "present",
        [`note_${ENROLLMENT_A}`]: "",
        [`note_${ENROLLMENT_B}`]: "   ",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("không chọn ai và không ghi chú gì → vẫn là lỗi 'chưa chọn trạng thái cho học viên nào'", async () => {
    const result = await saveAttendanceAction({}, formOf({}));

    expect(result.error).toBe("Chưa chọn trạng thái cho học viên nào.");
    expect(rpc).not.toHaveBeenCalled();
  });
});
