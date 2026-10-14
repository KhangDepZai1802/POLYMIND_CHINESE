"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, Grid3X3, Plane, UsersRound } from "lucide-react";
import {
  canReadXkld,
  CANDIDATES_PATH,
} from "@/features/xkld/domain/candidates";
import type { UserRole } from "@/types/roles";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const modules = [
  {
    id: "b2b",
    title: "Doanh nghiệp (B2B)",
    description:
      "Các lớp do doanh nghiệp cử học viên, gồm hệ thống lớp VCB hiện tại.",
    href: "/admin",
    icon: Building2,
    tone: "bg-blue-600 text-white",
  },
  {
    id: "b2c",
    title: "Lớp trung tâm (B2C)",
    description: "Các lớp học viên lẻ: Anh, Trung, Việt, Vẽ và lớp kèm 1-1.",
    href: "/admin/b2c",
    icon: UsersRound,
    tone: "bg-emerald-500 text-white",
  },
] as const;

export function ModuleSwitcher({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const activeModule = pathname.startsWith("/workspace/xkld")
    ? "xkld"
    : pathname.startsWith("/admin/b2c")
      ? "b2c"
      : "b2b";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mở danh sách module"
          className="text-muted-foreground hover:text-foreground"
        >
          <Grid3X3 className="size-5" aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[min(44rem,calc(100dvh-2rem))] overflow-y-auto p-0 sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
          <DialogTitle>Chọn module quản lý</DialogTitle>
          <DialogDescription>
            Chọn khu vực quản lý phù hợp với công việc của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            const active = activeModule === module.id;

            return (
              <DialogClose asChild key={module.id}>
                <Link
                  href={module.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring group relative flex min-h-48 flex-col rounded-2xl border p-5 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-2xl shadow-sm",
                      module.tone,
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>

                  <span className="mt-5 text-base font-semibold">
                    {module.title}
                  </span>
                  <span className="text-muted-foreground mt-1 text-sm leading-6">
                    {module.description}
                  </span>

                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium">
                    {active ? (
                      <>
                        <Check className="text-primary size-4" aria-hidden />
                        Đang sử dụng
                      </>
                    ) : (
                      <span className="text-primary group-hover:text-brand-orange">
                        Mở module
                      </span>
                    )}
                  </span>
                </Link>
              </DialogClose>
            );
          })}
          {canReadXkld(role) && (
            <DialogClose asChild>
              <Link
                href={CANDIDATES_PATH}
                aria-current={activeModule === "xkld" ? "page" : undefined}
                className="focus-visible:ring-ring bg-card hover:border-primary/40 group flex min-h-48 flex-col rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm">
                  <Plane className="size-6" aria-hidden />
                </span>
                <span className="mt-5 text-base font-semibold">
                  Xuất khẩu lao động
                </span>
                <span className="text-muted-foreground mt-1 text-sm leading-6">
                  Khu vực quản lý xuất khẩu lao động.
                </span>
                <span className="mt-auto pt-4 text-sm font-medium text-orange-700">
                  {activeModule === "xkld" ? "Đang sử dụng" : "Mở module"}
                </span>
              </Link>
            </DialogClose>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
