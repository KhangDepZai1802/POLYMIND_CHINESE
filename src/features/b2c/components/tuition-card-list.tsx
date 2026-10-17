"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/dates";
import type { TuitionDashboardRow } from "../domain/tuition-dashboard";
import { TuitionPackageDialog, TuitionReceiptsDialog } from "./tuition-dialogs";
const titles = { due: "Tổng phải thu", paid: "Đã thu", balance: "Còn phải thu" };
export type TuitionCardKind = keyof typeof titles;
export function TuitionCardList({ kind, rows, collector, today, onClose }: { kind: TuitionCardKind; rows: TuitionDashboardRow[]; collector: string; today: string; onClose: () => void }) {
  const [query, setQuery] = useState(""), [page, setPage] = useState(0);
  const group = useMemo(() => rows.filter(r => kind === "due" ? r.package_id !== null : kind === "paid" ? r.paid_amount > 0 : r.balance > 0), [rows, kind]);
  const matches = useMemo(() => { const q = query.trim().toLocaleLowerCase("vi"); return group.filter(r => !q || `${r.full_name} ${r.student_code} ${r.class_name}`.toLocaleLowerCase("vi").includes(q)); }, [group, query]);
  const total = group.reduce((n, r) => n + Number(kind === "due" ? r.total_due ?? 0 : kind === "paid" ? r.paid_amount : r.balance), 0);
  const current = Math.min(page, Math.max(0, Math.ceil(matches.length / 20) - 1));
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{titles[kind]}</DialogTitle><DialogDescription>{group.length} ghi danh · {formatCurrency(total)} · Theo bộ lọc hiện tại.{kind === "paid" && " Số tiền đã thu ròng sau hủy/hoàn, không phải danh sách đã thanh toán đủ."}</DialogDescription></DialogHeader><Input aria-label="Tìm trong danh sách học phí" value={query} maxLength={200} placeholder="Tên, mã học viên hoặc lớp…" onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[750px] text-left text-sm"><caption className="sr-only">Danh sách {titles[kind].toLocaleLowerCase("vi")}</caption><thead className="bg-blue-50/60 dark:bg-blue-950/20"><tr>{["Học viên", "Lớp", "Phải thu", "Đã thu", "Còn nợ", "Thao tác"].map(h => <th key={h} scope="col" className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{matches.slice(current * 20, current * 20 + 20).map(r => <tr key={r.enrollment_id} className="border-t"><td className="px-3 py-3"><p className="font-medium">{r.full_name}</p><p className="text-xs text-muted-foreground">{r.student_code}</p></td><td className="px-3 py-3">{r.class_name}</td><td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatCurrency(r.total_due ?? 0)}</td><td className="px-3 py-3 whitespace-nowrap tabular-nums">{formatCurrency(r.paid_amount)}</td><td className={`px-3 py-3 whitespace-nowrap tabular-nums ${r.balance > 0 ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}>{formatCurrency(r.balance)}</td><td className="px-3 py-3"><div className="flex gap-2"><TuitionPackageDialog row={r} /><TuitionReceiptsDialog row={r} today={today} collector={collector} /></div></td></tr>)}</tbody></table>{!matches.length && <p role="status" className="py-10 text-center text-sm text-muted-foreground">{group.length ? "Không có ghi danh khớp tìm kiếm." : "Chưa có ghi danh trong nhóm này."}</p>}</div>
    <div className="flex items-center justify-between gap-3 text-sm"><span>{matches.length} ghi danh · Trang {current + 1}/{Math.max(1, Math.ceil(matches.length / 20))}</span><div className="flex gap-2"><Button variant="outline" disabled={!current} onClick={() => setPage(current - 1)}>Trước</Button><Button variant="outline" disabled={(current + 1) * 20 >= matches.length} onClick={() => setPage(current + 1)}>Sau</Button></div></div>
  </DialogContent></Dialog>;
}
