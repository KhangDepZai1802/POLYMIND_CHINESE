import "server-only";

import { fromZonedTime } from "date-fns-tz";

import { APP_TIMEZONE } from "@/lib/dates";
import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { createClient } from "@/lib/supabase/server";

/**
 * Số liệu tổng quan cho super admin.
 *
 * LUẬT: mọi con số **đọc từ view**, không tự tính lại ở tầng app. `v_*` đã là
 * nguồn sự thật của công thức (chuyên cần, tiến độ, số dư học phí). Viết lại
 * phép tính ở đây là tạo nguồn sự thật thứ hai — sớm muộn hai chỗ lệch nhau và
 * không ai biết chỗ nào đúng (hệ cũ đã dính đúng bug này).
 *
 * View đều `security_invoker = true` → RLS của người gọi vẫn áp dụng.
 */

/** Mốc đầu/cuối ngày hôm nay theo giờ VN, quy về UTC để so với `timestamptz`. */
function todayRangeUtc() {
  const nowVn = new Date(
    new Date().toLocaleString("en-US", { timeZone: APP_TIMEZONE }),
  );
  const y = nowVn.getFullYear();
  const m = String(nowVn.getMonth() + 1).padStart(2, "0");
  const d = String(nowVn.getDate()).padStart(2, "0");

  return {
    from: fromZonedTime(`${y}-${m}-${d}T00:00:00`, APP_TIMEZONE).toISOString(),
    to: fromZonedTime(`${y}-${m}-${d}T23:59:59`, APP_TIMEZONE).toISOString(),
  };
}

export async function getAdminOverview() {
  const supabase = await createClient();
  const { from, to } = todayRangeUtc();

  const [
    openEnrollments,
    activeClasses,
    activeTeachers,
    activeCourses,
    sessionsToday,
    atRisk,
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_ENROLLMENT_STATUSES]),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", from)
      .lte("starts_at", to)
      .neq("status", "cancelled"),
    supabase
      .from("v_at_risk_students")
      .select("enrollment_id", { count: "exact", head: true }),
  ]);

  const firstError = [
    openEnrollments.error,
    activeClasses.error,
    activeTeachers.error,
    activeCourses.error,
    sessionsToday.error,
    atRisk.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error(`Không tải được số liệu tổng quan: ${firstError.message}`);
  }

  return {
    openEnrollments: openEnrollments.count ?? 0,
    activeClasses: activeClasses.count ?? 0,
    activeTeachers: activeTeachers.count ?? 0,
    activeCourses: activeCourses.count ?? 0,
    sessionsToday: sessionsToday.count ?? 0,
    atRiskCount: atRisk.count ?? 0,
  };
}

/** Buổi học hôm nay, sớm nhất trước. */
export async function getSessionsToday() {
  const supabase = await createClient();
  const { from, to } = todayRangeUtc();

  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_number, starts_at, ends_at, status, topic,
       class:classes (id, code, name)`,
    )
    .gte("starts_at", from)
    .lte("starts_at", to)
    .neq("status", "cancelled")
    .order("starts_at");

  if (error) throw new Error(`Không tải được buổi học hôm nay: ${error.message}`);
  return data;
}

/** Tiến độ từng lớp — số liệu lấy nguyên từ `v_class_progress`. */
export async function getClassProgress() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_class_progress")
    .select("*")
    .in("status", ["active", "planned"])
    .order("class_code");

  if (error) throw new Error(`Không tải được tiến độ lớp: ${error.message}`);
  return data;
}

/** Học viên cần chú ý — `v_at_risk_students` đã tự chấm lý do rủi ro. */
export async function getAtRiskStudents(limit = 8) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_at_risk_students")
    .select("*")
    .order("progress_percent", { nullsFirst: true })
    .limit(limit);

  if (error) throw new Error(`Không tải được học viên cần chú ý: ${error.message}`);
  return data;
}

/**
 * Học phí — số dư là GIÁ TRỊ TÍNH RA từ `v_tuition_balance`, không phải bảng
 * công nợ (D-6). Phase 6 mới có UI học phí; ở đây chỉ hiện tổng để admin thấy sớm.
 */
export async function getTuitionSummary() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_tuition_balance")
    .select("balance, is_overdue, status");

  if (error) throw new Error(`Không tải được học phí: ${error.message}`);

  let outstanding = 0;
  let overdueCount = 0;

  for (const row of data) {
    const balance = Number(row.balance ?? 0);
    if (balance > 0) outstanding += balance;
    if (row.is_overdue) overdueCount += 1;
  }

  return { outstanding, overdueCount, invoiceCount: data.length };
}
