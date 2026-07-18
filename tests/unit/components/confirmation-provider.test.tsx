import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ConfirmationProvider,
  useConfirmSubmit,
  useConfirmation,
} from "@/components/shared/confirmation-provider";

function Harness() {
  const confirm = useConfirmation();
  const [result, setResult] = useState("chưa chọn");

  return (
    <>
      <button
        onClick={async () => {
          const accepted = await confirm({
            title: "Xóa dữ liệu?",
            description: "Dữ liệu sẽ không thể khôi phục.",
            confirmLabel: "Xóa",
            variant: "destructive",
          });
          setResult(accepted ? "đã xác nhận" : "đã hủy");
        }}
      >
        Mở xác nhận
      </button>
      <output>{result}</output>
    </>
  );
}

function SubmitHarness() {
  const [submissions, setSubmissions] = useState(0);
  const confirmSubmit = useConfirmSubmit({
    title: "Gửi biểu mẫu?",
    description: "Kiểm tra cơ chế submit lại sau xác nhận.",
    confirmLabel: "Gửi",
  });

  return (
    <form
      onSubmit={async (event) => {
        await confirmSubmit(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          setSubmissions((count) => count + 1);
        }
      }}
    >
      <button type="submit">Gửi biểu mẫu</button>
      <output>Đã gửi {submissions} lần</output>
    </form>
  );
}

describe("ConfirmationProvider", () => {
  it("hiện dialog theo theme và trả kết quả xác nhận", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationProvider>
        <Harness />
      </ConfirmationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Mở xác nhận" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByText("Dữ liệu sẽ không thể khôi phục."),
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Xóa" });
    expect(confirmButton).toHaveClass("bg-destructive");
    await user.click(confirmButton);

    expect(screen.getByText("đã xác nhận")).toBeInTheDocument();
  });

  it("submit biểu mẫu đúng một lần sau khi xác nhận", async () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(function (
        this: HTMLFormElement,
        submitter?: HTMLElement | null,
      ) {
        this.dispatchEvent(
          new SubmitEvent("submit", {
            bubbles: true,
            cancelable: true,
            submitter,
          }),
        );
      });
    const user = userEvent.setup();
    render(
      <ConfirmationProvider>
        <SubmitHarness />
      </ConfirmationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Gửi biểu mẫu" }));
    expect(screen.getByText("Đã gửi 0 lần")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(screen.getByText("Đã gửi 1 lần")).toBeInTheDocument();
    requestSubmit.mockRestore();
  });
});
