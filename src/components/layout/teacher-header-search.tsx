"use client";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
export function TeacherHeaderSearch() {
  const path = usePathname();
  if (path !== "/teacher" && !path.startsWith("/teacher/"))
    return <div className="hidden md:block" />;
  return (
    <form
      action="/teacher/classes"
      method="get"
      role="search"
      aria-label="Tìm lớp được phân công"
      className="hidden w-full max-w-2xl items-center gap-2 rounded-xl border border-blue-100 bg-slate-50/80 px-3 shadow-sm md:flex dark:border-slate-700 dark:bg-slate-900"
    >
      <Search
        className="size-4 shrink-0 text-slate-500 dark:text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        aria-label="Tìm lớp học"
        placeholder="Tìm lớp học được phân công…"
        maxLength={200}
        className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500"
      />
    </form>
  );
}
