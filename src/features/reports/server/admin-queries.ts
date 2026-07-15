import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { AdminReportFilters } from "../schema";

export async function getAdminTuitionReport(filters: AdminReportFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("v_tuition_balance")
    .select(
      "invoice_id, invoice_code, student_id, class_id, issue_date, due_date, total, status, paid_amount, balance, is_overdue",
    )
    .order("issue_date", { ascending: false })
    .order("invoice_code", { ascending: false })
    .limit(1000);

  if (filters.from) query = query.gte("issue_date", filters.from);
  if (filters.to) query = query.lte("issue_date", filters.to);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.class_id) query = query.eq("class_id", filters.class_id);

  const balances = await query;
  if (balances.error) {
    throw new Error(`Không tải được báo cáo học phí: ${balances.error.message}`);
  }

  const rows = balances.data ?? [];
  const studentIds = [
    ...new Set(
      rows.map((row) => row.student_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const classIds = [
    ...new Set(rows.map((row) => row.class_id).filter((id): id is string => Boolean(id))),
  ];

  const [students, classes] = await Promise.all([
    studentIds.length
      ? supabase
          .from("students")
          .select("id, student_code, full_name")
          .in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    classIds.length
      ? supabase.from("classes").select("id, code, name").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (students.error || classes.error) {
    throw new Error(
      `Không tải được thông tin báo cáo: ${students.error?.message ?? classes.error?.message}`,
    );
  }

  const studentById = new Map((students.data ?? []).map((row) => [row.id, row]));
  const classById = new Map((classes.data ?? []).map((row) => [row.id, row]));
  const reportRows = rows.map((row) => ({
    ...row,
    total: Number(row.total ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    balance: Number(row.balance ?? 0),
    student: row.student_id ? (studentById.get(row.student_id) ?? null) : null,
    class: row.class_id ? (classById.get(row.class_id) ?? null) : null,
  }));

  return {
    rows: reportRows,
    summary: reportRows.reduce(
      (summary, row) => ({
        invoices: summary.invoices + 1,
        total: summary.total + row.total,
        paid: summary.paid + row.paid_amount,
        balance: summary.balance + row.balance,
        overdue: summary.overdue + (row.is_overdue ? 1 : 0),
      }),
      { invoices: 0, total: 0, paid: 0, balance: 0, overdue: 0 },
    ),
  };
}

export async function getAdminReportClasses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name")
    .order("code");

  if (error) throw new Error(`Không tải được danh sách lớp: ${error.message}`);
  return data ?? [];
}

export type AdminTuitionReport = Awaited<ReturnType<typeof getAdminTuitionReport>>;
