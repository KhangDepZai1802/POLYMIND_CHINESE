import type { Metadata } from "next";

import { AccountsView } from "@/features/accounts/components/accounts-view";
import { SystemTabs, type SystemTab } from "@/features/accounts/components/system-tabs";
import { AuditLogView } from "@/features/audit/components/audit-log-view";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Quản trị & Audit" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSystemPage({ searchParams }: Props) {
  await requireRole("super_admin");
  const sp = await searchParams;

  const tab: SystemTab = sp.tab === "audit" ? "audit" : "accounts";
  const search = typeof sp.q === "string" ? sp.q : undefined;

  return (
    <>
      <PageHeader
        title="Quản trị & Audit"
        description="Quản lý tài khoản của mọi vai trò và tra cứu nhật ký thay đổi. Chỉ quản trị viên được xem."
      />

      <SystemTabs active={tab} />

      {tab === "accounts" ? (
        <AccountsView search={search} />
      ) : (
        <AuditLogView searchParams={sp} />
      )}
    </>
  );
}
