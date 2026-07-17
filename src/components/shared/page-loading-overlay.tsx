import { LoaderCircle } from "lucide-react";

export function PageLoadingOverlay() {
  return (
    <div
      className="bg-background/55 fixed inset-0 z-[100] grid place-items-center p-4 backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Đang tải trang"
    >
      <div className="bg-card/95 border-primary/15 relative w-full max-w-64 overflow-hidden rounded-2xl border px-7 py-6 text-center shadow-2xl shadow-slate-950/15">
        <div className="from-primary/80 via-info to-brand-red absolute inset-x-0 top-0 h-1 bg-gradient-to-r" />

        <div className="bg-primary/8 relative mx-auto grid size-14 place-items-center rounded-full">
          <span className="border-primary/15 absolute inset-1 rounded-full border" />
          <LoaderCircle
            className="text-primary size-9 motion-safe:animate-spin motion-reduce:animate-pulse"
            aria-hidden="true"
          />
        </div>

        <p className="mt-4 text-sm font-semibold">Đang tải dữ liệu</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Vui lòng chờ trong giây lát…
        </p>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          <span className="bg-primary size-1.5 rounded-full motion-safe:animate-pulse" />
          <span className="bg-primary/70 size-1.5 rounded-full motion-safe:animate-pulse motion-safe:[animation-delay:150ms]" />
          <span className="bg-primary/40 size-1.5 rounded-full motion-safe:animate-pulse motion-safe:[animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
