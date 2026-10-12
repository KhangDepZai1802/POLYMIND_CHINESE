import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getB2CClasses(programSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("b2c_classes")
    .select(
      "id, code, program_slug, name, level_name, teacher_name, weekdays_text, time_text, capacity, enrolled_count, campus, delivery_mode, start_date, status, notes",
    )
    .eq("program_slug", programSlug)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("code");

  // Cho phép giao diện mở trước khi quản trị viên chạy migration mới.
  if (error) {
    console.error("Không tải được danh sách lớp B2C", {
      code: error.code,
      message: error.message,
      programSlug,
    });
    return [];
  }
  return data;
}

export async function getB2CStudentRows(programSlug?: string) {
  const supabase = await createClient();
  let classQuery = supabase
    .from("b2c_classes")
    .select("id, code, name, program_slug");
  if (programSlug) classQuery = classQuery.eq("program_slug", programSlug);
  const { data: classes, error: classError } = await classQuery;

  if (classError || !classes?.length) return [];

  const classById = new Map(classes.map((item) => [item.id, item]));
  const { data, error } = await supabase
    .from("b2c_enrollments")
    .select(
      `id, class_id, enrollment_date, payment_date, learning_start_date,
       tuition_end_date, registered_sessions, sessions_per_week, salesperson, notes,
       student:b2c_students (id, full_name, date_of_birth, birth_year, guardian_name, email, address, phone)`,
    )
    .in(
      "class_id",
      classes.map((item) => item.id),
    )
    .order("source_row");

  if (error) {
    console.error("Không tải được học viên B2C", {
      code: error.code,
      message: error.message,
      programSlug,
    });
    return [];
  }

  return (data ?? []).flatMap((item) => {
    if (!item.student) return [];
    const classRecord = classById.get(item.class_id);
    return [
      {
        id: item.id,
        classCode: classRecord?.code ?? "",
        className: classRecord?.name ?? "",
        programSlug: classRecord?.program_slug ?? "",
        fullName: item.student.full_name,
        dateOfBirth: item.student.date_of_birth,
        birthYear: item.student.birth_year,
        guardianName: item.student.guardian_name,
        email: item.student.email,
        address: item.student.address,
        phone: item.student.phone,
        enrollmentDate: item.enrollment_date,
        paymentDate: item.payment_date,
        learningStartDate: item.learning_start_date,
        tuitionEndDate: item.tuition_end_date,
        registeredSessions: item.registered_sessions,
        sessionsPerWeek: item.sessions_per_week,
        salesperson: item.salesperson,
        notes: item.notes,
      },
    ];
  });
}

export async function getB2CMonthlyReports() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("b2c_monthly_reports")
    .select(
      "id, report_year, report_month, revenue, electricity_cost, water_cost, internet_cost, payroll_cost, rent_cost, marketing_cost, advertising_cost, other_cost, notes, updated_at",
    )
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false });

  if (error || !reports?.length) {
    if (error) {
      console.error("Không tải được báo cáo tháng B2C", {
        code: error.code,
        message: error.message,
      });
    }
    return [];
  }

  const { data: metrics, error: metricError } = await supabase
    .from("b2c_monthly_program_metrics")
    .select(
      "report_id, program_slug, opening_students, new_students, departed_students, lessons_taught, lessons_paid",
    )
    .in(
      "report_id",
      reports.map((report) => report.id),
    );
  if (metricError) {
    console.error("Không tải được chỉ số chương trình B2C", {
      code: metricError.code,
      message: metricError.message,
    });
  }

  return reports.map((report) => ({
    ...report,
    metrics: (metrics ?? []).filter((metric) => metric.report_id === report.id),
  }));
}
