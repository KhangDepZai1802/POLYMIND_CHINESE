import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { teacherRenewalRates } from "@/features/b2c/domain/teacher-renewal";

async function readAll<T>(
  read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await read(offset);
    if (error) throw new Error("Không tải được chỉ số giáo viên B2C.");
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export async function getB2CTeacherMetrics() {
  await requireManager();
  const client = await createClient();
  const [teachers, classes, enrollments, sessions, packages, receipts] =
    await Promise.all([
      readAll((o) =>
        client
          .from("b2c_teachers")
          .select(
            "id,full_name,phone,email,specialization,employment_type,hourly_rate",
          )
          .order("id")
          .range(o, o + 999),
      ),
      readAll((o) =>
        client
          .from("b2c_classes")
          .select("id,code,name,teacher_name,enrolled_count")
          .order("id")
          .range(o, o + 999),
      ),
      readAll((o) =>
        client
          .from("b2c_enrollments")
          .select("id,class_id,student_id,tuition_end_date")
          .order("id")
          .range(o, o + 999),
      ),
      readAll((o) =>
        client
          .from("b2c_teaching_sessions")
          .select("id,teacher_id,class_id,salary,check_out_at,starts_at")
          .order("id")
          .range(o, o + 999),
      ),
      readAll((o) =>
        client
          .from("b2c_tuition_packages")
          .select("id,enrollment_id")
          .order("id")
          .range(o, o + 999),
      ),
      readAll((o) =>
        client
          .from("b2c_tuition_receipts")
          .select("id,package_id,amount:effective_amount,paid_date")
          .order("id")
          .range(o, o + 999),
      ),
    ]);
  const normalize = (name: string) => name.trim().toLocaleLowerCase("vi");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const packageEnrollment = new Map(
    packages.map((p) => [p.id, p.enrollment_id]),
  );
  const payments = receipts
    .filter((r) => Number(r.amount) > 0 && r.paid_date <= today)
    .flatMap((r) => {
      const enrollmentId = packageEnrollment.get(r.package_id);
      return enrollmentId ? [{ enrollmentId, paid_date: r.paid_date }] : [];
    });
  const nameCounts = new Map<string, number>();
  for (const teacher of teachers) {
    const name = normalize(teacher.full_name);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const students = new Map<string, Set<string>>();
  const enrollmentClass = new Map(enrollments.map((e) => [e.id, e.class_id]));
  for (const e of enrollments) {
    const ids = students.get(e.class_id) ?? new Set<string>();
    ids.add(e.student_id);
    students.set(e.class_id, ids);
  }
  const packageClass = new Map(
    packages.map((p) => [p.id, enrollmentClass.get(p.enrollment_id)]),
  );
  const revenue = new Map<string, number>();
  for (const r of receipts) {
    if (r.paid_date > today) continue;
    const classId = packageClass.get(r.package_id);
    if (classId)
      revenue.set(classId, (revenue.get(classId) ?? 0) + Number(r.amount));
  }
  return new Map(
    teachers.map((teacher) => {
      const name = normalize(teacher.full_name);
      const ambiguous = (nameCounts.get(name) ?? 0) > 1;
      const assigned = classes.filter(
        (c) => c.teacher_name && normalize(c.teacher_name) === name,
      );
      const ids = new Set(assigned.map((c) => c.id));
      const renewal = teacherRenewalRates(
        enrollments.filter((e) => ids.has(e.class_id)),
        payments,
        today,
      );
      const completed = sessions.filter(
        (s) =>
          s.teacher_id === teacher.id && ids.has(s.class_id) && s.check_out_at,
      );
      const salary = completed.reduce((sum, s) => sum + Number(s.salary), 0);
      const collected = assigned.reduce(
        (sum, c) => sum + (revenue.get(c.id) ?? 0),
        0,
      );
      return [
        teacher.id,
        {
          teacher,
          assignedClasses: ambiguous
            ? []
            : assigned.map((c) => ({
                id: c.id,
                code: c.code,
                name: c.name,
                studentCount: students.get(c.id)?.size ?? c.enrolled_count ?? 0,
              })),
          teachingMonths: [
            ...new Set(
              sessions
                .filter((s) => s.teacher_id === teacher.id)
                .map((s) =>
                  new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Ho_Chi_Minh",
                    year: "numeric",
                    month: "2-digit",
                  })
                    .format(new Date(s.starts_at))
                    .slice(0, 7),
                ),
            ),
          ],
          classCount: ambiguous ? null : assigned.length,
          repeatPaymentRate: ambiguous ? null : renewal.repeatPaymentRate,
          renewalAfterExpiryRate: ambiguous
            ? null
            : renewal.renewalAfterExpiryRate,
          averageSize:
            ambiguous || !assigned.length
              ? null
              : assigned.reduce(
                  (sum, c) =>
                    sum + (students.get(c.id)?.size ?? c.enrolled_count ?? 0),
                  0,
                ) / assigned.length,
          costRatio:
            ambiguous || !completed.length || !collected
              ? null
              : (salary / collected) * 100,
          salary,
          revenue: collected,
        },
      ];
    }),
  );
}
