import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { B2CTuitionRow } from "../tuition-schema";
import { assertTuitionArchiveMetadata, type TuitionDashboardRow } from "../domain/tuition-dashboard";

async function readReceiptMonths(client: Awaited<ReturnType<typeof createClient>>, packageIds: string[]) {
  const months = new Map(packageIds.map(id => [id, {} as Record<string, number>]));
  const seen = new Set<string>();
  for (let i = 0; i < packageIds.length; i += 200) {
    const ids = packageIds.slice(i, i + 200);
    let expected: number | null = null;
    let received = 0;
    for (;;) {
      const { data, error, count } = await client.from("b2c_tuition_receipts")
        .select("id,package_id,paid_date,effective_amount", { count: "exact" })
        .in("package_id", ids).order("id", { ascending: true }).range(received, received + 499);
      if (error) throw new Error("Không tải được phiếu thu theo tháng. Vui lòng tải lại.");
      if (!Array.isArray(data) || count === null || !Number.isInteger(count) || count < 0) throw new Error("Dữ liệu phiếu thu chưa đầy đủ. Vui lòng tải lại.");
      if (expected !== null && expected !== count) throw new Error("Phiếu thu vừa thay đổi. Vui lòng tải lại.");
      expected = count;
      for (const receipt of data) {
        const amount = Number(receipt.effective_amount);
        if (seen.has(receipt.id) || !ids.includes(receipt.package_id) || typeof receipt.paid_date !== "string" || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(receipt.paid_date) || receipt.effective_amount === null || !Number.isSafeInteger(amount) || amount < 0) {
          throw new Error("Dữ liệu phiếu thu vừa thay đổi hoặc chưa hợp lệ. Vui lòng tải lại.");
        }
        seen.add(receipt.id);
        const totals = months.get(receipt.package_id)!;
        const month = receipt.paid_date.slice(0, 7);
        totals[month] = (totals[month] ?? 0) + amount;
        if (!Number.isSafeInteger(totals[month])) throw new Error("Tổng thu theo tháng vượt giới hạn tính toán.");
      }
      received += data.length;
      if (received > expected) throw new Error("Phiếu thu vừa thay đổi. Vui lòng tải lại.");
      if (received === expected) break;
      if (!data.length) throw new Error("Chưa tải đủ phiếu thu theo tháng. Vui lòng tải lại.");
    }
  }
  return months;
}

export async function readTuitionDashboard(): Promise<TuitionDashboardRow[]> {
  await requireManager();
  const client = await createClient();
  const rows: B2CTuitionRow[] = [];
  let expected: number | null = null;
  // Reuse the effective-balance RPC, including cancellations/refunds/adjustments.
  for (let page = 0; ; page++) {
    const { data, error } = await client.rpc("get_b2c_tuition_page", { p_query: "", p_page: page });
    if (error) throw new Error("Không tải được học phí. Vui lòng thử lại.");
    const batch = data as unknown as { rows: B2CTuitionRow[]; total: number };
    if (!batch || !Array.isArray(batch.rows) || !Number.isInteger(batch.total)) throw new Error("Dữ liệu học phí chưa hợp lệ.");
    if (expected !== null && expected !== batch.total) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
    expected = batch.total;
    rows.push(...batch.rows);
    if (rows.length >= batch.total) break;
    if (!batch.rows.length) throw new Error("Chưa tải đủ danh sách học phí. Vui lòng thử lại.");
  }
  if (new Set(rows.map(r => r.enrollment_id)).size !== rows.length) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
  assertTuitionArchiveMetadata(rows);
  const details = new Map<string, { class_id: string; enrollment_date: string | null; tuition_end_date: string | null; status: string }>();
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await client.from("b2c_enrollments").select("id,class_id,enrollment_date,tuition_end_date,status").in("id", rows.slice(i, i + 200).map(r => r.enrollment_id));
    if (error) throw new Error("Không tải được kỳ ghi danh và hạn học phí.");
    for (const row of data ?? []) details.set(row.id, row);
  }
  const packageIds = [...new Set(rows.flatMap(row => row.package_id ? [row.package_id] : []))];
  const receiptMonths = await readReceiptMonths(client, packageIds);
  return rows.map(row => {
    const detail = details.get(row.enrollment_id);
    if (!detail) throw new Error("Ghi danh vừa thay đổi. Vui lòng tải lại.");
    const paidByMonth = row.package_id ? receiptMonths.get(row.package_id)! : {};
    const paid = Object.values(paidByMonth).reduce((sum, amount) => sum + amount, 0);
    if (!Number.isSafeInteger(paid) || paid !== Number(row.paid_amount)) throw new Error("Số tiền đã thu vừa thay đổi. Vui lòng tải lại để xem đúng tổng theo tháng.");
    return { ...row, ...detail, paid_by_month: paidByMonth };
  });
}
