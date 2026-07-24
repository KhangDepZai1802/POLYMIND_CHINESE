import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContactForm,
  PasswordForm,
} from "@/features/student/components/profile-panel";
import {
  changeMyPasswordAction,
  updateMyContactAction,
} from "@/features/student/server/profile-actions";

vi.mock("@/features/student/server/profile-actions", () => ({
  updateMyContactAction: vi.fn(),
  changeMyPasswordAction: vi.fn(),
}));

describe("ContactForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("tiêu đề là heading cấp 2 thật", () => {
    render(<ContactForm fullName="Học viên Demo 1" phone="0900000000" />);

    expect(
      screen.getByRole("heading", { name: /Thông tin liên hệ/, level: 2 }),
    ).toBeInTheDocument();
  });

  it("phản chiếu đúng giới hạn của server, không tạo luật mới", () => {
    render(<ContactForm fullName="Học viên Demo 1" phone={null} />);

    // `contactSchema`: full_name max 120, phone max 20.
    expect(screen.getByLabelText("Họ và tên")).toHaveAttribute(
      "maxlength",
      "120",
    );
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute(
      "maxlength",
      "20",
    );
  });

  it("lỗi field được đọc lên và ô nhập trỏ đúng vào lỗi đó", async () => {
    vi.mocked(updateMyContactAction).mockResolvedValue({
      fieldErrors: { full_name: "Họ tên tối thiểu 2 ký tự" },
    });
    const user = userEvent.setup();
    render(<ContactForm fullName="A" phone={null} />);

    const input = screen.getByLabelText("Họ và tên");
    // Chưa submit thì không được gắn aria-invalid — nếu không mọi ô đều bị
    // trình đọc màn hình đọc là "không hợp lệ" ngay khi vừa mở trang.
    expect(input).not.toHaveAttribute("aria-invalid");

    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Họ tên tối thiểu 2 ký tự",
      );
    });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "full_name-error");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "full_name-error");
  });
});

describe("PasswordForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nói rõ yêu cầu độ dài thay vì để trình duyệt chặn rồi mới biết", () => {
    render(<PasswordForm />);

    expect(screen.getByText("Tối thiểu 8 ký tự.")).toBeInTheDocument();
    const password = screen.getByLabelText("Mật khẩu mới");
    expect(password).toHaveAttribute("aria-describedby", "password-hint");
    expect(password).toHaveAttribute("minlength", "8");
    // `passwordSchema` giới hạn 72 ký tự — phản chiếu đúng, không đặt số khác.
    expect(password).toHaveAttribute("maxlength", "72");
  });

  it("khi có lỗi thì ô nhập trỏ tới CẢ dòng yêu cầu lẫn dòng lỗi", async () => {
    vi.mocked(changeMyPasswordAction).mockResolvedValue({
      fieldErrors: { confirm: "Mật khẩu nhập lại không khớp" },
    });
    const user = userEvent.setup();
    render(<PasswordForm />);

    await user.type(screen.getByLabelText("Mật khẩu mới"), "matkhau123");
    await user.type(screen.getByLabelText("Nhập lại mật khẩu mới"), "khac123456");
    await user.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Mật khẩu nhập lại không khớp",
      );
    });
    expect(screen.getByLabelText("Nhập lại mật khẩu mới")).toHaveAttribute(
      "aria-describedby",
      "confirm-error",
    );
    // Ô mật khẩu không có lỗi nên vẫn chỉ trỏ tới dòng yêu cầu.
    expect(screen.getByLabelText("Mật khẩu mới")).toHaveAttribute(
      "aria-describedby",
      "password-hint",
    );
  });
});
