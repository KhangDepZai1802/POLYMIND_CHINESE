import Link from "next/link";
import { GraduationCap, School, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AccountRowActions } from "@/features/accounts/components/account-row-actions";
import { getAccounts, type AccountRow } from "@/features/accounts/server/queries";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/types/roles";

const ROLE_META: Record<UserRole, { icon: LucideIcon; hint: string }> = {
  super_admin: {
    icon: ShieldCheck,
    hint: "Toàn quyền hệ thống.",
  },
  teacher: {
    icon: GraduationCap,
    hint: "Đăng nhập để điểm danh, chấm bài, quản lý lớp phụ trách.",
  },
  student: {
    icon: School,
    hint: "Đăng nhập để xem lịch, làm bài tập và kiểm tra.",
  },
};

/**
 * Tab "Quản trị": mọi tài khoản của mọi role, mỗi role một bảng riêng.
 *
 * Tạo tài khoản vẫn nằm ở trang Giáo viên / Học viên (nơi nhập kèm hồ sơ); ở đây
 * tập trung XEM và SỬA tên đăng nhập / mật khẩu / trạng thái cho toàn hệ thống.
 */
export async function AccountsView({ search }: { search?: string }) {
  const [accounts, me] = await Promise.all([getAccounts(search), getCurrentUser()]);

  const grouped = USER_ROLES.map((role) => ({
    role,
    rows: accounts.filter((a) => a.role === role),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid flex-1 gap-1 text-sm font-medium">
              Tìm theo tên, tên đăng nhập hoặc email
              <Input
                name="q"
                defaultValue={search}
                placeholder="vd. Quách Duy Khang"
              />
            </label>
            <input type="hidden" name="tab" value="accounts" />
            <div className="flex gap-2">
              <Button type="submit">Tìm</Button>
              {search && (
                <Button asChild variant="ghost">
                  <Link href="/admin/system?tab=accounts">Xóa lọc</Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {grouped.map(({ role, rows }) => {
        const Meta = ROLE_META[role];
        return (
          <Card key={role}>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                <Meta.icon className="text-muted-foreground size-5" aria-hidden />
                <span className="font-semibold">{ROLE_LABELS[role]}</span>
                <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                  {rows.length} tài khoản
                </span>
                <span className="text-muted-foreground ml-auto hidden text-xs sm:inline">
                  {Meta.hint}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Chưa có tài khoản nào ở vai trò này.
                </p>
              ) : (
                <AccountTable rows={rows} selfId={me?.id ?? null} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AccountTable({
  rows,
  selfId,
}: {
  rows: AccountRow[];
  selfId: string | null;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Mã</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {a.full_name}
                  {a.id === selfId && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      (bạn)
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.username ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {a.code ?? "—"}
                </TableCell>
                <TableCell className="text-sm">
                  <p>{a.email ?? "—"}</p>
                  {a.phone && (
                    <p className="text-muted-foreground text-xs">{a.phone}</p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={a.is_active ? "Đang hoạt động" : "Đã khóa"}
                    tone={a.is_active ? "success" : "danger"}
                  />
                </TableCell>
                <TableCell>
                  <AccountRowActions account={a} isSelf={a.id === selfId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <ul className="divide-y md:hidden">
        {rows.map((a) => (
          <li key={a.id} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.full_name}</span>
                {a.id === selfId && (
                  <span className="text-muted-foreground text-xs">(bạn)</span>
                )}
                <StatusBadge
                  label={a.is_active ? "Đang hoạt động" : "Đã khóa"}
                  tone={a.is_active ? "success" : "danger"}
                />
              </div>
              <p className="mt-1 font-mono text-xs">
                {a.username ?? "chưa có tên đăng nhập"}
              </p>
              {a.email && (
                <p className="text-muted-foreground truncate text-xs">
                  {a.email}
                </p>
              )}
            </div>
            <AccountRowActions account={a} isSelf={a.id === selfId} />
          </li>
        ))}
      </ul>
    </>
  );
}
