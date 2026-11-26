import type { B2CTuitionRow } from "../tuition-schema";
import { B2C_STUDENT_STATUS_LABELS, type B2CStudentStatus } from "./student-status";
export type TuitionArchiveMetadata = { student_archived_at: string | null };
export type TuitionDashboardRow = B2CTuitionRow & TuitionArchiveMetadata & { class_id: string; enrollment_date: string | null; tuition_end_date: string | null; status: string; paid_by_month?: Record<string, number> };
export type TuitionStatusFilter = "all" | "debt" | "renewal" | "unconfigured" | "paid";
export type TuitionEnrollmentScope = "current" | "history" | "all";

export function isCurrentTuitionEnrollment(row: TuitionDashboardRow) {
  return row.student_archived_at === null && ["studying", "on_hold", "awaiting_renewal", "overdue"].includes(row.status);
}
export function tuitionScopeMatches(row: TuitionDashboardRow, scope: TuitionEnrollmentScope) {
  return scope === "all" || (scope === "current" ? isCurrentTuitionEnrollment(row) : !isCurrentTuitionEnrollment(row));
}
export function tuitionEnrollmentLabel(row: TuitionDashboardRow) {
  return row.student_archived_at !== null ? "Đã lưu trữ" : B2C_STUDENT_STATUS_LABELS[row.status as B2CStudentStatus] ?? "Không còn theo học";
}
export function assertTuitionArchiveMetadata(rows: B2CTuitionRow[]): asserts rows is (B2CTuitionRow & TuitionArchiveMetadata)[] {
  if (rows.some(row => !("student_archived_at" in row) || (row.student_archived_at !== null && typeof row.student_archived_at !== "string"))) {
    throw new Error("Chưa tải được trạng thái lưu trữ học viên. Vui lòng thử lại.");
  }
}
export function needsRenewal(row: TuitionDashboardRow, today: string) {
  return isCurrentTuitionEnrollment(row) && row.status !== "on_hold" && (row.status === "awaiting_renewal" || !!row.tuition_end_date && row.tuition_end_date <= today);
}
export function needsTuitionAttention(row: TuitionDashboardRow, today: string) {
  return row.balance > 0 || needsRenewal(row, today);
}
export function tuitionStatusMatches(row: TuitionDashboardRow, filter: TuitionStatusFilter, today: string) {
  return filter === "all" || (filter === "debt" && row.balance > 0) || (filter === "renewal" && needsRenewal(row, today)) || (filter === "unconfigured" && !row.package_id) || (filter === "paid" && !!row.package_id && row.balance <= 0);
}
export function tuitionReceiptMonthMatches(row: TuitionDashboardRow, month: string) {
  if (!month) return true;
  if (!row.paid_by_month) throw new Error("Chưa tải được học phí theo tháng thu. Vui lòng tải lại.");
  return Object.hasOwn(row.paid_by_month, month);
}
export function tuitionPaidAmount(row: TuitionDashboardRow, month = "") {
  if (!month) return Number(row.paid_amount);
  if (!row.paid_by_month) throw new Error("Chưa tải được học phí theo tháng thu. Vui lòng tải lại.");
  return Number(row.paid_by_month[month] ?? 0);
}
export function tuitionSummary(rows: TuitionDashboardRow[], today: string, receiptMonth = "") {
  return { due: rows.reduce((n, r) => n + Number(r.total_due ?? 0), 0), paid: rows.reduce((n, r) => n + tuitionPaidAmount(r, receiptMonth), 0), balance: rows.reduce((n, r) => n + Number(r.balance), 0), attention: new Set(rows.filter(r => needsTuitionAttention(r, today)).map(r => r.student_code)).size };
}
