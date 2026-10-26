import "server-only";

import { createClient } from "@/lib/supabase/server";
import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { estimateBreakEven } from "@/features/b2c/domain/finance";
import { B2C_CUSTOMER_SOURCES, B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";

export async function getB2CAdmissionsPage(stage: string | null, program: string, query: string, page = 0, limit = 20) {
  const { data, error } = await (await createClient()).rpc("get_b2c_admissions_page", {
    p_stage: stage ?? undefined, p_program: program || undefined, p_query: query, p_page: page, p_limit: limit,
  });
  if (error) throw new Error("Không tải được danh sách tuyển sinh. Vui lòng thử lại.");
  return data as unknown as { leads: import("@/features/b2c/domain/admissions").AdmissionLead[]; total: number };
}

export async function getAmisCrmPurchaseRecency() {
  const { data, error } = await (await createClient()).from("b2c_admission_leads")
    .select("id,full_name,phone,amis_order_sales,amis_last_purchase_date,amis_days_since_purchase")
    .not("amis_crm_code", "is", null)
    .order("amis_days_since_purchase", { ascending: false, nullsFirst: false })
    .order("full_name");
  if (error) throw new Error("Không tải được dữ liệu mua hàng từ CRM.");
  return data;
}

export async function getB2CCustomerSourceOverview() {
  const supabase = await createClient();
  const sources = [...B2C_CUSTOMER_SOURCES, null];
  const rows = await Promise.all(sources.map(async (source) => {
    const query = supabase.from("b2c_students").select("id", { count: "exact", head: true }).is("archived_at", null);
    const { count, error } = await (source === null
      ? query.is("customer_source", null)
      : query.eq("customer_source", source));
    if (error) throw new Error(`Không tải được thống kê nguồn khách: ${error.message}`);
    return { source, label: source ? B2C_CUSTOMER_SOURCE_LABELS[source] ?? source : "Chưa xác định", count: count ?? 0 };
  }));
  return { rows, total: rows.reduce((total, row) => total + row.count, 0) };
}

export async function getB2CStudentCounts() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("b2c_students")
    .select("id", { count: "exact", head: true }).is("archived_at", null);
  if (error) throw new Error(`Không tải được số học viên: ${error.message}`);

  const studentsByProgram = new Map<string, Set<string>>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error: enrollmentError } = await supabase
      .from("b2c_enrollments")
      .select("id, student_id, b2c_classes!inner(program_slug), b2c_students!inner(id)").is("b2c_students.archived_at", null)
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (enrollmentError) {
      throw new Error(`Không tải được số học viên: ${enrollmentError.message}`);
    }
    for (const enrollment of data ?? []) {
      const slug = enrollment.b2c_classes.program_slug;
      const students = studentsByProgram.get(slug) ?? new Set<string>();
      students.add(enrollment.student_id);
      studentsByProgram.set(slug, students);
    }
    if (!data || data.length < pageSize) break;
  }

  return {
    total: count ?? 0,
    byProgram: Object.fromEntries(
      B2C_PROGRAMS.map(({ slug }) => [slug, studentsByProgram.get(slug)?.size ?? 0]),
    ),
  };
}

export async function getB2COverview() {
  const supabase = await createClient();

  const [classesResult, studentsResult, enrollmentsResult, reportResult] =
    await Promise.all([
      supabase
        .from("b2c_classes")
        .select(
          "id, code, name, program_slug, teacher_name, weekdays_text, time_text, capacity, enrolled_count, status",
        )
        .order("code"),
      supabase
        .from("b2c_students")
        .select("id", { count: "exact", head: true }).is("archived_at", null),
      supabase.from("b2c_enrollments").select("class_id, student_id, status, b2c_students!inner(id)").is("b2c_students.archived_at", null),
      supabase
        .from("b2c_monthly_reports")
        .select(
          "id, report_year, report_month, revenue, electricity_cost, water_cost, internet_cost, payroll_cost, teacher_payroll_cost, office_payroll_cost, rent_cost, marketing_cost, advertising_cost, other_cost",
        )
        .order("report_year", { ascending: false })
        .order("report_month", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const firstError = [
    classesResult.error,
    studentsResult.error,
    enrollmentsResult.error,
    reportResult.error,
  ].find(Boolean);
  if (firstError) {
    throw new Error(`Không tải được tổng quan: ${firstError.message}`);
  }

  const classes = classesResult.data ?? [];
  const enrollments = enrollmentsResult.data ?? [];
  const enrollmentCountByClass = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (enrollment.status === "transferred") continue;
    enrollmentCountByClass.set(
      enrollment.class_id,
      (enrollmentCountByClass.get(enrollment.class_id) ?? 0) + 1,
    );
  }

  const programs = B2C_PROGRAMS.map((program) => {
    const programClasses = classes.filter(
      (item) => item.program_slug === program.slug,
    );
    return {
      slug: program.slug,
      title: program.title,
      classCount: programClasses.length,
      activeClassCount: programClasses.filter((item) => item.status === "active")
        .length,
      enrollmentCount: programClasses.reduce(
        (total, item) =>
          total +
          (enrollmentCountByClass.get(item.id) ?? item.enrolled_count ?? 0),
        0,
      ),
      capacity: programClasses.reduce(
        (total, item) => total + (item.capacity ?? 0),
        0,
      ),
    };
  });

  const latestReport = reportResult.data;
  let breakEven: ReturnType<typeof estimateBreakEven> | null = null;
  if (latestReport) {
    const { data: metrics, error: metricsError } = await supabase.from("b2c_monthly_program_metrics").select("opening_students,new_students,departed_students").eq("report_id",latestReport.id);
    if (metricsError) throw new Error("Không tải được dữ liệu tính hòa vốn.");
    breakEven = estimateBreakEven(latestReport, (metrics ?? []).reduce((sum,m) => sum+m.opening_students+m.new_students-m.departed_students,0));
  }
  const totalCost = latestReport
    ? Number(latestReport.electricity_cost) +
      Number(latestReport.water_cost) +
      Number(latestReport.internet_cost) +
      Number(latestReport.payroll_cost) +
      Number(latestReport.rent_cost) +
      Number(latestReport.marketing_cost) +
      Number(latestReport.advertising_cost) +
      Number(latestReport.other_cost)
    : 0;

  return {
    studentCount: studentsResult.count ?? 0,
    enrollmentCount: enrollments.length,
    activeClassCount: classes.filter((item) => item.status === "active").length,
    programCount: programs.filter((item) => item.classCount > 0).length,
    programs,
    classes: classes.map((item) => ({
      ...item,
      actualEnrollmentCount:
        enrollmentCountByClass.get(item.id) ?? item.enrolled_count ?? 0,
    })),
    latestReport: latestReport
      ? {
          ...latestReport,
          revenue: Number(latestReport.revenue),
          totalCost,
          balance: Number(latestReport.revenue) - totalCost,
        }
      : null,
    breakEven,
  };
}

export async function getB2CClasses(programSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("b2c_classes")
    .select(
      "id, code, program_slug, name, level_name, teacher_name, weekdays_text, time_text, capacity, enrolled_count, campus, delivery_mode, start_date, end_date, status, notes",
    )
    .eq("program_slug", programSlug)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("code");

  // Cho phép giao diện mở trước khi quản trị viên chạy migration mới.
  if (error) {
    console.error("Không tải được danh sách lớp", {
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
      `id, class_id, status, withdrawal_reason, learning_goal, certificate_goal, enrollment_date, payment_date, learning_start_date,
       tuition_end_date, registered_sessions, sessions_per_week, salesperson, notes,
       student:b2c_students!inner (id, code, full_name, date_of_birth, birth_year, email, address, phone, customer_source, referrer_name,
         parentLinks:b2c_student_parents (parent:b2c_parents (full_name)))`,
    )
    .in(
      "class_id",
      classes.map((item) => item.id),
    )
    .is("student.archived_at", null)
    .order("source_row");

  if (error) {
    console.error("Không tải được học viên", {
      code: error.code,
      message: error.message,
      programSlug,
    });
    throw new Error("Không tải được học viên. Kiểm tra kết nối và migration trạng thái học viên.");
  }

  return (data ?? []).flatMap((item) => {
    if (!item.student) return [];
    const classRecord = classById.get(item.class_id);
    return [
      {
        id: item.id,
        studentId: item.student.id,
        studentCode: item.student.code,
        customerSource: item.student.customer_source,
        referrerName: item.student.referrer_name,
        studentStatus: item.status,
        withdrawalReason: item.withdrawal_reason,
        learningGoal: item.learning_goal,
        certificateGoal: item.certificate_goal,
        classCode: classRecord?.code ?? "",
        className: classRecord?.name ?? "",
        programSlug: classRecord?.program_slug ?? "",
        fullName: item.student.full_name,
        dateOfBirth: item.student.date_of_birth,
        birthYear: item.student.birth_year,
        guardianName: item.student.parentLinks.map((link) => link.parent?.full_name).filter(Boolean).join(", ") || null,
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
      "id, report_year, report_month, revenue, electricity_cost, water_cost, internet_cost, payroll_cost, teacher_payroll_cost, office_payroll_cost, rent_cost, marketing_cost, advertising_cost, other_cost, notes, updated_at",
    )
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false });

  if (error || !reports?.length) {
    if (error) {
      console.error("Không tải được báo cáo tháng", {
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
    console.error("Không tải được chỉ số chương trình", {
      code: metricError.code,
      message: metricError.message,
    });
  }

  return reports.map((report) => ({
    ...report,
    metrics: (metrics ?? []).filter((metric) => metric.report_id === report.id),
  }));
}
