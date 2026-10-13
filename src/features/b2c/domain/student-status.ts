export const B2C_STUDENT_STATUSES = [
  "studying", "on_hold", "awaiting_renewal", "overdue", "withdrawn", "completed",
] as const;

export type B2CStudentStatus = (typeof B2C_STUDENT_STATUSES)[number];

export const B2C_STUDENT_STATUS_LABELS: Record<B2CStudentStatus, string> = {
  studying: "Đang học",
  on_hold: "Bảo lưu",
  awaiting_renewal: "Chờ tái phí",
  overdue: "Nợ phí",
  withdrawn: "Nghỉ",
  completed: "Hoàn thành",
};

export const B2C_STUDENT_STATUS_COLORS: Record<B2CStudentStatus, string> = {
  studying: "bg-emerald-100 text-emerald-800",
  on_hold: "bg-amber-100 text-amber-800",
  awaiting_renewal: "bg-blue-100 text-blue-800",
  overdue: "bg-rose-100 text-rose-800",
  withdrawn: "bg-slate-100 text-slate-700",
  completed: "bg-violet-100 text-violet-800",
};
