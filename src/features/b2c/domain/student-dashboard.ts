import type { B2CStudentStatus } from "@/features/b2c/domain/student-status";

export type StudentDashboardProfile = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  birth_year: number | null;
  address: string | null;
  customer_source: string | null;
  referrer_name: string | null;
  guardianName: string | null;
};
export type StudentDashboardEnrollment = {
  id: string;
  student_id: string;
  class_id: string;
  status: B2CStudentStatus;
  withdrawal_reason: string | null;
  learning_goal: string | null;
  certificate_goal: string | null;
  enrollment_date: string | null;
  payment_date: string | null;
  learning_start_date: string | null;
  tuition_end_date: string | null;
  registered_sessions: number | null;
  salesperson: string | null;
  notes: string | null;
};
export type StudentDashboardClass = {
  id: string;
  code: string;
  name: string;
  status: string;
  program_slug: string;
};
export type StudentDashboardData = {
  students: StudentDashboardProfile[];
  enrollments: StudentDashboardEnrollment[];
  classes: StudentDashboardClass[];
  today: string;
};
export type StudentListRow = {
  id: string;
  student: StudentDashboardProfile;
  enrollment: StudentDashboardEnrollment | null;
  classInfo: StudentDashboardClass | null;
};

export const STATUS_PRIORITY: (B2CStudentStatus | "unassigned")[] = [
  "studying",
  "overdue",
  "awaiting_renewal",
  "on_hold",
  "withdrawn",
  "completed",
  "unassigned",
];
export function summarizeStudentStatus(
  enrollments: StudentDashboardEnrollment[],
) {
  return (
    STATUS_PRIORITY.find((status) =>
      enrollments.some((e) => e.status === status),
    ) ?? "unassigned"
  );
}
export function tuitionExpiring(
  enrollment: StudentDashboardEnrollment,
  today: string,
) {
  if (
    !enrollment.tuition_end_date ||
    ["withdrawn", "completed"].includes(enrollment.status)
  )
    return false;
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  return (
    enrollment.tuition_end_date >= today &&
    enrollment.tuition_end_date <= end.toISOString().slice(0, 10)
  );
}
export function studentDashboardRows(
  data: StudentDashboardData,
): StudentListRow[] {
  const classes = new Map(data.classes.map((c) => [c.id, c]));
  const byStudent = new Map<string, StudentDashboardEnrollment[]>();
  for (const enrollment of data.enrollments) {
    const group = byStudent.get(enrollment.student_id) ?? [];
    group.push(enrollment);
    byStudent.set(enrollment.student_id, group);
  }
  return data.students.flatMap<StudentListRow>((student) => {
    const enrollments = byStudent.get(student.id) ?? [];
    return enrollments.length
      ? enrollments.map((enrollment) => ({
          id: enrollment.id,
          student,
          enrollment,
          classInfo: classes.get(enrollment.class_id) ?? null,
        }))
      : [{ id: student.id, student, enrollment: null, classInfo: null }];
  });
}
