import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Server action kéo theo next/headers + supabase server client → không chạy được
// trong jsdom. Test này soi thứ FORM GỬI LÊN, không phải việc action làm gì.
vi.mock("@/features/attendance/server/actions", () => ({
  saveAttendanceAction: vi.fn(),
}));

import { AttendanceRoster } from "@/features/attendance/components/attendance-roster";
import { ConfirmationProvider } from "@/components/shared/confirmation-provider";

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

// `AttendanceRoster` hỏi lại trước khi đánh dấu hàng loạt ghi đè lựa chọn đã có
// → cần `ConfirmationProvider`, đúng như `(dashboard)/layout.tsx` bọc ngoài thật.
function renderRoster() {
  const { container } = render(
    <ConfirmationProvider>
      <AttendanceRoster sessionId={SESSION_ID} roster={ROSTER} />
    </ConfirmationProvider>,
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

describe("AttendanceRoster — đánh dấu nhanh không được nuốt lựa chọn tay", () => {
  beforeEach(() => vi.clearAllMocks());

  function rowOf(name: string) {
    const row = screen.getByText(name).closest("li");
    if (!row) throw new Error(`Không tìm thấy dòng của ${name}`);
    return row;
  }

  it("danh sách chưa ai được chọn → bấm là ăn ngay, KHÔNG hỏi lại", async () => {
    const user = userEvent.setup();
    const { payload } = renderRoster();

    await user.click(screen.getByRole("button", { name: /Tất cả có mặt/ }));

    // Nút này sinh ra để BỚT thao tác. Hỏi lại khi không có gì để mất là phản tác dụng.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(payload()[`status_${ENROLLMENT_A}`]).toBe("present");
  });

  it("đã điểm danh tay rồi lỡ chạm → hỏi lại, chọn Giữ nguyên thì không mất gì", async () => {
    const user = userEvent.setup();
    const { payload } = renderRoster();

    await user.click(within(rowOf("Trần Thị B")).getByRole("button", { name: /^Vắng$/ }));
    await user.click(screen.getByRole("button", { name: /Tất cả có mặt/ }));
    await user.click(await screen.findByRole("button", { name: "Giữ nguyên" }));

    const sent = payload();
    expect(sent[`status_${ENROLLMENT_B}`]).toBe("absent");
    // Huỷ nghĩa là KHÔNG có gì xảy ra — không được âm thầm đánh dấu người khác.
    expect(sent[`status_${ENROLLMENT_A}`]).toBeUndefined();
    expect(sent[`status_${ENROLLMENT_C}`]).toBeUndefined();
  });

  it("chọn Ghi đè thì mới thật sự ghi đè", async () => {
    const user = userEvent.setup();
    const { payload } = renderRoster();

    await user.click(within(rowOf("Trần Thị B")).getByRole("button", { name: /^Vắng$/ }));
    await user.click(screen.getByRole("button", { name: /Tất cả có mặt/ }));
    await user.click(await screen.findByRole("button", { name: "Ghi đè" }));

    const sent = payload();
    expect(sent[`status_${ENROLLMENT_A}`]).toBe("present");
    expect(sent[`status_${ENROLLMENT_B}`]).toBe("present");
    expect(sent[`status_${ENROLLMENT_C}`]).toBe("present");
  });
});

describe("AttendanceRoster — ô ghi chú phân biệt được theo học viên", () => {
  it("mỗi ô ghi chú mang tên học viên của nó, không phải 20 ô trùng tên", () => {
    renderRoster();

    // Placeholder giống hệt nhau ở mọi hàng → trình đọc màn hình không biết ô nào của ai.
    expect(
      screen.getByRole("textbox", { name: "Ghi chú cho Nguyễn Văn A" }),
    ).toHaveAttribute("name", `note_${ENROLLMENT_A}`);
    expect(
      screen.getByRole("textbox", { name: "Ghi chú cho Trần Thị B" }),
    ).toHaveAttribute("maxlength", "300");
  });
});
