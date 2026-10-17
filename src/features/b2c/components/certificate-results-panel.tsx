"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { certificateFiltersSchema, type CertificateFilters, type CertificateResult, type CertificateResultsModel } from "../domain/certificate-results";
import { readCertificateResultsAction, archiveCertificateResultAction, exportCertificateMarketingAction } from "../server/certificate-actions";
import { CertificateResultEditor } from "./certificate-result-editor";
import { CertificateHistoryDialog } from "./certificate-history-dialog";

export function CertificateResultsPanel({ today, studentId = null }: { today: string; studentId?: string | null }) {
  const [filters, setFilters] = useState<CertificateFilters>(() => certificateFiltersSchema.parse({ studentId })), [data, setData] = useState<CertificateResultsModel | null>(null), [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [exporting, setExporting] = useState(false);
  const [editor, setEditor] = useState<{ result?: CertificateResult } | null>(null), [archive, setArchive] = useState<{ row: CertificateResult; requestId: string } | null>(null), [savingArchive, setSavingArchive] = useState(false), [archiveError, setArchiveError] = useState("");
  useEffect(() => {
    let active = true;
    readCertificateResultsAction(filters).then((r) => { if (active) { setData(r); setError(""); setBusy(false); } }).catch((e) => { if (active) { setData(null); setError(e instanceof Error ? e.message : "Không tải được kết quả chứng chỉ."); setBusy(false); } });
    return () => { active = false; };
  }, [filters, revision]);
  function refresh() { setBusy(true); setRevision((v) => v + 1); }
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><p className="text-muted-foreground max-w-2xl text-sm">Kết quả gắn với hồ sơ học viên, được giữ khi chuyển lớp. Điểm/xếp loại giữ theo từng chứng chỉ; không cộng hoặc so sánh các thang điểm khác nhau.</p><Button onClick={() => setEditor({})}>Thêm kết quả chứng chỉ</Button></div>
    {data?.student_filter && <p className="rounded-lg border p-3 text-sm">Học viên: <strong>{data.student_filter.code} · {data.student_filter.full_name}</strong> · <Link href="/admin/b2c/certificates" className="text-primary hover:underline">Xem tất cả học viên</Link></p>}
    <form className="flex flex-wrap items-end gap-3 rounded-lg border p-4" onSubmit={(event) => {
      event.preventDefault(); const f = new FormData(event.currentTarget);
      const p = certificateFiltersSchema.safeParse({ ...filters, query: f.get("q"), certificateType: f.get("certificate_type"), from: f.get("from"), to: f.get("to"), marketing: f.get("marketing"), archived: f.get("archive") === "yes", page: 0 });
      if (!p.success) { setError(p.error.issues[0]?.message ?? "Bộ lọc không hợp lệ."); return; }
      setBusy(true); setFilters(p.data); setNotice("");
    }}>
      <label className="grid gap-1 text-sm">Tìm kiếm<Input name="q" maxLength={200} defaultValue={filters.query} placeholder="Mã/tên HV, chứng chỉ, điểm…" /></label>
      <label className="grid gap-1 text-sm">Loại chứng chỉ<select name="certificate_type" defaultValue={filters.certificateType} className="bg-background h-10 rounded-md border px-3"><option value="">Tất cả</option>{data?.types.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Từ ngày thi<Input name="from" type="date" defaultValue={filters.from} /></label><label className="grid gap-1 text-sm">Đến ngày thi<Input name="to" type="date" defaultValue={filters.to} /></label>
      <label className="grid gap-1 text-sm">Tư liệu marketing<select name="marketing" defaultValue={filters.marketing} className="bg-background h-10 rounded-md border px-3"><option value="all">Tất cả</option><option value="yes">Đã chọn marketing</option><option value="no">Chưa chọn marketing</option></select></label>
      <label className="grid gap-1 text-sm">Dữ liệu<select name="archive" defaultValue={filters.archived ? "yes" : "no"} className="bg-background h-10 rounded-md border px-3"><option value="no">Đang sử dụng</option><option value="yes">Đã lưu trữ</option></select></label><Button variant="outline" type="submit">Lọc kết quả</Button>
    </form>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {busy ? <p role="status" className="py-8 text-center">Đang tải kết quả chứng chỉ…</p> : !data ? <Button variant="outline" onClick={refresh}>Thử lại</Button> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Kết quả theo bộ lọc", data.total], ["Học viên có kết quả", data.student_count], ["Được chọn marketing", data.marketing_count], ["Loại chứng chỉ", data.type_count]].map(([label, value]) => <div key={label} className="bg-card rounded-xl border p-4"><p className="text-2xl font-semibold tabular-nums">{Number(value).toLocaleString("vi-VN")}</p><p className="text-muted-foreground text-sm">{label}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-muted-foreground text-xs">Excel marketing chỉ gồm các kết quả đang sử dụng đã chọn, theo bộ lọc loại/ngày/học viên; không chứa SĐT, email hoặc ghi chú nội bộ.</p><Button variant="outline" disabled={exporting || filters.archived || !data.marketing_count} onClick={async () => {
        setExporting(true); setError(""); setNotice("");
        try {
          const response = await exportCertificateMarketingAction(filters);
          if (response.error) { setError(response.error); return; }
          if (!response.rows?.length) { setNotice("Không còn kết quả được chọn marketing phù hợp với bộ lọc."); return; }
          const { buildCertificateMarketingWorkbook } = await import("../certificate-marketing-export");
          const workbook = buildCertificateMarketingWorkbook(response.rows), buffer = await workbook.xlsx.writeBuffer();
          const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
          const a = document.createElement("a"); a.href = url; a.download = `ket-qua-chung-chi-marketing-${today}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
          setNotice(`Đã xuất ${response.rows.length} kết quả được chọn làm tư liệu marketing.`);
        } catch { setError("Không xuất được Excel. Vui lòng thử lại."); } finally { setExporting(false); }
      }}>{exporting ? "Đang xuất…" : "Xuất Excel marketing"}</Button></div>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[55rem] text-left text-sm"><caption className="sr-only">Kết quả thi chứng chỉ</caption><thead className="bg-muted"><tr>{["Học viên", "Chứng chỉ", "Cấp độ / Bài thi", "Điểm / Xếp loại", "Ngày thi", "Marketing", "Thao tác"].map((h) => <th key={h} scope="col" className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{data.rows.map((r) => <tr key={r.id} className="border-t"><td className="p-3"><p className="font-medium">{r.full_name}</p><p className="text-muted-foreground text-xs">{r.student_code}</p></td><td className="p-3 font-medium">{r.certificate_type}</td><td className="p-3">{r.level || "—"}</td><td className="p-3">{r.score}</td><td className="p-3 whitespace-nowrap">{r.exam_date.split("-").reverse().join("/")}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${r.marketing_allowed ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{r.marketing_allowed ? "Đã chọn" : "Chưa chọn"}</span></td><td className="p-3"><div className="flex flex-wrap gap-2">{!r.is_archived && <Button size="sm" variant="outline" onClick={() => setEditor({ result: r })}>Sửa</Button>}<CertificateHistoryDialog id={r.id} /><Button size="sm" variant="outline" onClick={() => { setArchiveError(""); setArchive({ row: r, requestId: crypto.randomUUID() }); }}>{r.is_archived ? "Khôi phục" : "Lưu trữ"}</Button></div></td></tr>)}</tbody></table></div>
      {!data.rows.length && <p className="text-muted-foreground py-8 text-center">Chưa có kết quả chứng chỉ phù hợp.</p>}
      <div className="flex items-center justify-between text-sm"><span>{data.total} kết quả · Trang {filters.page + 1}/{Math.max(1, Math.ceil(data.total / 25))}</span><div className="flex gap-2"><Button variant="outline" disabled={filters.page === 0} onClick={() => { setBusy(true); setFilters((v) => ({ ...v, page: v.page - 1 })); }}>Trước</Button><Button variant="outline" disabled={(filters.page + 1) * 25 >= data.total} onClick={() => { setBusy(true); setFilters((v) => ({ ...v, page: v.page + 1 })); }}>Sau</Button></div></div>
    </>}
    {editor && <CertificateResultEditor result={editor.result} initialStudent={data?.student_filter} today={today} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("Đã lưu kết quả chứng chỉ."); refresh(); }} />}
    <Dialog open={!!archive} onOpenChange={(v) => { if (!v && !savingArchive) setArchive(null); }}><DialogContent><DialogHeader><DialogTitle>{archive?.row.is_archived ? "Khôi phục kết quả" : "Lưu trữ kết quả"}</DialogTitle><DialogDescription>{archive?.row.full_name} · {archive?.row.certificate_type} · {archive?.row.score}. {archive?.row.is_archived ? "Kết quả trở lại danh sách đang sử dụng với lựa chọn marketing đã lưu." : "Kết quả được giữ trong lịch sử và loại khỏi xuất marketing."}</DialogDescription></DialogHeader>{archiveError && <p role="alert" className="text-destructive">{archiveError}</p>}<Button disabled={savingArchive || !archive} onClick={async () => {
      if (!archive) return; setSavingArchive(true); setArchiveError("");
      try { const r = await archiveCertificateResultAction({ request_id: archive.requestId, id: archive.row.id, expected_updated_at: archive.row.updated_at, action: archive.row.is_archived ? "restore" : "archive" }); if (r.error) setArchiveError(r.error); else { setArchive(null); refresh(); } }
      catch { setArchiveError("Không kết nối được. Vui lòng thử lại."); } finally { setSavingArchive(false); }
    }}>{savingArchive ? "Đang lưu…" : "Xác nhận"}</Button></DialogContent></Dialog>
  </div>;
}
