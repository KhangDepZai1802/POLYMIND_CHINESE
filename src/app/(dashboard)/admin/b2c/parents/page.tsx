import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ParentDashboard } from "@/features/b2c/components/parent-dashboard";
import { readParentDashboard } from "@/features/b2c/server/parent-dashboard";
import { requireManager } from "@/lib/auth/session";
export const metadata: Metadata = { title: "Phụ huynh" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export default async function ParentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireManager();
  const [parents, params] = await Promise.all([readParentDashboard(), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  return <><PageHeader title="Phụ huynh" description="Thông tin phụ huynh và các con đang học tại trung tâm." /><ParentDashboard key={query} parents={parents} initialQuery={query} /></>;
}
