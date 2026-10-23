import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StudentDataDialog } from "@/features/b2c/components/student-data-dialog";
import { TeacherClassManageDialog } from "@/features/b2c/components/teacher-management-dialogs";
import { TeacherAddStudent } from "@/features/b2c/components/teacher-add-student";
import { requireStudentDataAccess, type StudentDataRow } from "@/features/b2c/server/student-data";
import { permissionRpc } from "@/features/b2c/server/permission-rpc";
import { B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";
import { formatDateOnly } from "@/lib/dates";
export const metadata: Metadata = { title: "Học viên – bổ sung hồ sơ" };
export const dynamic = "force-dynamic";
export default async function StudentDataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudentDataAccess();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0,200) : "";
  const n = typeof params.page === "string" ? Number(params.page) : 0;
  let page = Number.isSafeInteger(n) && n >= 0 && n <= 1000000 ? n : 0;
  type Result = { total: number; students: number; rows: StudentDataRow[] };
  let data = await permissionRpc<Result>("read_center_b2c_student_data", { p_query: q, p_page: page });
  const last = Math.max(0,Math.ceil(data.total/50)-1);
  if (page > last) { page=last; data=await permissionRpc<Result>("read_center_b2c_student_data", { p_query:q,p_page:page }); }
  const canCreate = await permissionRpc<boolean>("has_b2c_permission", { p_key:"create_classes" });
  const href = (p: number) => `/teacher/students?${new URLSearchParams({ q, page:String(p) })}`;
  const blank = (value: string | null) => value?.trim() || "Chưa có";
  return <>
    <PageHeader title="Học viên – bổ sung hồ sơ" description="Bổ sung nguồn khách, SĐT, người chốt, ngày nhập học và hạn học phí. Tìm theo học viên, lớp hoặc giáo viên." action={<div className="flex flex-wrap gap-2"><TeacherAddStudent />{canCreate && <TeacherClassManageDialog />}</div>} />
    <form className="mb-4 flex flex-wrap items-center gap-3" method="get"><Input name="q" defaultValue={q} maxLength={200} className="max-w-md" aria-label="Tìm hồ sơ học viên" placeholder="Tên, mã, SĐT, lớp, giáo viên…" /><Button type="submit">Tìm kiếm</Button><span className="text-sm text-muted-foreground">{data.students} học viên · {data.total} hồ sơ/ghi danh</span></form>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1200px] text-left text-sm"><caption className="sr-only">Thông tin học viên cần bổ sung</caption><thead><tr>{["Học viên","Lớp / giáo viên","SĐT","Nguồn khách","Người chốt","Ngày nhập học","Hạn học phí","Thao tác"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={row.enrollment_id ?? `student-${row.student_id}`} className="border-t"><td className="px-3 py-3"><p className="font-medium">{row.full_name}</p><p className="text-xs text-muted-foreground">{row.code}</p></td><td className="px-3 py-3">{row.class_name ?? <span className="font-medium text-amber-700 dark:text-amber-300">Chưa xếp lớp</span>}<p className="text-xs text-muted-foreground">{row.class_name ? blank(row.teacher_name) : "—"}</p></td><td className="px-3 py-3">{blank(row.phone)}{row.phone && !/^[0-9]{10}$/.test(row.phone) && <p className="text-xs text-destructive">Cần kiểm tra SĐT</p>}</td><td className="px-3 py-3">{row.customer_source ? B2C_CUSTOMER_SOURCE_LABELS[row.customer_source] ?? row.customer_source : "Chưa có"}</td><td className="px-3 py-3">{blank(row.salesperson)}</td><td className="px-3 py-3">{row.enrollment_date ? formatDateOnly(row.enrollment_date) : "Chưa có"}</td><td className="px-3 py-3">{row.tuition_end_date ? formatDateOnly(row.tuition_end_date) : "Chưa có"}</td><td className="px-3 py-3"><StudentDataDialog row={row} /></td></tr>)}</tbody></table>{!data.rows.length && <p className="p-8 text-center text-muted-foreground">Chưa có học viên phù hợp.</p>}</div>
    <div className="mt-4 flex justify-between text-sm">{page>0 ? <Link href={href(page-1)}>← Trước</Link> : <span />}<span>Trang {page+1}/{last+1}</span>{page<last ? <Link href={href(page+1)}>Sau →</Link> : <span />}</div>
  </>;
}
