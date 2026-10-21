"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  saleWorkPersonSchema,
  saleWorkSnapshotSchema,
} from "../salework-schema";

export async function readSaleWorkReport(person: string, date: string) {
  await requireUser();
  const slug = saleWorkPersonSchema.parse(person);
  const day = z.iso.date().parse(date);
  const db = await createClient();
  const [report, snapshot] = await Promise.all([
    db
      .from("salework_daily_reports")
      .select("*")
      .eq("person_slug", slug)
      .eq("work_date", day)
      .maybeSingle(),
    db
      .from("bikeforce_salework_snapshots")
      .select("snapshot")
      .eq("person_slug", slug)
      .eq("work_date", day)
      .maybeSingle(),
  ]);
  if (report.error || snapshot.error)
    throw new Error(
      "Chưa tải được báo cáo. Kiểm tra migration SQL đã được áp dụng.",
    );
  const parsed = saleWorkSnapshotSchema.safeParse(snapshot.data?.snapshot);
  return { report: report.data, snapshot: parsed.success ? parsed.data : null };
}

const inputSchema = z.object({
  person: saleWorkPersonSchema,
  date: z.iso.date(),
  closed_customers: z.number().int().min(0).max(1000000),
  collected_amount: z.number().int().min(0).max(999999999999),
  closed_courses: z.number().int().min(0).max(1000000),
  notes: z.string().trim().max(500).optional(),
});

export async function saveSaleWorkReport(input: unknown) {
  const user = await requireUser();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return {
      error:
        "Nhập số nguyên không âm cho ba chỉ số và ghi chú tối đa 500 ký tự.",
    };
  const db = await createClient();
  const { data: owner, error: ownerError } = await db
    .from("salework_report_people")
    .select("person_slug")
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownerError || owner?.person_slug !== parsed.data.person)
    return { error: "Bạn chỉ được sửa báo cáo của mình." };
  const { person, date, ...values } = parsed.data;
  const { error } = await db
    .from("salework_daily_reports")
    .upsert(
      { person_slug: person, work_date: date, ...values },
      { onConflict: "person_slug,work_date" },
    );
  return error
    ? {
        error:
          "Không lưu được báo cáo. Kiểm tra ngày báo cáo và quyền tài khoản.",
      }
    : { success: true };
}
