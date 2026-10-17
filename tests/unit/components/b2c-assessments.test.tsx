import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), history: vi.fn() }));
vi.mock("@/features/b2c/server/assessment-actions", () => ({ readB2CAssessmentsAction: api.read, saveB2CAssessmentAction: api.save, readB2CAssessmentHistoryAction: api.history }));
import { AssessmentsPanel } from "@/features/b2c/components/assessments-panel";
const exam = { id: "a", title: "Bài giữa kỳ", kind: "midterm", exam_date: "2026-10-17", max_score: 10, updated_at: "2026-10-17T00:00:00Z" };
const model = { exams: [exam], selected: exam, exam_total: 1, total: 2, graded: 1, rows: [
  { enrollment_id: "e1", full_name: "An", student_code: "HV1", score: 0, feedback: "Cần ôn lại", updated_at: "2026-10-17T00:00:00Z" },
  { enrollment_id: "e2", full_name: "Bình", student_code: "HV2", score: null, feedback: "", updated_at: null },
] };
beforeEach(() => { vi.clearAllMocks(); api.read.mockResolvedValue(model); api.save.mockResolvedValue({ id: "r" }); });
afterEach(cleanup);
it("shows zero as graded and hides editing for view-only users", async () => {
  render(<AssessmentsPanel classId="c" today="2026-10-17" canGrade={false} />);
  await screen.findByText("0/10");
  expect(screen.getByText("Chưa chấm")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Nhập điểm" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Thêm bài kiểm tra" })).toBeNull();
});
it("saves blank as null and records a correction reason", async () => {
  render(<AssessmentsPanel classId="c" today="2026-10-17" canGrade />);
  await screen.findByText("0/10");
  fireEvent.click(screen.getByRole("button", { name: "Sửa kết quả" }));
  fireEvent.change(screen.getByLabelText("Điểm"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Lý do sửa kết quả"), { target: { value: "Nhập nhầm" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu kết quả" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith("result", expect.objectContaining({ score: null, reason: "Nhập nhầm", enrollment_id: "e1" })));
});
it("creates a final exam with the selected scale", async () => {
  api.read.mockResolvedValue({ ...model, exams: [], selected: null, exam_total: 0, rows: [], total: 0 });
  render(<AssessmentsPanel classId="c" today="2026-10-17" canGrade />);
  await screen.findByText("Chưa có bài kiểm tra giữa kỳ hoặc cuối kỳ.");
  fireEvent.click(screen.getByRole("button", { name: "Thêm bài kiểm tra" }));
  fireEvent.change(screen.getByLabelText("Tên bài kiểm tra"), { target: { value: "Cuối khóa" } });
  fireEvent.change(screen.getByLabelText("Loại kiểm tra"), { target: { value: "final" } });
  fireEvent.change(screen.getByLabelText("Điểm tối đa"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu bài kiểm tra" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith("exam", expect.objectContaining({ title: "Cuối khóa", kind: "final", max_score: 100 })));
});
it("opens readable before/after score history", async () => {
  api.history.mockResolvedValue({ total: 1, rows: [{ id: "h", student_name: "An", actor_name: "Giáo vụ", created_at: "2026-10-17T00:00:00Z", reason: "Chấm lại", before_data: { score: 0, max_score: 10, feedback: "" }, after_data: { score: 8, max_score: 10, feedback: "Tiến bộ" } }] });
  render(<AssessmentsPanel classId="c" today="2026-10-17" canGrade />);
  fireEvent.click(await screen.findByRole("button", { name: "Lịch sử chỉnh sửa" }));
  await screen.findByText("Sau: 8/10 · Tiến bộ");
  expect(screen.getByText("Trước: 0/10 · Chưa nhận xét")).toBeInTheDocument();
});
it("blocks grade entry for future exams and surfaces loading errors", async () => {
  api.read.mockResolvedValue({ ...model, selected: { ...exam, exam_date: "2026-10-18" } });
  render(<AssessmentsPanel classId="c" today="2026-10-17" canGrade />);
  expect(await screen.findByRole("button", { name: "Nhập điểm" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Sửa kết quả" })).toBeDisabled();
});
