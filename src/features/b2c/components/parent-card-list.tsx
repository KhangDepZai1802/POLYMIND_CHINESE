"use client";
import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parentMatchesStatus, type ParentDashboardRow, type ParentInfoStatus } from "../domain/parent-dashboard";
import { PARENT_RELATIONSHIP_LABELS } from "../domain/parents";
import { ParentDialog } from "./parent-dialog";

export function ParentCardList({ parents, filter, title, onClose, onView }: { parents: ParentDashboardRow[]; filter: ParentInfoStatus; title: string; onClose: () => void; onView: (id: string) => void }) {
  const [query, setQuery] = useState(""), [page, setPage] = useState(0);
  const group = useMemo(() => parents.filter(p => parentMatchesStatus(p, filter)), [parents, filter]);
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return group.filter(p => !q || [p.full_name, p.phone, p.zalo, p.email, ...p.children.flatMap(c => [c.full_name, c.code])].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(q)).sort((a, b) => a.full_name.localeCompare(b.full_name, "vi") || a.id.localeCompare(b.id));
  }, [group, query]);
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{group.length} hồ sơ{filter === "missing" ? " thiếu số điện thoại hoặc Zalo" : " phụ huynh"}. Danh sách theo thẻ thống kê, độc lập với bộ lọc bảng bên ngoài.</DialogDescription></DialogHeader>
    <div className="relative"><Search className="absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden /><Input aria-label="Tìm trong popup phụ huynh" maxLength={200} value={query} placeholder="Tên phụ huynh, SĐT, tên/mã con…" className="pl-9" onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[750px] text-left text-sm"><caption className="sr-only">Danh sách {title.toLocaleLowerCase("vi")}</caption><thead className="bg-blue-50/60 dark:bg-blue-950/20"><tr>{["Phụ huynh", "Số điện thoại", "Zalo", "Các con / Quan hệ", "Thao tác"].map(h => <th key={h} scope="col" className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{rows.slice(current * 20, current * 20 + 20).map(p => <tr key={p.id} className="border-t align-top"><td className="px-3 py-3"><p className="font-medium">{p.full_name}</p><p className="mt-1 text-xs text-muted-foreground">{p.email?.trim() || "Chưa có email"}</p></td><td className="px-3 py-3">{p.phone?.trim() || <span className="text-muted-foreground">Chưa có</span>}</td><td className="px-3 py-3">{p.zalo?.trim() || <span className="text-muted-foreground">Chưa có</span>}</td><td className="px-3 py-3">{p.children.length ? p.children.map(c => <div key={c.code} className="mb-2 last:mb-0"><p>{c.full_name}</p><p className="text-xs text-muted-foreground">{c.code} · {PARENT_RELATIONSHIP_LABELS[c.relationship] ?? "Chưa xác định"}</p></div>) : <span className="text-muted-foreground">Chưa liên kết học viên</span>}</td><td className="px-3 py-3"><div className="flex gap-2"><Button variant="outline" size="sm" aria-label={`Xem chi tiết phụ huynh ${p.full_name}`} onClick={() => onView(p.id)}><Eye className="size-4" aria-hidden />Xem</Button><ParentDialog parent={p} showLabel /></div></td></tr>)}</tbody></table>{!rows.length && <p role="status" className="py-10 text-center text-sm text-muted-foreground">{group.length ? "Không có phụ huynh khớp tìm kiếm." : "Chưa có phụ huynh trong nhóm này."}</p>}</div>
    <div className="flex items-center justify-between gap-3 text-sm"><span>{rows.length} hồ sơ · Trang {current + 1}/{Math.max(1, Math.ceil(rows.length / 20))}</span><div className="flex gap-2"><Button variant="outline" disabled={!current} onClick={() => setPage(current - 1)}>Trước</Button><Button variant="outline" disabled={(current + 1) * 20 >= rows.length} onClick={() => setPage(current + 1)}>Sau</Button></div></div>
  </DialogContent></Dialog>;
}
