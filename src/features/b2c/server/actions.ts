"use server";

import { revalidatePath } from "next/cache";

import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { b2cClassSchema, b2cMonthlyReportSchema } from "@/features/b2c/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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
