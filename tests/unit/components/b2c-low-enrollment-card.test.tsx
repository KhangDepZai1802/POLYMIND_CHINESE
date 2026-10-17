import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LowEnrollmentCard } from "@/features/b2c/components/low-enrollment-card";

afterEach(cleanup);

it("opens the class list from the KPI card and closes the popup", () => {
  render(<LowEnrollmentCard classes={[{ id: "a", code: "B2C-A", name: "Movers", teacher_name: "Cô Tú", actualEnrollmentCount: 3 }]} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Lớp dưới 5 học viên/ }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "B2C-A · Movers" })).toHaveAttribute("href", "/admin/b2c/classes/a");
  expect(screen.getByText("3 HV")).toBeInTheDocument();
  expect(screen.getByText("2 HV")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("allows opening the empty list when the card count is zero", () => {
  render(<LowEnrollmentCard classes={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /Lớp dưới 5 học viên/ }));
  expect(screen.getByText("Không có lớp đang hoạt động dưới ngưỡng.")).toBeInTheDocument();
});
