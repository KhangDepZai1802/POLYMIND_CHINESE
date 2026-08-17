"use client";

import { useTransition } from "react";
import { CalendarX2, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setSessionReportWaiverAction } from "../server/actions";

/**
 * "Không cần báo cáo" — nút của GIÁO VỤ (`TEACHER-REPORT-5`).
 *
 * =============================================================================
 * VÌ SAO CÓ CẢ CHIỀU BỎ ĐÁNH DẤU
 * =============================================================================
 *
 * Bấm nhầm là buổi đó rời khỏi hàng đợi của giáo viên và khỏi con số nợ trên
 * tab — tức biến mất khỏi mọi màn hình còn lại. Một hành động chỉ có chiều đi là
 * đúng cái *ngõ cụt không có đường ra* mà `UX-MOBILE-3` đã tốn một phiên để sửa.
 * Cùng một action, cùng một RPC, chỉ khác cờ `waived`.
 *
 * =============================================================================
 * 🔴 KHÔNG CÓ HỘP THOẠI "BẠN CHẮC CHƯA?"
 * =============================================================================
 *
 * Việc này **có đường lùi ngay tại chỗ** (nút bên cạnh) và không xoá dữ liệu
 * nào — thêm một lần bấm xác nhận cho mỗi buổi chỉ làm giáo vụ phải bấm hai lần
 * cho một việc họ đang làm hàng loạt. Dấu vết thì vẫn đủ: `audit_logs` ghi ai
 * bấm, lúc nào.
 */
export function WaiveReportButton({
  sessionId,
  waived,
  label,
}: {
  sessionId: string;
  /** Trạng thái HIỆN TẠI của buổi — nút làm điều ngược lại. */
  waived: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = waived ? Undo2 : CalendarX2;
  const text = label ?? (waived ? "Cần báo cáo lại" : "Không cần báo cáo");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const body = new FormData();
          body.set("session_id", sessionId);
          // Gửi trạng thái MUỐN ĐẶT, không gửi "hãy đảo lại": hai tab mở song
          // song mà cùng bấm "đảo" thì buổi học về đúng chỗ cũ, không ai biết.
          body.set("waived", String(!waived));
          const result = await setSessionReportWaiverAction(body);
          if (result.error) toast.error(result.error);
          else toast.success(result.success ?? "Đã cập nhật.");
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
      {text}
    </Button>
  );
}
