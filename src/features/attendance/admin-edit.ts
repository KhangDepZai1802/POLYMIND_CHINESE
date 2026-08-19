import { z } from "zod";

import { ATTENDANCE_STATUSES } from "./status-display";

/**
 * Phần TÍNH TOÁN THUẦN của việc admin sửa điểm danh (`ADMIN-ATTENDANCE-1`).
 *
 * Không đụng DB, không đụng React — để unit test ghim được luật gom nhóm và
 * luật "đổi thật hay không" mà không cần dựng cả Supabase lẫn trình duyệt.
 */

export const attendanceChangeSchema = z.object({
  session_id: z.uuid(),
  enrollment_id: z.uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  /** Ghi chú rỗng và ghi chú không có là MỘT — cả hai đi xuống DB thành `null`. */
  note: z.string().trim().max(300).optional(),
});

export type AttendanceChange = z.infer<typeof attendanceChangeSchema>;

export const attendanceChangeListSchema = z
  .array(attendanceChangeSchema)
  // Trần 2.000 ô/lượt: lớp lớn nhất hiện có là 35 buổi × 26 học viên = 910 ô,
  // nên trần này không bao giờ chạm trong vận hành thật. Nó ở đây để một
  // payload dựng tay không bắt DB lặp vô hạn.
  .max(2000);

export type SessionChangeGroup = {
  session_id: string;
  records: { enrollment_id: string; status: string; note?: string }[];
};

/**
 * Gom các ô đã sửa theo BUỔI — đúng hình dạng mà `admin_override_attendance`
 * nhận (`[{session_id, records:[…]}]`).
 *
 * 🔴 KHỬ TRÙNG THEO `(buổi, ghi danh)`, GIỮ Ô CUỐI CÙNG.
 *
 * Người dùng bấm một ô ba lần (V → P → ✓) trước khi bấm Lưu là chuyện thường.
 * Gửi cả ba xuống thì RPC upsert ba lần cho một hàng: kết quả cuối vẫn đúng,
 * nhưng con số "đã sửa N ô" báo lên màn hình sai gấp ba, và phép so
 * `before = after` để chống ghi trùng của RPC vẫn chạy trên một payload phình
 * ra vô ích. Trạng thái người dùng đang NHÌN THẤY là ô cuối cùng — đó mới là
 * thứ họ định lưu.
 */
export function groupChangesBySession(
  changes: readonly AttendanceChange[],
): SessionChangeGroup[] {
  const latest = new Map<string, AttendanceChange>();
  for (const change of changes) {
    latest.set(`${change.session_id}:${change.enrollment_id}`, change);
  }

  const bySession = new Map<string, SessionChangeGroup["records"]>();
  for (const change of latest.values()) {
    const records = bySession.get(change.session_id) ?? [];
    // ⚠️ TỰ CẮT TRẮNG, không tin người gọi đã cắt hộ.
    //
    // Đường đi qua server action thì zod `.trim()` chạy trước nên `"   "` đã
    // thành `""`; nhưng hàm này là hàm thuần được gọi trực tiếp ở nơi khác, và
    // một chuỗi toàn dấu cách LỌT XUỐNG DB là một ghi chú "có nội dung" theo
    // mọi phép kiểm phía sau — ô sẽ mang `title` rỗng và bản in ra một gạch nối
    // cụt. Bài unit test bắt đúng ca này.
    const note = change.note?.trim();
    records.push({
      enrollment_id: change.enrollment_id,
      status: change.status,
      ...(note ? { note } : {}),
    });
    bySession.set(change.session_id, records);
  }

  return [...bySession.entries()].map(([session_id, records]) => ({
    session_id,
    records,
  }));
}

export type OverrideResult = {
  sessions: number;
  records: number;
  reports_resynced: number;
};

/**
 * Câu thông báo sau khi lưu.
 *
 * 🔴 `sessions = 0` KHÔNG PHẢI LỖI và cũng không được báo "Đã lưu".
 *
 * RPC bỏ qua buổi nào gửi lại y nguyên trạng thái cũ. Nói "đã lưu 0 thay đổi"
 * thì người dùng tưởng hệ thống nuốt mất thao tác; nói "đã lưu" trơn thì họ
 * tưởng vừa ghi đè một thứ mà thực ra không có gì đổi. Nói đúng chuyện đã xảy ra.
 */
export function describeOverrideResult(result: OverrideResult): string {
  if (result.sessions === 0) {
    return "Không có gì thay đổi — các ô đang giữ đúng trạng thái cũ.";
  }

  const base = `Đã lưu ${result.records} ô điểm danh ở ${result.sessions} buổi.`;

  if (result.reports_resynced > 0) {
    return `${base} ${result.reports_resynced} báo cáo đã gửi được cập nhật lại số liệu chuyên cần.`;
  }

  return base;
}

/**
 * Kết quả RPC về từ PostgREST là `unknown` — ép kiểu thẳng là tin một giá trị
 * đi qua mạng. Đọc từng trường, thiếu thì về 0.
 */
export function parseOverrideResult(raw: unknown): OverrideResult {
  const value = (raw ?? {}) as Record<string, unknown>;
  const num = (key: string) => {
    const parsed = Number(value[key]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    sessions: num("sessions"),
    records: num("records"),
    reports_resynced: num("reports_resynced"),
  };
}
