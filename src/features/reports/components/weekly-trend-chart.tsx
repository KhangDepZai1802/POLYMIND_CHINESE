import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent } from "@/lib/dates";

import type { WeeklyTrendPoint } from "../learning";

/**
 * Xu hướng chuyên cần theo tuần (D9, D12) — SVG dựng thẳng trên server.
 *
 * Không kéo thư viện đồ thị: cùng lý do `AttendanceBars` đã ghi — client
 * component + ~100KB chỉ để vẽ một đường, và bản in (AC4.1) cần biểu đồ là
 * markup tĩnh để không vỡ khi Ctrl+P. Giá trị in trực tiếp trên từng điểm
 * (dataset chỉ vài tuần — `direct-labeling`), màu đi theo token `--color-*`.
 */
export function WeeklyTrendChart({ points }: { points: WeeklyTrendPoint[] }) {
  const measured = points.filter(
    (point): point is WeeklyTrendPoint & { rate: number } =>
      point.rate !== null,
  );

  // AC1.5 — một điểm không phải "xu hướng"; ghi chú thay vì vẽ một chấm lơ lửng.
  if (measured.length < 2) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle asChild className="text-base">
            <h2>Xu hướng chuyên cần theo tuần</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Kỳ đang chọn chưa đủ hai tuần có dữ liệu điểm danh để vẽ xu hướng.
            Chọn kỳ dài hơn (ví dụ Tháng này hoặc Toàn khóa) để xem đường biến
            động.
          </p>
        </CardContent>
      </Card>
    );
  }

  const PAD_X = 28;
  const TOP = 26;
  const PLOT_H = 110;
  const LABEL_Y = TOP + PLOT_H + 22;
  const HEIGHT = LABEL_Y + 10;
  const step = 76;
  const width = PAD_X * 2 + step * (points.length - 1);

  const x = (index: number) => PAD_X + index * step;
  const y = (rate: number) => TOP + ((100 - rate) / 100) * PLOT_H;

  const linePath = measured
    .map((point, index) => {
      const pointIndex = points.indexOf(point);
      return `${index === 0 ? "M" : "L"}${x(pointIndex)},${y(point.rate)}`;
    })
    .join(" ");
  const firstX = x(points.indexOf(measured[0] as WeeklyTrendPoint));
  const lastX = x(points.indexOf(measured[measured.length - 1] as WeeklyTrendPoint));
  const areaPath = `${linePath} L${lastX},${TOP + PLOT_H} L${firstX},${TOP + PLOT_H} Z`;

  const lowest = [...measured].sort((a, b) => a.rate - b.rate)[0];
  const summary = `Xu hướng chuyên cần theo tuần: ${measured
    .map((point) => `tuần ${point.label.replace("T", "")} đạt ${formatPercent(point.rate)}`)
    .join(", ")}. Thấp nhất là tuần ${lowest?.label.replace("T", "")}.`;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle asChild className="text-base">
          <h2>Xu hướng chuyên cần theo tuần</h2>
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Tỉ lệ có mặt (kể cả đến muộn) trên tổng lượt phải điểm danh của từng
          tuần trong kỳ.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div role="img" aria-label={summary} className="min-w-fit">
            <svg
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              aria-hidden
            >
              {[0, 50, 100].map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD_X - 12}
                    x2={width - PAD_X + 12}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="var(--color-border)"
                    strokeDasharray={tick === 0 ? undefined : "3 4"}
                  />
                  <text
                    x={4}
                    y={y(tick) + 4}
                    fontSize={10}
                    fill="var(--color-muted-foreground)"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              <path
                d={areaPath}
                fill="var(--color-chart-1)"
                opacity={0.08}
              />
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
              />

              {measured.map((point) => {
                const pointIndex = points.indexOf(point);
                return (
                  <g key={point.key}>
                    <circle
                      cx={x(pointIndex)}
                      cy={y(point.rate)}
                      r={3.5}
                      fill="var(--color-chart-1)"
                    />
                    <text
                      x={x(pointIndex)}
                      y={y(point.rate) - 9}
                      fontSize={11}
                      fontWeight={600}
                      textAnchor="middle"
                      fill="var(--color-foreground)"
                    >
                      {formatPercent(point.rate)}
                    </text>
                  </g>
                );
              })}

              {points.map((point, index) => (
                <text
                  key={point.key}
                  x={x(index)}
                  y={LABEL_Y}
                  fontSize={11}
                  textAnchor="middle"
                  fill="var(--color-muted-foreground)"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Bản thay thế đầy đủ cho trình đọc màn hình — biểu đồ không bao giờ
            là nguồn duy nhất của số liệu. */}
        <table className="sr-only">
          <caption>Tỉ lệ chuyên cần theo tuần</caption>
          <thead>
            <tr>
              <th scope="col">Tuần</th>
              <th scope="col">Số buổi</th>
              <th scope="col">Chuyên cần</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.key}>
                <td>{point.key}</td>
                <td>{point.sessionCount}</td>
                <td>{point.rate === null ? "—" : formatPercent(point.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
