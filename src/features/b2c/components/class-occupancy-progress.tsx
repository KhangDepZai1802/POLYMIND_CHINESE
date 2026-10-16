export function ClassOccupancyProgress({
  count,
  capacity,
}: {
  count: number;
  capacity: number;
}) {
  if (
    !Number.isFinite(capacity) ||
    capacity <= 0 ||
    !Number.isFinite(count) ||
    count < 0
  )
    return (
      <span className="text-muted-foreground mt-1 block text-xs font-normal">
        Chưa đủ dữ liệu tính lấp đầy
      </span>
    );
  const percentage = (count / capacity) * 100;
  const width = Math.min(100, percentage);
  const percentLabel = `${percentage.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  const availability =
    count > capacity
      ? `Vượt ${count - capacity} chỗ`
      : count === capacity
        ? "Đã đủ sĩ số"
        : `Còn ${capacity - count} chỗ`;
  const color =
    count > capacity
      ? "bg-rose-500"
      : percentage >= 80
        ? "bg-emerald-500"
        : "bg-blue-500";
  return (
    <span className="mt-2 block max-w-52 min-w-36 text-left">
      <span
        role="progressbar"
        aria-label="Tỷ lệ lấp đầy lớp"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${percentLabel} · ${availability}`}
        className="block h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <span
          className={`block h-full rounded-full ${color}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-1 text-xs font-normal">
        <span className="text-foreground font-semibold">{percentLabel}</span>
        <span>· {availability}</span>
      </span>
    </span>
  );
}
