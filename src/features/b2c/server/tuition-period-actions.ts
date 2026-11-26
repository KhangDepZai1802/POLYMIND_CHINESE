"use server";

import { z } from "zod";
import { b2cTuitionPackageSchema } from "@/features/b2c/tuition-schema";
import { requireTeaching } from "@/lib/auth/session";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import { permissionRpc } from "./permission-rpc";
import { revalidateB2CViews } from "./revalidate-views";

const money = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập số tiền.")
  .transform(Number)
  .pipe(z.number().int().min(0).max(1000000000000));

// A blank price must not silently become a free new period through coercion.
const valuesSchema = z
  .object({
    enrollment_id: z.string(),
    sessions: z.string().trim().min(1, "Vui lòng nhập số buổi."),
    unit_price: z.string().trim().min(1, "Vui lòng nhập đơn giá."),
    discount: z.string().trim().min(1, "Vui lòng nhập chiết khấu."),
    discount_reason: z.string(),
  })
  .transform((value, ctx) => {
    const parsed = b2cTuitionPackageSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
      }
      return z.NEVER;
    }
    return parsed.data;
  });

const contextSchema = z.object({
  expected_due: money,
  expected_paid: money,
  adjustment_reason: z.string().trim().min(1, "Vui lòng nhập lý do.").max(1000),
});

const editSchema = valuesSchema.and(
  contextSchema.extend({ package_id: z.uuid() }),
);
const startSchema = valuesSchema.and(
  contextSchema.extend({
    previous_package_id: z.uuid(),
    request_id: z.uuid(),
  }),
);

export async function saveB2CTuitionPeriodAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireTeaching("super_admin");
  const parsed = editSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  try {
    await permissionRpc<string>("save_b2c_tuition_period", {
      p_package_id: v.package_id,
      p_sessions: v.sessions,
      p_unit_price: v.unit_price,
      p_discount: v.discount,
      p_discount_reason: v.discount_reason,
      p_reason: v.adjustment_reason,
      p_expected_due: v.expected_due,
      p_expected_paid: v.expected_paid,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Không lưu được học phí.",
    };
  }
  revalidateB2CViews();
  return { success: "Đã lưu đợt học phí." };
}

export async function startB2CTuitionPeriodAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireTeaching("super_admin");
  const parsed = startSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  try {
    await permissionRpc<string>("start_b2c_tuition_period", {
      p_enrollment_id: v.enrollment_id,
      p_previous_package_id: v.previous_package_id,
      p_request_id: v.request_id,
      p_sessions: v.sessions,
      p_unit_price: v.unit_price,
      p_discount: v.discount,
      p_discount_reason: v.discount_reason,
      p_reason: v.adjustment_reason,
      p_expected_due: v.expected_due,
      p_expected_paid: v.expected_paid,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Không tạo được đợt học phí.",
    };
  }
  revalidateB2CViews();
  return { success: "Đã tạo đợt học phí mới." };
}
