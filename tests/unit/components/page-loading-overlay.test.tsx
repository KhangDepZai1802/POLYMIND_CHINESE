import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageLoadingOverlay } from "@/components/shared/page-loading-overlay";

describe("PageLoadingOverlay", () => {
  it("thông báo trạng thái tải cho cả mắt và screen reader", () => {
    render(<PageLoadingOverlay />);

    const status = screen.getByRole("status", { name: "Đang tải trang" });
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Đang tải dữ liệu")).toBeInTheDocument();
  });
});
