export function teacherRenewalRates(
  enrollments: {
    id: string;
    student_id: string;
    tuition_end_date: string | null;
  }[],
  receipts: { enrollmentId: string; paid_date: string }[],
  today: string,
) {
  const paidDates = new Map<string, string[]>();
  for (const receipt of receipts) {
    if (receipt.paid_date > today) continue;
    const dates = paidDates.get(receipt.enrollmentId) ?? [];
    dates.push(receipt.paid_date);
    paidDates.set(receipt.enrollmentId, dates);
  }
  const paidStudents = new Set<string>();
  const paymentCounts = new Map<string, number>();
  const expiredStudents = new Set<string>();
  const renewedStudents = new Set<string>();
  for (const e of enrollments) {
    const dates = paidDates.get(e.id) ?? [];
    if (dates.length) {
      paidStudents.add(e.student_id);
      paymentCounts.set(
        e.student_id,
        (paymentCounts.get(e.student_id) ?? 0) + dates.length,
      );
    }
    if (e.tuition_end_date && e.tuition_end_date < today) {
      expiredStudents.add(e.student_id);
      if (dates.some((date) => date > e.tuition_end_date!))
        renewedStudents.add(e.student_id);
    }
  }
  return {
    repeatPaymentRate: paidStudents.size
      ? ([...paymentCounts.values()].filter((count) => count >= 2).length /
          paidStudents.size) *
        100
      : null,
    renewalAfterExpiryRate: expiredStudents.size
      ? (renewedStudents.size / expiredStudents.size) * 100
      : null,
  };
}
