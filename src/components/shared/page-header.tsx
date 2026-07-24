export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          // text-secondary (7.81:1) chứ không phải muted (5.44:1): mô tả trang là
          // cấp thông tin thứ hai, không phải chú thích mờ. Nhờ có cấp trung gian
          // này mà các màn hình sau không phải thu nhỏ cỡ chữ để tạo phân cấp.
          <p className="text-text-secondary mt-1 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
