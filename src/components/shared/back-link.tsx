import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Link
        href={href}
        aria-label={`Trở lại ${label}`}
        title={`Trở lại ${label}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-colors hover:border-blue-600 hover:bg-blue-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-700 dark:hover:text-white"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </span>
    </div>
  );
}
