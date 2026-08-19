import "server-only";

import { createClient } from "@/lib/supabase/server";
import { dateKeyInVN } from "@/lib/dates";

import {
  averageScore,
  buildWeeklyTrend,
  exerciseScoreOn100,
  periodToUtcRange,
  round1,
  summarizeAttendance,
  type AttendanceStatus,
  type AttendanceSummary,
  type LearningPeriod,
} from "../learning";

/**
 * Query của báo cáo HỌC TẬP (`REPORT-REDESIGN-1`).
 *
 * Cùng triết lý `teacher-queries.ts`: **không có một dòng `where teacher_id`
 * nào** — mọi bảng/view đi qua RLS (`security_invoker`), nên cùng một hàm:
 * admin/giáo vụ thấy mọi lớp, giáo viên tự bị khoanh về lớp mình dạy.
 *
 * Vì sao KHÔNG dùng `v_student_attendance_summary` cho phần theo kỳ: view đó
 * hard-code `starts_at <= now()` và không nhận khoảng ngày. Phần theo kỳ query
 * thẳng `class_sessions` + `attendance_records` với đúng công thức của view
 * (đếm buổi `scheduled|completed` đã tới giờ; chuyên cần = (có mặt + muộn) /
 * tổng buổi — buổi chưa điểm danh vẫn nằm trong mẫu số).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PeriodSession = {
  id: string;
  class_id: string;
  session_number: number;
  starts_at: string;
  status: string;
  topic: string | null;
};

export type PeriodAttendanceRow = {
  session_id: string;
  enrollment_id: string;
  status: AttendanceStatus;
  note: string | null;
};

const SESSION_STATUSES = ["scheduled", "completed"] as const;

export async function getPeriodSessions(
  supabase: Supabase,
  period: LearningPeriod,
  classId?: string,
): Promise<PeriodSession[]> {
  const { fromUtc, toUtcExclusive } = periodToUtcRange(period);
  let query = supabase
    .from("class_sessions")
    .select("id, class_id, session_number, starts_at, status, topic")
    .in("status", [...SESSION_STATUSES])
    .lte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(5000);
  if (classId) query = query.eq("class_id", classId);
  if (fromUtc) query = query.gte("starts_at", fromUtc);
  if (toUtcExclusive) query = query.lt("starts_at", toUtcExclusive);

  const { data, error } = await query;
  if (error) throw new Error(`Không tải được danh sách buổi học: ${error.message}`);
  return data ?? [];
}

/**
 * Điểm danh của các buổi đã cho. PostgREST cắt trang ở 1000 dòng — toàn khóa
 * (≈100 buổi × ≈55 học viên) vượt mức đó, nên phân trang tường minh thay vì
 * âm thầm mất dữ liệu.
 */
export async function getAttendanceForSessions(
  supabase: Supabase,
  sessionIds: readonly string[],
  enrollmentId?: string,
): Promise<PeriodAttendanceRow[]> {
  if (sessionIds.length === 0) return [];
  const pageSize = 1000;
  const rows: PeriodAttendanceRow[] = [];
  for (let page = 0; ; page++) {
    let query = supabase
      .from("attendance_records")
      .select("session_id, enrollment_id, status, note")
      .in("session_id", [...sessionIds])
      .order("id")
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (enrollmentId) query = query.eq("enrollment_id", enrollmentId);
    const { data, error } = await query;
    if (error) throw new Error(`Không tải được điểm danh: ${error.message}`);
    const batch = (data ?? []) as PeriodAttendanceRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

/**
 * Điểm trong kỳ, quy về thang 100 — đúng nguồn của
 * `v_enrollment_assessment_progress`: bài tập `final_score / max_score * 100`
 * (đã chấm + đã công bố ở attempt), bài kiểm tra `final_score_100` (đã chấm +
 * delivery đã công bố kết quả). Lọc kỳ theo `submitted_at`.
 */
async function getPeriodScores(
  supabase: Supabase,
  period: LearningPeriod,
  classId?: string,
): Promise<{
  exercise: { enrollment_id: string; class_id: string; score: number }[];
  exam: { enrollment_id: string; class_id: string; score: number }[];
}> {
  const { fromUtc, toUtcExclusive } = periodToUtcRange(period);

  let exerciseDeliveries = supabase
    .from("exercise_deliveries")
    .select("id, class_id, max_score")
    .not("published_at", "is", null)
    .not("status", "in", "(cancelled,archived)")
    .limit(2000);
  if (classId) exerciseDeliveries = exerciseDeliveries.eq("class_id", classId);

  let examDeliveries = supabase
    .from("exam_deliveries")
    .select("id, class_id")
    .not("results_published_at", "is", null)
    .limit(2000);
  if (classId) examDeliveries = examDeliveries.eq("class_id", classId);

  const [exDeliveries, exaDeliveries] = await Promise.all([
    exerciseDeliveries,
    examDeliveries,
  ]);
  if (exDeliveries.error || exaDeliveries.error) {
    throw new Error(
      `Không tải được danh sách bài: ${exDeliveries.error?.message ?? exaDeliveries.error?.message}`,
    );
  }

  const exerciseById = new Map(
    (exDeliveries.data ?? []).map((row) => [row.id, row]),
  );
  const examById = new Map((exaDeliveries.data ?? []).map((row) => [row.id, row]));

  const fetchExerciseAttempts = () => {
    let query = supabase
      .from("exercise_attempts")
      .select("enrollment_id, delivery_id, final_score")
      .in("delivery_id", [...exerciseById.keys()])
      .eq("status", "graded")
      .not("results_published_at", "is", null)
      .not("final_score", "is", null)
      .limit(5000);
    if (fromUtc) query = query.gte("submitted_at", fromUtc);
    if (toUtcExclusive) query = query.lt("submitted_at", toUtcExclusive);
    return query;
  };
  const fetchExamAttempts = () => {
    let query = supabase
      .from("exam_attempts")
      .select("enrollment_id, exam_delivery_id, final_score_100")
      .in("exam_delivery_id", [...examById.keys()])
      .eq("status", "graded")
      .not("final_score_100", "is", null)
      .limit(5000);
    if (fromUtc) query = query.gte("submitted_at", fromUtc);
    if (toUtcExclusive) query = query.lt("submitted_at", toUtcExclusive);
    return query;
  };

  const [exerciseAttempts, examAttempts] = await Promise.all([
    exerciseById.size
      ? fetchExerciseAttempts()
      : Promise.resolve({ data: [], error: null }),
    examById.size
      ? fetchExamAttempts()
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (exerciseAttempts.error || examAttempts.error) {
    throw new Error(
      `Không tải được điểm: ${exerciseAttempts.error?.message ?? examAttempts.error?.message}`,
    );
  }

  const exercise = (exerciseAttempts.data ?? []).flatMap((attempt) => {
    const delivery = exerciseById.get(attempt.delivery_id);
    const score = exerciseScoreOn100(
      Number(attempt.final_score),
      Number(delivery?.max_score ?? 0),
    );
    if (!delivery || score === null) return [];
    return [
      {
        enrollment_id: attempt.enrollment_id,
        class_id: delivery.class_id,
        score,
      },
    ];
  });
  const exam = (examAttempts.data ?? []).flatMap((attempt) => {
    const delivery = examById.get(attempt.exam_delivery_id);
    if (!delivery) return [];
    return [
      {
        enrollment_id: attempt.enrollment_id,
        class_id: delivery.class_id,
        score: Number(attempt.final_score_100),
      },
    ];
  });

  return { exercise, exam };
}

export type AtRiskStudent = {
  enrollment_id: string;
  student_id: string;
  class_id: string;
  full_name: string;
  student_code: string;
  class_name: string;
  attendance_rate: number | null;
  avg_score: number | null;
  progress_percent: number | null;
  missing_exercises: number;
  risk_reasons: string[];
};

async function getAtRiskStudents(
  supabase: Supabase,
  classId?: string,
): Promise<AtRiskStudent[]> {
  let query = supabase
    .from("v_at_risk_assessment_students")
    .select(
      `enrollment_id, student_id, class_id, full_name, student_code, class_name,
       attendance_rate, avg_score, progress_percent, missing_exercises, risk_reasons`,
    )
    .limit(1000);
  if (classId) query = query.eq("class_id", classId);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Không tải được danh sách cần chú ý: ${error.message}`);
  }
  return (data ?? [])
    .map((row) => ({
      enrollment_id: row.enrollment_id as string,
      student_id: row.student_id as string,
      class_id: row.class_id as string,
      full_name: (row.full_name as string) ?? "Học viên",
      student_code: (row.student_code as string) ?? "",
      class_name: (row.class_name as string) ?? "",
      attendance_rate: toNumber(row.attendance_rate),
      avg_score: toNumber(row.avg_score),
      progress_percent: toNumber(row.progress_percent),
      missing_exercises: Number(row.missing_exercises ?? 0),
      risk_reasons: Array.isArray(row.risk_reasons)
        ? (row.risk_reasons as string[])
        : [],
    }))
    .sort(
      // Nặng lên trước: nhiều lý do hơn → chuyên cần thấp hơn.
      (a, b) =>
        b.risk_reasons.length - a.risk_reasons.length ||
        (a.attendance_rate ?? 101) - (b.attendance_rate ?? 101),
    );
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Tầng 1 — Tổng quan trung tâm
// ---------------------------------------------------------------------------

export type LearningOverview = Awaited<ReturnType<typeof getLearningOverview>>;

export async function getLearningOverview(period: LearningPeriod) {
  const supabase = await createClient();

  const [classesResult, progressResult, enrollmentsResult, sessions, atRisk, scores] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id, code, name, status")
        .neq("status", "cancelled")
        .order("code"),
      supabase
        .from("v_class_assessment_progress")
        .select(
          "class_id, active_students, completed_students, avg_progress_percent",
        ),
      supabase
        .from("enrollments")
        .select("id, class_id")
        .eq("status", "active")
        .limit(5000),
      getPeriodSessions(supabase, period),
      getAtRiskStudents(supabase),
      getPeriodScores(supabase, period),
    ]);

  if (classesResult.error || progressResult.error || enrollmentsResult.error) {
    throw new Error(
      `Không tải được báo cáo học tập: ${
        classesResult.error?.message ??
        progressResult.error?.message ??
        enrollmentsResult.error?.message
      }`,
    );
  }

  const classes = classesResult.data ?? [];
  const progressByClass = new Map(
    (progressResult.data ?? []).map((row) => [row.class_id, row]),
  );
  const enrollments = enrollmentsResult.data ?? [];

  const activeByClass = new Map<string, number>();
  for (const enrollment of enrollments) {
    if (!enrollment.class_id) continue;
    activeByClass.set(
      enrollment.class_id,
      (activeByClass.get(enrollment.class_id) ?? 0) + 1,
    );
  }

  const records = await getAttendanceForSessions(
    supabase,
    sessions.map((session) => session.id),
  );

  const sessionsByClass = new Map<string, PeriodSession[]>();
  for (const session of sessions) {
    const list = sessionsByClass.get(session.class_id) ?? [];
    list.push(session);
    sessionsByClass.set(session.class_id, list);
  }
  const sessionClassById = new Map(
    sessions.map((session) => [session.id, session.class_id]),
  );
  const attendedByClass = new Map<string, number>();
  for (const record of records) {
    if (record.status !== "present" && record.status !== "late") continue;
    const recordClassId = sessionClassById.get(record.session_id);
    if (!recordClassId) continue;
    attendedByClass.set(
      recordClassId,
      (attendedByClass.get(recordClassId) ?? 0) + 1,
    );
  }

  const scoresByClass = new Map<string, number[]>();
  for (const item of [...scores.exercise, ...scores.exam]) {
    const list = scoresByClass.get(item.class_id) ?? [];
    list.push(item.score);
    scoresByClass.set(item.class_id, list);
  }

  const atRiskByClass = new Map<string, number>();
  for (const student of atRisk) {
    atRiskByClass.set(
      student.class_id,
      (atRiskByClass.get(student.class_id) ?? 0) + 1,
    );
  }

  const classRows = classes.map((item) => {
    const classSessions = sessionsByClass.get(item.id) ?? [];
    const activeStudents =
      activeByClass.get(item.id) ??
      Number(progressByClass.get(item.id)?.active_students ?? 0);
    const expectedSlots = classSessions.length * activeStudents;
    const attended = attendedByClass.get(item.id) ?? 0;
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      status: item.status,
      activeStudents,
      sessionsInPeriod: classSessions.length,
      attendanceRate:
        expectedSlots > 0 ? round1((100 * attended) / expectedSlots) : null,
      avgScore: averageScore(scoresByClass.get(item.id) ?? []),
      progressPercent: toNumber(
        progressByClass.get(item.id)?.avg_progress_percent,
      ),
      atRiskCount: atRiskByClass.get(item.id) ?? 0,
    };
  });

  const totalExpected = classRows.reduce(
    (sum, row) => sum + row.sessionsInPeriod * row.activeStudents,
    0,
  );
  const totalAttended = [...attendedByClass.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const allScores = [...scores.exercise, ...scores.exam].map(
    (item) => item.score,
  );

  const trend = buildWeeklyTrend(
    sessions.map((session) => ({
      id: session.id,
      classId: session.class_id,
      dateKey: dateKeyInVN(session.starts_at),
    })),
    records.map((record) => ({
      sessionId: record.session_id,
      status: record.status,
    })),
    activeByClass,
  );

  return {
    period,
    kpis: {
      activeStudents: enrollments.length,
      attendanceRate:
        totalExpected > 0 ? round1((100 * totalAttended) / totalExpected) : null,
      avgScore: averageScore(allScores),
      atRiskCount: atRisk.length,
      sessionsHeld: sessions.length,
    },
    classes: classRows,
    atRisk,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Export — mỗi học viên một dòng, mọi lớp (AC4.3)
// ---------------------------------------------------------------------------

export type LearningStudentRow = {
  studentCode: string;
  fullName: string;
  classCode: string;
  className: string;
  enrollmentStatus: string;
  attendance: AttendanceSummary;
  periodAvgScore: number | null;
  submittedExercises: number;
  totalExercises: number;
  progressPercent: number | null;
  riskReasons: string[];
};

export async function getLearningStudentRows(
  period: LearningPeriod,
): Promise<LearningStudentRow[]> {
  const supabase = await createClient();

  const [enrollmentsResult, progressResult, sessions, atRisk, scores] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select(
          `id, status, class_id,
           student:students (id, student_code, full_name),
           class:classes (id, code, name)`,
        )
        .not("status", "in", "(withdrawn,transferred)")
        .limit(5000),
      supabase
        .from("v_enrollment_assessment_progress")
        .select(
          `enrollment_id, total_exercises, submitted_exercises, progress_percent`,
        )
        .limit(5000),
      getPeriodSessions(supabase, period),
      getAtRiskStudents(supabase),
      getPeriodScores(supabase, period),
    ]);
  if (enrollmentsResult.error || progressResult.error) {
    throw new Error(
      `Không tải được dữ liệu export: ${
        enrollmentsResult.error?.message ?? progressResult.error?.message
      }`,
    );
  }

  const records = await getAttendanceForSessions(
    supabase,
    sessions.map((session) => session.id),
  );

  const sessionCountByClass = new Map<string, number>();
  for (const session of sessions) {
    sessionCountByClass.set(
      session.class_id,
      (sessionCountByClass.get(session.class_id) ?? 0) + 1,
    );
  }
  const statusesByEnrollment = new Map<string, AttendanceStatus[]>();
  for (const record of records) {
    const list = statusesByEnrollment.get(record.enrollment_id) ?? [];
    list.push(record.status);
    statusesByEnrollment.set(record.enrollment_id, list);
  }
  const scoresByEnrollment = new Map<string, number[]>();
  for (const item of [...scores.exercise, ...scores.exam]) {
    const list = scoresByEnrollment.get(item.enrollment_id) ?? [];
    list.push(item.score);
    scoresByEnrollment.set(item.enrollment_id, list);
  }
  const progressByEnrollment = new Map(
    (progressResult.data ?? []).map((row) => [row.enrollment_id, row]),
  );
  const atRiskByEnrollment = new Map(
    atRisk.map((student) => [student.enrollment_id, student]),
  );

  return (enrollmentsResult.data ?? [])
    .map((enrollment) => {
      const progress = progressByEnrollment.get(enrollment.id);
      return {
        studentCode: enrollment.student?.student_code ?? "",
        fullName: enrollment.student?.full_name ?? "",
        classCode: enrollment.class?.code ?? "",
        className: enrollment.class?.name ?? "",
        enrollmentStatus: enrollment.status,
        attendance: summarizeAttendance(
          statusesByEnrollment.get(enrollment.id) ?? [],
          enrollment.class_id
            ? (sessionCountByClass.get(enrollment.class_id) ?? 0)
            : 0,
        ),
        periodAvgScore: averageScore(scoresByEnrollment.get(enrollment.id) ?? []),
        submittedExercises: Number(progress?.submitted_exercises ?? 0),
        totalExercises: Number(progress?.total_exercises ?? 0),
        progressPercent: toNumber(progress?.progress_percent),
        riskReasons: atRiskByEnrollment.get(enrollment.id)?.risk_reasons ?? [],
      };
    })
    .sort(
      (a, b) =>
        a.classCode.localeCompare(b.classCode, "vi") ||
        a.fullName.localeCompare(b.fullName, "vi"),
    );
}

// ---------------------------------------------------------------------------
// Tầng 2 — Chi tiết một lớp
// ---------------------------------------------------------------------------

export type ClassLearningReport = Awaited<
  ReturnType<typeof getClassLearningReport>
> | null;

export type ClassReportRow = {
  enrollmentId: string;
  status: string;
  student: { id: string; student_code: string; full_name: string } | null;
  attendance: AttendanceSummary;
  /** Điểm TB trong kỳ (gộp bài tập + kiểm tra, thang 100) — D10. */
  periodAvgScore: number | null;
  progress: {
    total_lessons: number;
    completed_lessons: number;
    total_exercises: number;
    submitted_exercises: number;
    avg_score: number | null;
    attendance_rate: number | null;
    progress_percent: number | null;
    is_completion_ready: boolean;
  } | null;
  atRisk: boolean;
  riskReasons: string[];
};

export async function getClassLearningReport(
  classId: string,
  period: LearningPeriod,
) {
  const supabase = await createClient();

  const classResult = await supabase
    .from("classes")
    .select("id, code, name, status")
    .eq("id", classId)
    .maybeSingle();
  if (classResult.error) {
    throw new Error(`Không tải được lớp: ${classResult.error.message}`);
  }
  if (!classResult.data) return null;

  const [summaryResult, enrollmentsResult, progressResult, sessions, atRisk, scores] =
    await Promise.all([
      supabase
        .from("v_class_assessment_progress")
        .select(
          `class_id, active_students, completed_students, avg_attendance_rate,
           avg_score, avg_progress_percent`,
        )
        .eq("class_id", classId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("id, status, student:students (id, student_code, full_name)")
        .eq("class_id", classId)
        .not("status", "in", "(withdrawn,transferred)"),
      supabase
        .from("v_enrollment_assessment_progress")
        .select(
          `enrollment_id, total_lessons, completed_lessons, total_exercises,
           submitted_exercises, avg_score, attendance_rate, progress_percent,
           is_completion_ready`,
        )
        .eq("class_id", classId),
      getPeriodSessions(supabase, period, classId),
      getAtRiskStudents(supabase, classId),
      getPeriodScores(supabase, period, classId),
    ]);

  const failed = [summaryResult, enrollmentsResult, progressResult].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Không tải được báo cáo lớp: ${failed.error.message}`);
  }

  const records = await getAttendanceForSessions(
    supabase,
    sessions.map((session) => session.id),
  );

  const progressByEnrollment = new Map(
    (progressResult.data ?? []).map((row) => [row.enrollment_id, row]),
  );
  const atRiskByEnrollment = new Map(
    atRisk.map((student) => [student.enrollment_id, student]),
  );

  const statusesByEnrollment = new Map<string, AttendanceStatus[]>();
  for (const record of records) {
    const list = statusesByEnrollment.get(record.enrollment_id) ?? [];
    list.push(record.status);
    statusesByEnrollment.set(record.enrollment_id, list);
  }

  const scoresByEnrollment = new Map<string, number[]>();
  for (const item of [...scores.exercise, ...scores.exam]) {
    const list = scoresByEnrollment.get(item.enrollment_id) ?? [];
    list.push(item.score);
    scoresByEnrollment.set(item.enrollment_id, list);
  }

  const cellByKey = new Map<string, { status: AttendanceStatus; note: string | null }>();
  for (const record of records) {
    cellByKey.set(`${record.session_id}:${record.enrollment_id}`, {
      status: record.status,
      note: record.note,
    });
  }

  const rows: ClassReportRow[] = (enrollmentsResult.data ?? [])
    .map((enrollment) => {
      const progress = progressByEnrollment.get(enrollment.id) ?? null;
      const atRiskRow = atRiskByEnrollment.get(enrollment.id);
      return {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        student: enrollment.student,
        attendance: summarizeAttendance(
          statusesByEnrollment.get(enrollment.id) ?? [],
          sessions.length,
        ),
        periodAvgScore: averageScore(scoresByEnrollment.get(enrollment.id) ?? []),
        progress: progress
          ? {
              total_lessons: Number(progress.total_lessons ?? 0),
              completed_lessons: Number(progress.completed_lessons ?? 0),
              total_exercises: Number(progress.total_exercises ?? 0),
              submitted_exercises: Number(progress.submitted_exercises ?? 0),
              avg_score: toNumber(progress.avg_score),
              attendance_rate: toNumber(progress.attendance_rate),
              progress_percent: toNumber(progress.progress_percent),
              is_completion_ready: Boolean(progress.is_completion_ready),
            }
          : null,
        atRisk: Boolean(atRiskRow),
        riskReasons: atRiskRow?.risk_reasons ?? [],
      };
    })
    .sort((a, b) =>
      (a.student?.full_name ?? "").localeCompare(
        b.student?.full_name ?? "",
        "vi",
      ),
    );

  return {
    period,
    classInfo: classResult.data,
    summary: summaryResult.data
      ? {
          active_students: Number(summaryResult.data.active_students ?? 0),
          completed_students: Number(summaryResult.data.completed_students ?? 0),
          avg_attendance_rate: toNumber(summaryResult.data.avg_attendance_rate),
          avg_score: toNumber(summaryResult.data.avg_score),
          avg_progress_percent: toNumber(
            summaryResult.data.avg_progress_percent,
          ),
        }
      : null,
    sessions,
    /** Ô lưới: `"{sessionId}:{enrollmentId}"` → trạng thái + ghi chú. */
    cellByKey,
    rows,
    atRisk,
  };
}

// ---------------------------------------------------------------------------
// Tầng 3 — Hồ sơ một học viên
// ---------------------------------------------------------------------------

export type StudentLearningReport = Awaited<
  ReturnType<typeof getStudentLearningReport>
> | null;

export async function getStudentLearningReport(
  enrollmentId: string,
  period: LearningPeriod,
) {
  const supabase = await createClient();

  const enrollmentResult = await supabase
    .from("enrollments")
    .select(
      `id, status, class_id,
       student:students (id, student_code, full_name),
       class:classes (id, code, name, status)`,
    )
    .eq("id", enrollmentId)
    .maybeSingle();
  if (enrollmentResult.error) {
    throw new Error(`Không tải được hồ sơ: ${enrollmentResult.error.message}`);
  }
  const enrollment = enrollmentResult.data;
  if (!enrollment || !enrollment.class_id) return null;

  const { fromUtc, toUtcExclusive } = periodToUtcRange(period);

  const [sessions, progressResult, atRisk] = await Promise.all([
    getPeriodSessions(supabase, period, enrollment.class_id),
    supabase
      .from("v_enrollment_assessment_progress")
      .select(
        `enrollment_id, total_lessons, completed_lessons, total_exercises,
         submitted_exercises, avg_score, attendance_rate, progress_percent,
         is_completion_ready, completion_min_attendance_rate,
         completion_min_overall_score`,
      )
      .eq("enrollment_id", enrollmentId)
      .maybeSingle(),
    getAtRiskStudents(supabase, enrollment.class_id),
  ]);
  if (progressResult.error) {
    throw new Error(`Không tải được tiến độ: ${progressResult.error.message}`);
  }

  const records = await getAttendanceForSessions(
    supabase,
    sessions.map((session) => session.id),
    enrollmentId,
  );
  const recordBySession = new Map(
    records.map((record) => [record.session_id, record]),
  );

  // Danh sách bài trong kỳ — lọc theo hạn nộp (bài tập) / kết quả đã công bố.
  let exerciseDeliveriesQuery = supabase
    .from("exercise_deliveries")
    .select("id, title, due_at, max_score")
    .eq("class_id", enrollment.class_id)
    .not("published_at", "is", null)
    .not("status", "in", "(cancelled,archived)")
    .order("due_at", { ascending: false })
    .limit(500);
  if (fromUtc) exerciseDeliveriesQuery = exerciseDeliveriesQuery.gte("due_at", fromUtc);
  if (toUtcExclusive) {
    exerciseDeliveriesQuery = exerciseDeliveriesQuery.lt("due_at", toUtcExclusive);
  }

  let examDeliveriesQuery = supabase
    .from("exam_deliveries")
    .select("id, title, exam_type, opens_at, results_published_at")
    .eq("class_id", enrollment.class_id)
    .not("published_at", "is", null)
    .order("opens_at", { ascending: false })
    .limit(500);
  if (fromUtc) examDeliveriesQuery = examDeliveriesQuery.gte("opens_at", fromUtc);
  if (toUtcExclusive) {
    examDeliveriesQuery = examDeliveriesQuery.lt("opens_at", toUtcExclusive);
  }

  const [exerciseDeliveries, examDeliveries] = await Promise.all([
    exerciseDeliveriesQuery,
    examDeliveriesQuery,
  ]);
  if (exerciseDeliveries.error || examDeliveries.error) {
    throw new Error(
      `Không tải được danh sách bài: ${
        exerciseDeliveries.error?.message ?? examDeliveries.error?.message
      }`,
    );
  }

  const [exerciseAttempts, examAttempts] = await Promise.all([
    (exerciseDeliveries.data ?? []).length
      ? supabase
          .from("exercise_attempts")
          .select(
            "delivery_id, status, submitted_at, final_score, results_published_at",
          )
          .eq("enrollment_id", enrollmentId)
          .in(
            "delivery_id",
            (exerciseDeliveries.data ?? []).map((row) => row.id),
          )
          .neq("status", "invalidated")
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    (examDeliveries.data ?? []).length
      ? supabase
          .from("exam_attempts")
          .select("exam_delivery_id, status, submitted_at, final_score_100")
          .eq("enrollment_id", enrollmentId)
          .in(
            "exam_delivery_id",
            (examDeliveries.data ?? []).map((row) => row.id),
          )
          .neq("status", "invalidated")
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (exerciseAttempts.error || examAttempts.error) {
    throw new Error(
      `Không tải được bài làm: ${
        exerciseAttempts.error?.message ?? examAttempts.error?.message
      }`,
    );
  }

  const exerciseAttemptByDelivery = new Map<
    string,
    NonNullable<typeof exerciseAttempts.data>[number]
  >();
  for (const attempt of exerciseAttempts.data ?? []) {
    // Nhiều lượt làm → giữ lượt có điểm công bố, nếu chưa có thì lượt mới nhất.
    const current = exerciseAttemptByDelivery.get(attempt.delivery_id);
    const attemptPublished =
      attempt.status === "graded" && attempt.results_published_at !== null;
    const currentPublished =
      current?.status === "graded" && current.results_published_at !== null;
    if (!current || (attemptPublished && !currentPublished)) {
      exerciseAttemptByDelivery.set(attempt.delivery_id, attempt);
    }
  }
  const examAttemptByDelivery = new Map(
    (examAttempts.data ?? []).map((attempt) => [
      attempt.exam_delivery_id,
      attempt,
    ]),
  );

  const exerciseRows = (exerciseDeliveries.data ?? []).map((delivery) => {
    const attempt = exerciseAttemptByDelivery.get(delivery.id);
    const published =
      attempt?.status === "graded" && attempt.results_published_at !== null;
    const score =
      published && attempt?.final_score !== null && attempt !== undefined
        ? exerciseScoreOn100(
            Number(attempt.final_score),
            Number(delivery.max_score ?? 0),
          )
        : null;
    return {
      id: delivery.id,
      title: delivery.title,
      dueAt: delivery.due_at,
      submittedAt: attempt?.submitted_at ?? null,
      score: score === null ? null : round1(score),
      state: published
        ? ("published" as const)
        : attempt?.submitted_at
          ? ("submitted" as const)
          : ("missing" as const),
    };
  });

  const examRows = (examDeliveries.data ?? []).map((delivery) => {
    const attempt = examAttemptByDelivery.get(delivery.id);
    const published =
      delivery.results_published_at !== null &&
      attempt?.status === "graded" &&
      attempt.final_score_100 !== null;
    return {
      id: delivery.id,
      title: delivery.title,
      opensAt: delivery.opens_at,
      submittedAt: attempt?.submitted_at ?? null,
      score: published ? round1(Number(attempt?.final_score_100)) : null,
      state: published
        ? ("published" as const)
        : attempt?.submitted_at
          ? ("submitted" as const)
          : ("missing" as const),
    };
  });

  const attendanceHistory = sessions
    .map((session) => ({
      session,
      record: recordBySession.get(session.id) ?? null,
    }))
    .sort((a, b) => (a.session.starts_at < b.session.starts_at ? 1 : -1));

  const atRiskRow =
    atRisk.find((student) => student.enrollment_id === enrollmentId) ?? null;
  const progress = progressResult.data;

  return {
    period,
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      student: enrollment.student,
      class: enrollment.class,
    },
    attendance: summarizeAttendance(
      records.map((record) => record.status),
      sessions.length,
    ),
    attendanceHistory,
    exerciseRows,
    examRows,
    avgExerciseScore: averageScore(
      exerciseRows.flatMap((row) => (row.score === null ? [] : [row.score])),
    ),
    avgExamScore: averageScore(
      examRows.flatMap((row) => (row.score === null ? [] : [row.score])),
    ),
    progress: progress
      ? {
          total_lessons: Number(progress.total_lessons ?? 0),
          completed_lessons: Number(progress.completed_lessons ?? 0),
          total_exercises: Number(progress.total_exercises ?? 0),
          submitted_exercises: Number(progress.submitted_exercises ?? 0),
          avg_score: toNumber(progress.avg_score),
          attendance_rate: toNumber(progress.attendance_rate),
          progress_percent: toNumber(progress.progress_percent),
          is_completion_ready: Boolean(progress.is_completion_ready),
          min_attendance_rate: toNumber(
            progress.completion_min_attendance_rate,
          ),
          min_overall_score: toNumber(progress.completion_min_overall_score),
        }
      : null,
    atRisk: atRiskRow,
  };
}
