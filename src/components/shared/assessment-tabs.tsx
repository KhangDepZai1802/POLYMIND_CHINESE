"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Layers, Send } from "lucide-react";

import { cn } from "@/lib/utils";

type Module = "exercises" | "exams";

const TABS: Record<Module, Array<{ label: string; href: string; icon: typeof Send }>> = {
  exercises: [
    { label: "Giao bài tập", href: "/teacher/exercises", icon: Send },
    { label: "Ngân hàng câu hỏi", href: "/teacher/exercises/question-bank", icon: Database },
    { label: "Bộ bài tập", href: "/teacher/exercises/sets", icon: Layers },
  ],
  exams: [
    { label: "Lên lịch thi", href: "/teacher/exams", icon: Send },
    { label: "Ngân hàng câu hỏi", href: "/teacher/exams/question-bank", icon: Database },
    { label: "Bộ đề", href: "/teacher/exams/sets", icon: Layers },
  ],
};

/**
 * Thanh chuyển giữa ba màn của một module đánh giá (Bài tập hoặc Thi):
 * Giao/Lên lịch · Ngân hàng câu hỏi · Bộ. Dùng chung để không màn nào bị "kẹt"
 * không có đường qua tab khác.
 *
 * ⚠️ CHỈ là điều hướng, KHÔNG phải phân quyền — phân quyền thật nằm ở
 * middleware + server action + RLS.
 */
export function AssessmentTabs({ module }: { module: Module }) {
  const pathname = usePathname();
  const tabs = TABS[module];
  // Tab active = href là tiền tố dài nhất của pathname hiện tại, để trang chi
  // tiết (vd /teacher/exercises/<id>) vẫn sáng tab gốc thay vì trùng nhiều tab.
  const activeHref = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div
      role="tablist"
      aria-label={module === "exercises" ? "Khu vực bài tập" : "Khu vực kiểm tra / thi"}
      className="bg-muted mb-6 inline-flex flex-wrap gap-1 rounded-lg p-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
