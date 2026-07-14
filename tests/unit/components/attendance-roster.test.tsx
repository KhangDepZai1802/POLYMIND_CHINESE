import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Server action kéo theo next/headers + supabase server client → không chạy được
// trong jsdom. Test này soi thứ FORM GỬI LÊN, không phải việc action làm gì.
vi.mock("@/features/attendance/server/actions", () => ({
  saveAttendanceAction: vi.fn(),
}));

import { AttendanceRoster } from "@/features/attendance/components/attendance-roster";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const ENROLLMENT_A = "22222222-2222-4222-8222-222222222221";
const ENROLLMENT_B = "22222222-2222-4222-8222-222222222222";
const ENROLLMENT_C = "22222222-2222-4222-8222-222222222223";

const ROSTER = [
  {
    enrollmentId: ENROLLMENT_A,
    studentName: "Nguyễn Văn A",
    studentCode: "HV001",
    status: null,
    note: "",
  },
  {
    enrollmentId: ENROLLMENT_B,
    studentName: "Trần Thị B",
    studentCode: "HV002",
    status: null,
    note: "",
  },
  {
    enrollmentId: ENROLLMENT_C,
    studentName: "Lê Văn C",
    studentCode: "HV003",
    status: null,
    note: "",
  },
];

function renderRoster() {
  const { container } = render(
    <AttendanceRoster sessionId={SESSION_ID} roster={ROSTER} />,
  );
  const form = container.querySelector("form");
  if (!form) throw new Error("Không tìm thấy form điểm danh");

  return {
    form,
    /** Đúng những gì trình duyệt sẽ POST lên server. */
    payload: () => Object.fromEntries(new FormData(form).entries()),
  };
}

describe("AttendanceRoster — chưa chọn ≠ vắng", () => {
  beforeEach(() => vi.clearAllMocks());

  it("KHÔNG gửi field trạng thái cho học viên chưa được điểm danh", async () => {
    const { payload } = renderRoster();

    // Giáo viên mở roster rồi bấm Lưu luôn mà chưa chọn ai.
    const sent = payload();

    // Nếu component mặc định 'absent' thì cả lớp bị đánh vắng oan chỉ vì một cú
    // bấm Lưu. Không có field = server bỏ qua = "chưa điểm danh".
    const statusKeys = Object.keys(sent).filter((key) =>
      key.startsWith("status_"),
    );
    expect(statusKeys).toEqual([]);
    expect(sent["session_id"]).toBe(SESSION_ID);
  });

  it("'Tất cả có mặt' rồi sửa một người thành Vắng → gửi đúng 3 trạng thái", async () => {
    const user = userEvent.setup();
    const { payload } = renderRoster();

    await user.click(screen.getByRole("button", { name: /Tất cả có mặt/ }));

    // Sửa riêng Trần Thị B thành Vắng.
    const rowB = screen.getByText("Trần Thị B").closest("li");
    if (!rowB) throw new Error("Không tìm thấy dòng của Trần Thị B");
    await user.click(
      within(rowB).getByRole("button", { name: /^Vắng$/ }),
    );

    const sent = payload();
    expect(sent[`status_${ENROLLMENT_A}`]).toBe("present");
    expect(sent[`status_${ENROLLMENT_B}`]).toBe("absent");
    expect(sent[`status_${ENROLLMENT_C}`]).toBe("present");
  });

  it("đếm đúng số người còn lại chưa điểm danh", async () => {
    const user = userEvent.setup();
    renderRoster();

    expect(screen.getByText(/còn 3 người chưa điểm danh/i)).toBeInTheDocument();

    const rowA = screen.getByText("Nguyễn Văn A").closest("li");
    if (!rowA) throw new Error("Không tìm thấy dòng của Nguyễn Văn A");
    await user.click(within(rowA).getByRole("button", { name: /Có mặt/ }));

    expect(screen.getByText(/còn 2 người chưa điểm danh/i)).toBeInTheDocument();
  });
});
