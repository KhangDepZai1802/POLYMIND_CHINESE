import { z } from "zod";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireManager } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
import { CertificateResultsPanel } from "@/features/b2c/components/certificate-results-panel";
export const metadata = { title: "Kết quả chứng chỉ" };
export default async function CertificateResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireManager();
  const params = await searchParams;
  const student = typeof params.student === "string" ? params.student : null;
  if (student && !z.uuid().safeParse(student).success) notFound();
  return <><PageHeader title="Kết quả chứng chỉ" description="Loại chứng chỉ, điểm/xếp loại và ngày thi của học viên; chọn kết quả làm tư liệu marketing." /><CertificateResultsPanel key={student ?? "all"} studentId={student} today={todayISO()} /></>;
}
