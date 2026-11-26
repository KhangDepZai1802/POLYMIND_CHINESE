import "server-only";
import { z } from "zod";
import type { TuitionDashboardRow } from "../domain/tuition-dashboard";
import { permissionRpc } from "./permission-rpc";

const receiptPageSchema = z.object({
  total: z.number().int().nonnegative().safe(),
  receipts: z.array(z.object({
    id: z.string().min(1),
    paid_date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
    effective_amount: z.number().int().nonnegative().safe(),
  })).max(20),
});

// Teachers read the existing guarded RPC: raw receipt SELECT is manager-only.
async function readPackageMonths(packageId: string, seen: Set<string>) {
  const months: Record<string, number> = {};
  let expected: number | null = null;
  let received = 0;
  for (let page = 0; ; page++) {
    const parsed = receiptPageSchema.safeParse(await permissionRpc<unknown>(
      "read_b2c_permitted_receipts", { p_package_id: packageId, p_page: page },
    ));
    if (!parsed.success) throw new Error("Dữ liệu phiếu thu theo tháng chưa hợp lệ. Vui lòng tải lại.");
    const batch = parsed.data;
    if (expected !== null && expected !== batch.total) throw new Error("Phiếu thu vừa thay đổi. Vui lòng tải lại.");
    expected = batch.total;
    for (const receipt of batch.receipts) {
      if (seen.has(receipt.id)) throw new Error("Phiếu thu vừa thay đổi. Vui lòng tải lại.");
      seen.add(receipt.id);
      const month = receipt.paid_date.slice(0, 7);
      months[month] = (months[month] ?? 0) + receipt.effective_amount;
      if (!Number.isSafeInteger(months[month])) throw new Error("Tổng thu theo tháng vượt giới hạn tính toán.");
    }
    received += batch.receipts.length;
    if (received > expected) throw new Error("Phiếu thu vừa thay đổi. Vui lòng tải lại.");
    if (received === expected) return months;
    if (batch.receipts.length !== 20) throw new Error("Chưa tải đủ phiếu thu theo tháng. Vui lòng tải lại.");
  }
}

export async function addCenterTuitionReceiptMonths(rows: TuitionDashboardRow[]): Promise<TuitionDashboardRow[]> {
  const packageIds = [...new Set(rows.flatMap(row => row.package_id ? [row.package_id] : []))];
  const months = new Map<string, Record<string, number>>();
  const seen = new Set<string>();
  // Bound concurrent requests; each package still reads all of its receipt pages.
  for (let i = 0; i < packageIds.length; i += 6) {
    const batch = await Promise.all(packageIds.slice(i, i + 6).map(async id =>
      [id, await readPackageMonths(id, seen)] as const,
    ));
    for (const [id, totals] of batch) months.set(id, totals);
  }
  return rows.map(row => {
    const paidByMonth = row.package_id ? months.get(row.package_id)! : {};
    const paid = Object.values(paidByMonth).reduce((sum, amount) => sum + amount, 0);
    if (!Number.isSafeInteger(paid) || paid !== Number(row.paid_amount)) throw new Error("Số tiền đã thu vừa thay đổi. Vui lòng tải lại để xem đúng tổng theo tháng.");
    return { ...row, paid_by_month: paidByMonth };
  });
}
