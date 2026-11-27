import { z } from "zod";

const money = z.number().int().min(0).max(1_000_000_000_000);

export const b2cStudentTuitionPageSchema = z.object({
  linked_student: z
    .object({ id: z.uuid(), code: z.string(), full_name: z.string() })
    .nullable(),
  periods: z.array(
    z.object({
      enrollment_id: z.uuid(),
      enrollment_status: z.string(),
      class_id: z.uuid(),
      class_code: z.string(),
      class_name: z.string(),
      package_id: z.uuid().nullable(),
      period_no: z.number().int().positive().nullable(),
      is_current: z.boolean().nullable(),
      sessions: z.number().int().positive().nullable(),
      unit_price: money.nullable(),
      discount: money.nullable(),
      total_due: money.nullable(),
      paid_amount: money,
      balance: money.nullable(),
      receipts: z.array(
        z.object({
          id: z.uuid(),
          code: z.string(),
          paid_date: z.iso.date(),
          amount: money,
          method: z.enum(["cash", "bank_transfer"]),
          collector_name: z.string(),
          refunded_amount: money,
          cancelled_at: z.iso.datetime({ offset: true }).nullable(),
          effective_amount: money,
        }),
      ),
    }),
  ),
});

export type B2CStudentTuitionPage = z.infer<
  typeof b2cStudentTuitionPageSchema
>;
export type B2CStudentTuitionPeriod = B2CStudentTuitionPage["periods"][number];
