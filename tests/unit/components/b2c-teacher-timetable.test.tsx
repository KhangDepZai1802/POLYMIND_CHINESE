import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { TeacherTimetable } from "@/features/b2c/components/teacher-timetable";
import {
  buildTeacherTimetable,
  type TimetableClass,
} from "@/features/b2c/domain/teacher-timetable";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("filters the weekly timetable by teacher and keeps the class schedule links", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const cls: TimetableClass = {
    id: "a",
    code: "B2C-A",
    name: "Teen 3",
    teacher_id: "tu",
    teacher_name: "Cô Tú",
    weekdays_text: "T4-T6",
    time_text: "T4 19:30–21:00; T6 18:00–19:30",
    campus: null,
    status: "active",
  };
  const data = buildTeacherTimetable(
    [
      cls,
      {
        ...cls,
        id: "b",
        code: "B2C-B",
        name: "Pre Movers",
        teacher_id: "le",
        teacher_name: "Cô Lê",
        weekdays_text: "T2",
        time_text: "17:30–19:00",
      },
    ],
    [
      { id: "tu", full_name: "Cô Tú" },
      { id: "le", full_name: "Cô Lê" },
    ],
  );
  render(<TeacherTimetable data={data} />);
  expect(screen.getByText("Pre Movers")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Giáo viên"), {
    target: { value: "tu" },
  });
  expect(screen.queryByText("Pre Movers")).toBeNull();
  expect(screen.getByText("19:30–21:00")).toBeInTheDocument();
  expect(screen.getByText("18:00–19:30")).toBeInTheDocument();
  expect(
    screen
      .getAllByRole("link")
      .every(
        (link) =>
          link.getAttribute("href") === "/admin/b2c/classes/a?tab=schedule",
      ),
  ).toBe(true);
});
