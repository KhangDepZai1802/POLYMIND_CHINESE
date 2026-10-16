import { render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { WeeklyScheduleGrid } from "@/features/b2c/components/weekly-schedule-grid";
afterEach(cleanup);
it("shows different hours in each weekly column", () => {
  render(
    <WeeklyScheduleGrid
      weekdays="T4-T6"
      time="T4 19:30–21:00; T6 18:00–19:30"
      teacher="Cô Tú"
    />,
  );
  expect(
    within(screen.getByRole("region", { name: "Thứ 4" })).getByText(
      "19:30–21:00",
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Thứ 6" })).getByText(
      "18:00–19:30",
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Thứ 6" })).queryByText(
      "19:30–21:00",
    ),
  ).toBeNull();
});
it("places weekly lessons only on the Sheet weekdays without inventing calendar dates", () => {
  render(
    <WeeklyScheduleGrid weekdays="T2-T4" time="18:00–19:30" teacher="Cô Tú" />,
  );
  for (const day of ["Thứ 2", "Thứ 4"]) {
    const column = screen.getByRole("region", { name: day });
    expect(within(column).getByText("18:00–19:30")).toBeInTheDocument();
    expect(within(column).getByText("Cô Tú")).toBeInTheDocument();
  }
  expect(
    within(screen.getByRole("region", { name: "Thứ 6" })).queryByText("Cô Tú"),
  ).toBeNull();
  expect(screen.getAllByText("Không có lịch tuần")).toHaveLength(5);
  expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4}/)).toBeNull();
});
it("does not create weekly lessons when no weekday is provided", () => {
  render(<WeeklyScheduleGrid weekdays={null} time={null} teacher={null} />);
  expect(screen.getAllByText("Không có lịch tuần")).toHaveLength(7);
});
