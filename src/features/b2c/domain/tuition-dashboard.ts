import type { B2CTuitionRow } from "../tuition-schema";
export type TuitionDashboardRow = B2CTuitionRow & { class_id: string; enrollment_date: string | null; tuition_end_date: string | null; status: string };
export type TuitionStatusFilter = "all" | "debt" | "renewal" | "unconfigured" | "paid";
export function needsRenewal(row: TuitionDashboardRow, today: string) {
  return !["on_hold", "withdrawn", "completed", "transferred"].includes(row.status) && (row.status === "awaiting_renewal" || !!row.tuition_end_date && row.tuition_end_date <= today);
}
export function needsTuitionAttention(row: TuitionDashboardRow, today: string) {
  return row.balance > 0 || needsRenewal(row, today);
}
export function tuitionStatusMatches(row: TuitionDashboardRow, filter: TuitionStatusFilter, today: string) {
  return filter === "all" || (filter === "debt" && row.balance > 0) || (filter === "renewal" && needsRenewal(row, today)) || (filter === "unconfigured" && !row.package_id) || (filter === "paid" && !!row.package_id && row.balance <= 0);
}
export function tuitionSummary(rows: TuitionDashboardRow[], today: string) {
  return { due: rows.reduce((n, r) => n + Number(r.total_due ?? 0), 0), paid: rows.reduce((n, r) => n + Number(r.paid_amount), 0), balance: rows.reduce((n, r) => n + Number(r.balance), 0), attention: new Set(rows.filter(r => needsTuitionAttention(r, today)).map(r => r.student_code)).size };
}
