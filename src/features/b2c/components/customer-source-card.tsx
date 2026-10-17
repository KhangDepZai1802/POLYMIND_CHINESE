"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CustomerSourceIcon } from "@/features/b2c/components/customer-source-icons";
import { getB2CSourceStudentsAction } from "@/features/b2c/server/actions";
import { cn } from "@/lib/utils";

type Student = { id: string; code: string; full_name: string; phone: string | null; referrer_name: string | null };

export function CustomerSourceCard({ source, label, count, percent, color, className }: {
  source: string | null; label: string; count: number; percent: number; color: string; className?: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(count);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function load(nextPage: number) {
    setError("");
    startTransition(async () => {
      try {
        const result = await getB2CSourceStudentsAction(source, nextPage);
        if (result.error) { setError(result.error); return; }
        setStudents(result.students); setTotal(result.total); setPage(nextPage);
      } catch { setError("Không tải được danh sách học viên. Vui lòng thử lại."); }
    });
  }
  return <Dialog onOpenChange={(open) => { if (open) { setStudents([]); setPage(0); load(0); } }}>
    <DialogTrigger asChild>
      <button type="button" className={cn("hover:border-primary/50 focus-visible:ring-ring rounded-lg border p-3 text-left transition-colors hover:shadow-sm focus-visible:ring-2", className)} aria-label={`Xem học viên từ ${label}`}>
        <span className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <CustomerSourceIcon source={source} className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </span>
          <span className="text-muted-foreground tabular-nums">{percent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</span>
        </span>
        <span className="my-2 block text-2xl font-bold tabular-nums">{count.toLocaleString("vi-VN")} <span className="text-muted-foreground text-sm font-normal">học viên</span></span>
        <span className="bg-muted block h-1.5 overflow-hidden rounded-full" aria-hidden><span className={`block h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></span>
      </button>
    </DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CustomerSourceIcon source={source} className="h-5 w-5 shrink-0" />
          <span>Nguồn khách: {label}</span>
        </DialogTitle>
        <DialogDescription>{total.toLocaleString("vi-VN")} học viên · Mỗi học viên một dòng.</DialogDescription>
      </DialogHeader>
      {pending ? <p role="status" className="text-muted-foreground py-8 text-center">Đang tải danh sách…</p> : error ? <div role="alert"><p className="text-destructive mb-3 text-sm">{error}</p><Button variant="outline" onClick={() => load(page)}>Thử lại</Button></div> : students.length === 0 ? <p className="text-muted-foreground py-8 text-center">Chưa có học viên thuộc nguồn này.</p> : <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Mã học viên", "Học viên", "SĐT", ...(source === "referral" ? ["Người giới thiệu"] : [])].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-t"><td className="px-3 py-2 font-mono whitespace-nowrap">{student.code}</td><td className="px-3 py-2">{student.full_name}</td><td className="px-3 py-2 whitespace-nowrap">{student.phone ?? "—"}</td>{source === "referral" && <td className="px-3 py-2">{student.referrer_name ?? "—"}</td>}</tr>)}</tbody></table>
      </div>}
      {!error && total > 50 && <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={pending || page === 0} onClick={() => load(page - 1)}>Trước</Button><span className="text-muted-foreground text-sm">Trang {page + 1}/{Math.ceil(total / 50)}</span><Button variant="outline" disabled={pending || (page + 1) * 50 >= total} onClick={() => load(page + 1)}>Sau</Button></div>}
    </DialogContent>
  </Dialog>;
}
