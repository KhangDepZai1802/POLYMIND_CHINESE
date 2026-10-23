import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { AdmissionsBrowser } from "@/features/b2c/components/admissions-browser";
import { ADMISSION_STAGES } from "@/features/b2c/domain/admissions";
import { getB2CProgram } from "@/features/b2c/domain/programs";
import { getB2CAdmissionsPage } from "@/features/b2c/server/queries";
import { requireAdmissionsAccess } from "@/features/b2c/server/admissions-access";
export const metadata: Metadata = { title: "Tuyển sinh" };
export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmissionsAccess();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const program = typeof params.program === "string" && getB2CProgram(params.program) ? params.program : "";
  const view = params.view === "list" ? "list" : "board";
  const stages = view === "board" ? ADMISSION_STAGES : [null];
  const groups = await Promise.all(stages.map(async (stage) => {
    const raw = params[stage ? `page_${stage}` : "page"];
    const n = typeof raw === "string" ? Number(raw) : 0;
    let page = Number.isSafeInteger(n) && n >= 0 && n <= 1000000 ? n : 0;
    const limit = view === "board" ? 20 : 50;
    let result = await getB2CAdmissionsPage(stage, program, query, page, limit);
    const lastPage = Math.max(0, Math.ceil(result.total / limit) - 1);
    if (page > lastPage) { page = lastPage; result = await getB2CAdmissionsPage(stage, program, query, page, limit); }
    return { ...result, stage, page };
  }));
  return <><PageHeader title="Tuyển sinh" description="Khách hỏi / tiềm năng (chưa học): Lead → Đã tư vấn → Học thử → Đặt cọc → Ghi danh." /><AdmissionsBrowser basePath="/teacher/admissions" key={`${query}:${program}:${view}`} groups={groups} query={query} program={program} view={view} /></>;
}
