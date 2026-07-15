"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";

import { logoutAction } from "@/features/auth/server/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type UserRole } from "@/types/roles";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1] ?? "";
  const first = parts[0] ?? "";
  return ((last[0] ?? "") + (parts.length > 1 ? (first[0] ?? "") : ""))
    .toUpperCase()
    .slice(0, 2);
}

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: UserRole;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto gap-2 px-2 py-1.5"
          aria-label="Menu tài khoản"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium">
              {fullName}
            </span>
            <span className="text-muted-foreground block text-xs">
              {ROLE_LABELS[role]}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate font-medium">{fullName}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {role === "student" ? (
          <DropdownMenuItem asChild>
            <Link href="/student/profile">
              <User className="size-4" aria-hidden />
              Hồ sơ cá nhân
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <User className="size-4" aria-hidden />
            Hồ sơ cá nhân
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <form action={logoutAction}>
          <button
            type="submit"
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
          >
            <LogOut className="size-4" aria-hidden />
            Đăng xuất
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
