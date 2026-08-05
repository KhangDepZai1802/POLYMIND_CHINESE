import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/schedules/server/actions", () => ({
  cancelSessionAction: vi.fn(),
  createManualSessionAction: vi.fn(),
  createScheduleAction: vi.fn(),
  deleteAllSessionsAction: vi.fn(),
  deleteScheduleAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  generateSessionsAction: vi.fn(),
}));

import {
  ScheduleManager,
  SessionCalendar,
} from "@/features/schedules/components/schedule-manager";
import { ConfirmationProvider } from "@/components/shared/confirmation-provider";

const SESSIONS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    session_number: 1,
    starts_at: "2099-07-20T01:00:00.000Z",
    ends_at: "2099-07-20T02:30:00.000Z",
    status: "scheduled" as const,
    topic: "Chào hỏi cơ bản",
    lesson: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    session_number: 2,
    starts_at: "2099-07-22T01:00:00.000Z",
    ends_at: "2099-07-22T02:30:00.000Z",
    status: "scheduled" as const,
    topic: "Giới thiệu bản thân",
    lesson: null,
  },
];

describe("ScheduleManager — chuyển kiểu thời khóa biểu", () => {
  it("mặc định hiện tuần và chuyển được qua tối giản/tháng", async () => {
    const user = userEvent.setup();

    render(
      <ConfirmationProvider>
        <ScheduleManager
          classId="33333333-3333-4333-8333-333333333333"
          plannedSessionCount={35}
          hasStartDate
          schedules={[]}
          sessions={SESSIONS}
          lessons={[]}
        />
      </ConfirmationProvider>,
    );

    const weekButton = screen.getByRole("button", { name: "Tuần" });
    expect(weekButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("20/07 – 26/07/2099")).toBeInTheDocument();
    /*
     * ĐÚNG HAI bản: danh sách dọc (dưới `xl`) và lưới 7 cột (từ `xl`). Cả hai
     * cùng nằm trong DOM, CSS ẩn bớt một — `UX-MOBILE-1` cố ý chọn cách này chứ
     * không đọc bề rộng bằng JS, vì đọc bằng JS thì máy chủ dựng ra một đằng và
     * trình duyệt dựng lại một nẻo (hydration mismatch + nháy hình).
     */
    expect(screen.getAllByText("Chào hỏi cơ bản")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Tối giản" }));
    expect(screen.getByRole("button", { name: "Tối giản" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("20/07/2099 08:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tháng" }));
    expect(screen.getByText("Tháng 7 năm 2099")).toBeInTheDocument();
    expect(screen.getByTitle("Buổi 1 · Đã lên lịch")).toBeInTheDocument();
  });

  it("giữ đủ ba kiểu xem và mở nhật ký trong chế độ giáo viên", async () => {
    const user = userEvent.setup();

    render(<SessionCalendar mode="teacher" sessions={SESSIONS} />);

    expect(screen.getByRole("button", { name: "Tối giản" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tuần" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tháng" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Nhật ký" })[0]).toHaveAttribute(
      "href",
      `/teacher/sessions/${SESSIONS[0]!.id}`,
    );

    await user.click(screen.getByRole("button", { name: "Tối giản" }));
    expect(screen.getAllByRole("link", { name: "Nhật ký" })).toHaveLength(2);
  });

  it("chỉ hiện kết quả điểm danh đã có trong chế độ học viên", () => {
    render(
      <SessionCalendar
        mode="student"
        sessions={[
          { ...SESSIONS[0]!, myAttendance: { status: "absent" as const } },
          SESSIONS[1]!,
        ]}
      />,
    );

    expect(screen.getAllByText("Vắng")).toHaveLength(2);
    expect(screen.queryByText("Nhật ký")).not.toBeInTheDocument();
  });
});

/**
 * Bố cục dọc trên điện thoại (`UX-MOBILE-1`).
 *
 * Ba bài dưới đây ghim đúng ba điều user chốt 2026-08-05, để lần sau không ai
 * "dọn dẹp" mất: (1) ngày trống vẫn hiện, (2) lưới tháng không còn khung cuộn
 * ngang, (3) chạm một ngày thì chi tiết đổi theo.
 */
describe("SessionCalendar — bố cục dọc cho màn hẹp", () => {
  it("chế độ Tuần liệt kê đủ 7 ngày, ngày trống thành một dòng rút gọn", () => {
    render(<SessionCalendar mode="student" sessions={SESSIONS} />);

    // Tuần 20/07–26/07/2099 có buổi ở Thứ Hai và Thứ Tư ⇒ 5 ngày còn lại phải
    // xuất hiện dưới dạng dòng rút gọn, KHÔNG được biến mất.
    expect(screen.getAllByText("— không có buổi")).toHaveLength(5);
    expect(screen.getByText("Thứ Hai · 20/07")).toBeInTheDocument();
    expect(screen.getByText("Thứ Tư · 22/07")).toBeInTheDocument();
  });

  it("chế độ Tháng cho màn hẹp KHÔNG nằm trong khung cuộn ngang", async () => {
    const user = userEvent.setup();
    render(<SessionCalendar mode="student" sessions={SESSIONS} />);
    await user.click(screen.getByRole("button", { name: "Tháng" }));

    const dayButton = screen.getByRole("button", {
      name: /20\/07\/2099 — 1 buổi học/,
    });
    // Lưới điện thoại phải nằm ngoài mọi tổ tiên `overflow-x-auto`; chỉ lưới
    // desktop (`min-w-[840px]`) mới được ở trong khung cuộn.
    expect(dayButton.closest(".overflow-x-auto")).toBeNull();
  });

  it("chạm một ngày trong lưới tháng thì panel chi tiết đổi theo", async () => {
    const user = userEvent.setup();
    render(<SessionCalendar mode="student" sessions={SESSIONS} />);
    await user.click(screen.getByRole("button", { name: "Tháng" }));

    expect(screen.getByText(/20\/07\/2099/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /22\/07\/2099 — 1 buổi học/ }),
    );
    expect(screen.getByText(/22\/07\/2099/)).toBeInTheDocument();
    expect(screen.getByText("Giới thiệu bản thân")).toBeInTheDocument();
  });
});
