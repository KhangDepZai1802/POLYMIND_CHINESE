export type MonthlyCosts = {
  electricity_cost: number;
  water_cost: number;
  internet_cost: number;
  payroll_cost: number;
  teacher_payroll_cost: number | null;
  office_payroll_cost: number | null;
  rent_cost: number;
  marketing_cost: number;
  advertising_cost: number;
  other_cost: number;
};
export function monthlyTotalCost(report: MonthlyCosts) {
  // payroll_cost is already the combined teacher + office amount.
  return (
    report.electricity_cost +
    report.water_cost +
    report.internet_cost +
    report.payroll_cost +
    report.rent_cost +
    report.marketing_cost +
    report.advertising_cost +
    report.other_cost
  );
}
export function estimateBreakEven(
  report: MonthlyCosts & { revenue: number },
  students: number,
) {
  if (
    report.teacher_payroll_cost === null ||
    report.office_payroll_cost === null
  )
    return {
      requiredStudents: null,
      reason: "Chưa tách lương GV và lương NV văn phòng.",
    };
  if (!Number.isFinite(students) || students <= 0)
    return {
      requiredStudents: null,
      reason: "Chưa có số học viên trong báo cáo tháng.",
    };
  const contribution = report.revenue - report.teacher_payroll_cost;
  const fixedCost = monthlyTotalCost(report) - report.teacher_payroll_cost;
  if (contribution <= 0)
    return {
      requiredStudents: null,
      reason:
        "Doanh thu bình quân chưa bù được chi phí GV; tăng số HV theo định mức hiện tại chưa tạo điểm hòa vốn.",
    };
  const requiredStudents = Math.ceil((fixedCost * students) / contribution);
  return {
    requiredStudents,
    currentStudents: students,
    shortfall: Math.max(0, requiredStudents - students),
    fixedCost,
    revenuePerStudent: report.revenue / students,
    variableCostPerStudent: report.teacher_payroll_cost / students,
    reason: null,
  };
}
