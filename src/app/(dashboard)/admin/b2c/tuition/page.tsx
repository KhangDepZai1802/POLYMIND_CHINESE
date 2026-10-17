import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TuitionDashboard } from "@/features/b2c/components/tuition-dashboard";
import { readTuitionDashboard } from "@/features/b2c/server/tuition-dashboard";
import { requireManager } from "@/lib/auth/session";
import { todayISO } from "@/lib/dates";
export const metadata: Metadata = { title: "Học phí – công nợ" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function B2CTuitionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireManager();
  const [rows, params] = await Promise.all([readTuitionDashboard(), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  return <>
    <PageHeader title="Học phí – công nợ" description="Gói học phí theo ghi danh và phiếu thu nhiều đợt." action={actor.role === "super_admin" ? <Button asChild variant="outline" className="border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300"><Link href="/admin/b2c/history"><History className="size-4" aria-hidden />Nhật ký thay đổi</Link></Button> : undefined} />
    <TuitionDashboard key={query} rows={rows} collector={actor.fullName} today={todayISO()} canReadHistory={actor.role === "super_admin"} initialQuery={query} />
  </>;
}
