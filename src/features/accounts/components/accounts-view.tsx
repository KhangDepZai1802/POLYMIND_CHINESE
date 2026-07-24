import Link from "next/link";
import { GraduationCap, School, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AccountRowActions } from "@/features/accounts/components/account-row-actions";
import { getAccounts, type AccountRow } from "@/features/accounts/server/queries";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
                <Meta.icon
                  className="text-text-secondary size-5"
                  aria-hidden
                />
                {/* Heading thật: trước đây mỗi nhóm vai trò chỉ là `<span>` in
                    đậm, nên trình đọc màn hình không nhảy được giữa 4 nhóm. */}
                <h2 className="font-semibold">{ROLE_LABELS[role]}</h2>
                <span className="bg-muted rounded px-1.5 py-0.5 text-sm">
                  {rows.length} tài khoản
                </span>
                <span className="text-text-secondary ml-auto hidden text-sm sm:inline">
                  {Meta.hint}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="text-text-secondary px-4 py-6 text-sm">
                  Chưa có tài khoản nào ở vai trò này.
                </p>
              ) : (
                <AccountTable
                  rows={rows}
                  selfId={me?.id ?? null}
                  caption={`Tài khoản vai trò ${ROLE_LABELS[role]}: họ tên, tên đăng nhập, mã, liên hệ và trạng thái`}
                />
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
  caption,
}: {
  rows: AccountRow[];
  selfId: string | null;
  caption: string;
}) {
  return (
    /*
     * MỘT bảng cho mọi bề rộng (`DS-044`).
     *
     * Đây chính là file đã làm `admin-accounts.smoke` đỏ ở `P17-T5`: spec dùng
     * `.first()` nên trên Pixel 7 nó trúng bản bảng desktop đang `display:none`.
     * Gộp lại thì cả lớp lỗi đó biến mất, và đồng thời trả lại **Mã** với **số
     * điện thoại** — hai cột bản điện thoại cũ bỏ hẳn.
     */
    <DataTable
      caption={caption}
      minWidthClass="min-w-[54rem]"
    >
      <DataTableHeader>
        <tr>
          <DataTableHead sticky>Họ tên</DataTableHead>
          <DataTableHead>Tên đăng nhập</DataTableHead>
          <DataTableHead>Mã</DataTableHead>
          <DataTableHead>Liên hệ</DataTableHead>
          <DataTableHead>Trạng thái</DataTableHead>
          <DataTableHead className="w-10">
            <span className="sr-only">Thao tác</span>
          </DataTableHead>
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {rows.map((a) => (
          <DataTableRow key={a.id}>
            <DataTableCell sticky className="font-medium">
              {a.full_name}
              {a.id === selfId && (
                <span className="text-text-secondary ml-2 text-sm">(bạn)</span>
              )}
            </DataTableCell>
            <DataTableCell className="font-mono text-sm">
              {a.username ?? "—"}
            </DataTableCell>
            <DataTableCell className="font-mono text-sm">
              {a.code ?? "—"}
            </DataTableCell>
            <DataTableCell>
              <p>{a.email ?? "—"}</p>
              {a.phone && (
                <p className="text-text-secondary text-sm">{a.phone}</p>
              )}
            </DataTableCell>
            <DataTableCell>
              <StatusBadge
                label={a.is_active ? "Đang hoạt động" : "Đã khóa"}
                tone={a.is_active ? "success" : "danger"}
              />
            </DataTableCell>
            <DataTableCell>
              <AccountRowActions account={a} isSelf={a.id === selfId} />
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTableBody>
    </DataTable>
  );
}
