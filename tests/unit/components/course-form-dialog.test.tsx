import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CourseFormDialog } from "@/features/courses/components/course-form-dialog";

vi.mock("@/features/courses/server/actions", () => ({
  createCourseAction: vi.fn(),
  updateCourseAction: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  for (const method of [
    "hasPointerCapture",
    "setPointerCapture",
    "releasePointerCapture",
    "scrollIntoView",
  ]) {
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      value: method === "hasPointerCapture" ? () => false : () => undefined,
    });
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
  for (const method of [
    "hasPointerCapture",
    "setPointerCapture",
    "releasePointerCapture",
    "scrollIntoView",
  ]) {
    delete (Element.prototype as unknown as Record<string, unknown>)[method];
  }
});

describe("CourseFormDialog", () => {
  it("chỉ hiện dropdown Loại khi chọn chương trình cốt lõi", async () => {
    const user = userEvent.setup();
    render(<CourseFormDialog levels={[]} />);

    await user.click(screen.getByRole("button", { name: "Thêm khóa học" }));

    const programSelect = screen.getByRole("combobox", {
      name: /Chương trình/,
    });
    expect(screen.getByRole("combobox", { name: /Loại/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Mã khóa học/)).not.toBeInTheDocument();

    await user.click(programSelect);
    await user.click(
      screen.getByRole("option", { name: "Chương trình doanh nghiệp" }),
    );

    expect(screen.queryByRole("combobox", { name: /Loại/ })).not.toBeInTheDocument();
  });
});
