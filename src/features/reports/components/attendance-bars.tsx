import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/dates";

export type AttendanceBarRow = {
  enrollmentId: string;
  fullName: string;
  /** `null` = lớp chưa có buổi nào đã qua, KHÔNG phải "chuyên cần bằng 0". */
  attendanceRate: number | null;
  /** Do view `v_at_risk_assessment_students` của DB quyết, không phải ngưỡng tự đặt. */
  atRisk: boolean;
};

/**
 * Biểu đồ chuyên cần theo học viên (`P17-T4`, `DS-037`).
 *
 * **Vì sao vẽ bằng CSS chứ không dùng `recharts`.** `recharts` có sẵn trong
 * `package.json` nhưng **chưa từng được dùng** ở `src/`. Kéo nó vào đây sẽ ép
 * `/teacher/progress` từ server component thuần thành client component và cõng
 * thêm một thư viện đồ thị đầy đủ — cho đúng một biểu đồ thanh ngang. Repo này
 * đã có tiền lệ chặn cứng chuyện đó ở `features/reports/export.ts` ("ExcelJS
 * nặng ~1MB. Chặn cứng ở đây"). Thanh CSS render thẳng trên server: không JS,
 * không hydrate, không layout shift, và tự đi theo token màu.
 *
 * **Vì sao biểu đồ này đáng tồn tại** dù bảng ngay dưới đã có cùng con số: bảng
 * xếp theo **tên**, nên nó không trả lời được câu hỏi giáo viên thật sự hỏi —
 * "ai đang đuối nhất". Biểu đồ xếp **tăng dần**, em thấp nhất nằm trên cùng.
 *
 * **Không tự đặt ngưỡng màu.** Chỉ tô khác những em mà chính view
 * `v_at_risk_assessment_students` đã đánh dấu, và luôn kèm chữ "Cần chú ý" —
 * màu không bao giờ là kênh thông tin duy nhất.
 */
export function AttendanceBars({ rows }: { rows: AttendanceBarRow[] }) {
  if (rows.length === 0) return null;

  // Chưa điểm danh buổi nào là **chưa biết**, không phải "kém nhất" — xếp xuống
  // cuối thay vì để nó chiếm chỗ của em thật sự đang đuối.
  const sorted = [...rows].sort((a, b) => {
    if (a.attendanceRate === null) return 1;
    if (b.attendanceRate === null) return -1;
    return a.attendanceRate - b.attendanceRate;
  });

  const measured = sorted.filter((row) => row.attendanceRate !== null);
  // `at()` + kiểm null tường minh: `noUncheckedIndexedAccess` đang bật, và lớp
  // chưa có buổi nào đã qua thì `measured` rỗng thật chứ không phải trường hợp lý thuyết.
  const lowest = measured.at(0);
  const highest = measured.at(-1);

  /*
   * Trình đọc màn hình nghe đúng MỘT câu này thay vì lần mò từng thanh — nên câu
   * đó phải chứa kết luận, không phải chỉ cái tên chung chung. Bảng "Chi tiết
   * từng học viên" ngay dưới là bản thay thế đầy đủ (`data-table`).
   */
  const summary =
    lowest && highest
      ? `Chuyên cần theo học viên — biểu đồ xếp từ thấp lên cao. Thấp nhất: ${lowest.fullName} ${formatPercent(lowest.attendanceRate)}. Cao nhất: ${highest.fullName} ${formatPercent(highest.attendanceRate)}. Số liệu đầy đủ ở bảng Chi tiết từng học viên bên dưới.`
      : "Chuyên cần theo học viên — biểu đồ. Lớp chưa có buổi nào đã qua nên chưa có số liệu chuyên cần.";

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle asChild className="text-base">
          <h2>Chuyên cần theo học viên</h2>
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Xếp từ thấp lên cao — em đang đuối nhất nằm trên cùng. Bảng đầy đủ ở
          ngay dưới.
        </p>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={summary} className="space-y-3">
          {sorted.map((row) => {
            const rate = row.attendanceRate;
            const width = rate === null ? 0 : Math.max(0, Math.min(100, rate));

            return (
              <div
                key={row.enrollmentId}
                data-slot="attendance-bar"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(9rem,18rem)_minmax(0,1fr)_auto]"
              >
                {/*
                  Chữ "Cần chú ý" là bản thay thế cho màu (`color-not-only`) nên
                  nó KHÔNG được phép bị cắt. Trước đây cả cụm nằm trong một `<p
                  className="truncate">` nên ảnh chụp 1280px cho ra "· Cần ch…".
                  Tách ra: tên cắt được, nhãn `shrink-0` thì không.
                */}
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="truncate text-sm font-medium">{row.fullName}</p>
                  {row.atRisk && (
                    <span className="text-warning shrink-0 text-sm">
                      Cần chú ý
                    </span>
                  )}
                </div>

                {/*
                  Rãnh nền luôn hiển thị hết chiều rộng nên mắt so được tỉ lệ;
                  nếu chỉ vẽ phần đã đạt thì không có gì để so với 100%.
                */}
                <div className="bg-muted order-last col-span-2 h-2.5 overflow-hidden rounded-full sm:order-0 sm:col-span-1">
                  <div
                    className={`h-full rounded-full ${row.atRisk ? "bg-warning" : "bg-chart-1"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>

                <p className="text-sm font-semibold tabular-nums">
                  {rate === null ? "—" : formatPercent(rate)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
