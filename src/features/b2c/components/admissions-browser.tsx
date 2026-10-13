import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMISSION_STAGE_LABELS, type AdmissionLead } from "@/features/b2c/domain/admissions";
import { B2C_PROGRAMS, getB2CProgram } from "@/features/b2c/domain/programs";
import { B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";
import { LeadDialog } from "@/features/b2c/components/admissions-pipeline";
import { CareLogDialog } from "@/features/b2c/components/care-log-dialog";

type Group = { stage: string | null; leads: AdmissionLead[]; total: number; page: number };
export function AdmissionsBrowser({ groups, query, program, view }: {
  groups: Group[]; query: string; program: string; view: "board" | "list";
}) {
  function href(targetView: string, stage?: string | null, page?: number) {
    const params = new URLSearchParams({ view: targetView });
    if (query) params.set("q", query);
    if (program) params.set("program", program);
    for (const group of groups) if (group.page > 0 && group.stage !== stage && targetView === view) params.set(group.stage ? `page_${group.stage}` : "page", String(group.page));
    if (page !== undefined) params.set(stage ? `page_${stage}` : "page", String(page));
    return `/admin/b2c/admissions?${params}`;
  }
  function pagination(group: Group, limit: number) {
    return <div className="mt-3 flex items-center justify-between gap-2 text-xs">
      {group.page > 0 ? <Link className="text-primary hover:underline" href={href(view, group.stage, group.page - 1)}>← Trước</Link> : <span />}
      <span className="text-muted-foreground">Trang {group.page + 1}/{Math.max(1, Math.ceil(group.total / limit))}</span>
      {(group.page + 1) * limit < group.total ? <Link className="text-primary hover:underline" href={href(view, group.stage, group.page + 1)}>Sau →</Link> : <span />}
    </div>;
  }
  const colors = ["border-slate-400", "border-blue-500", "border-violet-500", "border-amber-500", "border-emerald-500", "border-rose-500"];
  return <>
    <form action="/admin/b2c/admissions" method="get" className="mb-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="view" value={view} />
      <Input name="q" maxLength={200} defaultValue={query} className="max-w-sm" aria-label="Tìm khách tuyển sinh" placeholder="Tìm tên, SĐT, người phụ trách…" />
      <select name="program" defaultValue={program} aria-label="Lọc chương trình" className="border-input bg-background h-10 rounded-md border px-3 text-sm"><option value="">Tất cả chương trình</option>{B2C_PROGRAMS.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}</select>
      <Button type="submit" variant="outline">Tìm kiếm</Button>
      <span className="text-muted-foreground text-sm">{groups.reduce((n, group) => n + group.total, 0).toLocaleString("vi-VN")} khách</span>
      <div className="flex gap-2"><Link href={href("board")} className={view === "board" ? "text-primary font-semibold" : "text-muted-foreground"}>Pipeline</Link><Link href={href("list")} className={view === "list" ? "text-primary font-semibold" : "text-muted-foreground"}>Danh sách</Link></div>
      <div className="ml-auto"><LeadDialog /></div>
    </form>
    {view === "board" ? <div className="overflow-x-auto pb-3"><div className="grid min-w-[1500px] grid-cols-6 gap-3">{groups.map((group, index) => <section key={group.stage} className={`bg-muted/40 rounded-xl border-t-4 p-3 ${colors[index]}`} aria-label={ADMISSION_STAGE_LABELS[group.stage ?? ""]}>
      <h2 className="mb-3 flex justify-between font-semibold"><span>{ADMISSION_STAGE_LABELS[group.stage ?? ""]}</span><span className="bg-background rounded-full px-2 text-sm">{group.total.toLocaleString("vi-VN")}</span></h2>
      <div className="space-y-3">{group.leads.length ? group.leads.map((lead) => <article key={lead.id} className="bg-card rounded-lg border p-3 shadow-sm">
        <div className="flex justify-between gap-2"><h3 className="font-medium break-words">{lead.full_name}</h3><LeadDialog lead={lead} /></div>
        <p className="mt-1 text-sm">{lead.phone}</p>
        <p className="text-muted-foreground mt-2 text-xs">{getB2CProgram(lead.program_slug)?.title} · {lead.salesperson}</p>
        <p className="text-muted-foreground mt-1 text-xs">{lead.customer_source ? B2C_CUSTOMER_SOURCE_LABELS[lead.customer_source] : "Chưa xác định nguồn"}{lead.referrer_name ? ` · ${lead.referrer_name}` : ""}</p>
        {lead.notes && <p className="mt-2 line-clamp-3 text-sm whitespace-pre-wrap break-words">{lead.notes}</p>}
        {lead.failure_reason && <p className="mt-2 line-clamp-3 text-sm text-rose-700">Lý do: {lead.failure_reason}</p>}
        {lead.nextFollowupDate && <p className="text-primary mt-2 text-xs">Hẹn tiếp: {lead.nextFollowupDate.split("-").reverse().join("/")}</p>}
        <CareLogDialog leadId={lead.id} fullName={lead.full_name} caretaker={lead.salesperson} />
      </article>) : <p className="text-muted-foreground py-8 text-center text-sm">Chưa có khách</p>}</div>
      {pagination(group, 20)}
    </section>)}</div></div> : <div className="rounded-lg border p-3">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr>{["Khách", "SĐT", "Chương trình", "Giai đoạn", "Phụ trách", "Hẹn tiếp", "Thao tác"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{groups[0]?.leads.length ? groups[0].leads.map((lead) => <tr key={lead.id} className="border-t"><td className="px-3 py-2">{lead.full_name}</td><td className="px-3 py-2">{lead.phone}</td><td className="px-3 py-2">{getB2CProgram(lead.program_slug)?.title}</td><td className="px-3 py-2">{ADMISSION_STAGE_LABELS[lead.stage]}</td><td className="px-3 py-2">{lead.salesperson}</td><td className="px-3 py-2">{lead.nextFollowupDate?.split("-").reverse().join("/") ?? "—"}</td><td className="px-3 py-2"><div className="flex items-center gap-2"><LeadDialog lead={lead} /><CareLogDialog leadId={lead.id} fullName={lead.full_name} caretaker={lead.salesperson} /></div></td></tr>) : <tr><td colSpan={7} className="text-muted-foreground py-8 text-center">Chưa có khách phù hợp.</td></tr>}</tbody></table></div>
      {groups[0] && pagination(groups[0], 50)}
    </div>}
  </>;
}
