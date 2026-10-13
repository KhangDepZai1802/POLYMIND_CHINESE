"use server";

import { revalidatePath } from "next/cache";

import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { b2cClassSchema, b2cMonthlyReportSchema, b2cEnrollmentEditSchema, b2cAdmissionSchema, b2cCareLogSchema, b2cParentSchema } from "@/features/b2c/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { B2C_CUSTOMER_SOURCES } from "@/features/b2c/domain/customer-source";

export async function saveB2CParentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireManager();
  const parsed = b2cParentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  const { error } = await (await createClient()).rpc("save_b2c_parent", { p_id: v.id || null, p_name: v.full_name, p_phone: v.phone, p_zalo: v.zalo, p_student_codes: v.student_codes, p_relationship: v.relationship });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath("/admin/b2c", "layout");
  return { success: "Đã lưu thông tin phụ huynh." };
}

export async function saveB2CCareLogAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireManager();
  const parsed = b2cCareLogSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const { error } = await (await createClient()).from("b2c_admission_care_logs").insert({ ...parsed.data, created_by: actor.id });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath("/admin/b2c/admissions");
  return { success: "Đã lưu nhật ký chăm sóc." };
}

export async function getB2CCareLogsAction(leadId: string, page: number) {
  await requireManager();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId) || !Number.isSafeInteger(page) || page < 0 || page > 1000000) return { logs: [], total: 0, error: "Bộ lọc không hợp lệ." };
  const { data, count, error } = await (await createClient()).from("b2c_admission_care_logs")
    .select("id, channel, contact_date, caretaker_name, content, next_followup_date", { count: "exact" })
    .eq("lead_id", leadId).order("created_at", { ascending: false }).order("id")
    .range(page * 20, page * 20 + 19);
  if (error) return { logs: [], total: 0, error: "Không tải được nhật ký chăm sóc." };
  return { logs: data ?? [], total: count ?? 0 };
}

export async function saveB2CAdmissionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireManager();
  const parsed = b2cAdmissionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const { id, ...values } = parsed.data;
  const supabase = await createClient();
  const query = id ? supabase.from("b2c_admission_leads").update(values).eq("id", id)
    : supabase.from("b2c_admission_leads").insert({ ...values, created_by: actor.id });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { error: dbErrorToMessage(error) };
  if (!data) return { error: "Không tìm thấy khách hoặc bạn không có quyền cập nhật." };
  revalidatePath("/admin/b2c/admissions");
  return { success: id ? "Đã cập nhật khách tuyển sinh." : "Đã thêm khách tuyển sinh." };
}

export async function getB2CSourceStudentsAction(source: string | null, page: number) {
  await requireManager();
  if ((source !== null && !B2C_CUSTOMER_SOURCES.some((value) => value === source)) || !Number.isSafeInteger(page) || page < 0 || page > 1000000) {
    return { error: "Bộ lọc không hợp lệ.", students: [], total: 0 };
  }
  const query = (await createClient()).from("b2c_students")
    .select("id, code, full_name, phone, referrer_name", { count: "exact" })
    .order("full_name").order("id").range(page * 50, page * 50 + 49);
  const { data, count, error } = await (source === null ? query.is("customer_source", null) : query.eq("customer_source", source));
  if (error) return { error: "Không tải được danh sách học viên. Vui lòng thử lại.", students: [], total: 0 };
  return { students: data ?? [], total: count ?? 0 };
}

export async function updateB2CEnrollmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireManager();
  const parsed = b2cEnrollmentEditSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  const { error } = await (await createClient()).rpc("update_b2c_enrollment", {
    p_enrollment_id: v.enrollment_id, p_phone: v.phone, p_salesperson: v.salesperson,
    p_enrollment_date: v.enrollment_date, p_program_slug: v.program_slug,
    p_learning_start_date: v.learning_start_date ?? undefined,
    p_tuition_end_date: v.tuition_end_date ?? undefined,
    p_status: v.status, p_withdrawal_reason: v.withdrawal_reason ?? undefined,
    p_customer_source: v.customer_source ?? undefined, p_referrer_name: v.referrer_name ?? undefined,
    p_learning_goal: v.learning_goal ?? undefined, p_certificate_goal: v.certificate_goal ?? undefined,
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath("/admin/b2c", "layout");
  return { success: "Đã cập nhật ghi danh." };
}

export async function createB2CClassAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireManager();
  const parsed = b2cClassSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("b2c_classes")
    .insert({ ...parsed.data, created_by: actor.id })
    .select("name")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath("/admin/b2c");
  revalidatePath(`/admin/b2c/${parsed.data.program_slug}`);
  return { success: `Đã tạo lớp "${data.name}".` };
}

export async function saveB2CMonthlyReportAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireManager();

  const metricFields = [
    "opening_students",
    "new_students",
    "departed_students",
    "lessons_taught",
    "lessons_paid",
  ] as const;
  const parsed = b2cMonthlyReportSchema.safeParse({
    report_year: formData.get("report_year"),
    report_month: formData.get("report_month"),
    revenue: formData.get("revenue"),
    electricity: formData.get("electricity"),
    water: formData.get("water"),
    internet: formData.get("internet"),
    payroll: formData.get("payroll"),
    rent: formData.get("rent"),
    marketing: formData.get("marketing"),
    advertising: formData.get("advertising"),
    other: formData.get("other"),
    notes: formData.get("notes"),
    metrics: B2C_PROGRAMS.map((program) => ({
      program_slug: program.slug,
      ...Object.fromEntries(
        metricFields.map((field) => [
          field,
          formData.get(`${program.slug}_${field}`),
        ]),
      ),
    })),
  });
  if (!parsed.success) return zodToActionState(parsed.error);

  const { data, error } = await (
    await createClient()
  ).rpc("save_b2c_monthly_report", {
    p_year: parsed.data.report_year,
    p_month: parsed.data.report_month,
    p_revenue: parsed.data.revenue,
    p_costs: {
      electricity: parsed.data.electricity,
      water: parsed.data.water,
      internet: parsed.data.internet,
      payroll: parsed.data.payroll,
      rent: parsed.data.rent,
      marketing: parsed.data.marketing,
      advertising: parsed.data.advertising,
      other: parsed.data.other,
    },
    p_metrics: parsed.data.metrics,
    p_notes: parsed.data.notes ?? undefined,
  });
  if (error || !data) return { error: dbErrorToMessage(error ?? {}) };

  revalidatePath("/admin/b2c/reports");
  return {
    success: `Đã lưu báo cáo tháng ${parsed.data.report_month}/${parsed.data.report_year}.`,
  };
}
