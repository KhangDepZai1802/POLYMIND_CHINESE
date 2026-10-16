import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/b2c/server/weekly-schedule-actions", () => ({
  readWeeklyScheduleAction: mocks.read,
  saveWeeklyScheduleAction: mocks.save,
}));
import { WeeklyScheduleDialog } from "@/features/b2c/components/weekly-schedule-dialog";
it("edits the Sheet weekly schedule without requesting calendar dates", async () => {
  mocks.read.mockResolvedValue({
    id: "class-a",
    teacher_name: "Cô Tú",
    weekdays_text: "T2-T4",
    time_text: "18h00-19h30",
    updated_at: "version",
  });
  mocks.save.mockResolvedValue({ success: "saved" });
  render(<WeeklyScheduleDialog classId="class-a" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Sửa lịch học hằng tuần" }),
  );
  const dialog = await screen.findByRole("dialog");
  const teacher = await within(dialog).findByLabelText("Giáo viên");
  expect(teacher).toHaveValue("Cô Tú");
  expect(within(dialog).getByLabelText("T2")).toBeChecked();
  expect(within(dialog).getByLabelText("T4")).toBeChecked();
  expect(within(dialog).getByLabelText("Giờ bắt đầu T2")).toHaveValue("18:00");
  expect(dialog.querySelector('input[type="date"]')).toBeNull();
  fireEvent.click(within(dialog).getByLabelText("T4"));
  fireEvent.click(within(dialog).getByLabelText("T6"));
  fireEvent.change(within(dialog).getByLabelText("Giờ bắt đầu T6"), {
    target: { value: "19:00" },
  });
  fireEvent.change(within(dialog).getByLabelText("Giờ kết thúc T6"), {
    target: { value: "20:30" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Lưu lịch tuần" }),
  );
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        teacher_name: "Cô Tú",
        slots: [
          { day: "T2", start_time: "18:00", end_time: "19:30" },
          { day: "T6", start_time: "19:00", end_time: "20:30" },
        ],
        expected_updated_at: "version",
      }),
    ),
  );
});
