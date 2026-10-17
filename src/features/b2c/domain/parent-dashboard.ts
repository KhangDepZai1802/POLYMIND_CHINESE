import type { ParentRow } from "./parents";
export type ParentDashboardRow = Omit<ParentRow, "children"> & { children: (ParentRow["children"][number] & { classes: { id: string; name: string }[] })[] };
export type ParentInfoStatus = "all" | "missing" | "complete" | "phone" | "zalo" | "unlinked";
export const hasContact = (value: string | null | undefined) => !!value?.trim();
export function parentMatchesStatus(parent: ParentDashboardRow, status: ParentInfoStatus) {
  const phone = hasContact(parent.phone), zalo = hasContact(parent.zalo);
  return status === "all" || (status === "phone" && phone) || (status === "zalo" && zalo) || (status === "missing" && (!phone || !zalo)) || (status === "complete" && phone && zalo) || (status === "unlinked" && parent.children.length === 0);
}
export function parentSummary(rows: ParentDashboardRow[]) {
  return { total: rows.length, phone: rows.filter(p => hasContact(p.phone)).length, zalo: rows.filter(p => hasContact(p.zalo)).length, missing: rows.filter(p => parentMatchesStatus(p, "missing")).length };
}
