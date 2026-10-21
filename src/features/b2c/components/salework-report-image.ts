type ReportImage = {
  name: string;
  date: string;
  entries: [string, string][];
  saved: boolean;
  notes?: string;
};

const colors = [
  "#1686ff",
  "#08b59d",
  "#ff991b",
  "#08b59d",
  "#ff5874",
  "#ff5874",
  "#8960ff",
  "#ffb009",
  "#1686ff",
  "#8960ff",
];
const paths = [
  "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5 M8 12h.01 M12 12h.01 M16 12h.01",
  "m22 2-7 20-4-9-9-4 20-7Z M22 2 11 13",
  "M12 3v12 m-5-5 5 5 5-5 M5 14l-3 5v3h20v-3l-3-5 M3 18h5l2 3h4l2-3h5",
  "M4 3h4l2 5-3 2c2 4 3 5 7 7l2-3 5 2v4c-10 4-21-7-17-17 M21 3l-7 7 M14 4v6h6",
  "M4 3h4l2 5-3 2c2 4 3 5 7 7l2-3 5 2v4c-10 4-21-7-17-17 M14 10l7-7 M15 3h6v6",
  "M4 3h4l2 5-3 2c2 4 3 5 7 7l2-3 5 2v4c-10 4-21-7-17-17 M15 3l7 7 M22 3l-7 7",
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6h5",
  "M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M5 22v-3a7 7 0 0 1 14 0v3 M2 10v.1 M22 10v.1 M2 15v6 M22 15v6",
  "M3 7V4l14-3 2 6 M3 7h18v15H3V7 M16 13h5v5h-5v-5",
  "M14 2H4v20h16V8l-6-6 M14 2v6h6 M8 12h7 M8 16h4 m2 3 2 2 5-5",
];

export function drawSaleWorkReport(
  canvas: HTMLCanvasElement,
  data: ReportImage,
) {
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string | CanvasGradient,
  ) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    color = "#082253",
    maxWidth?: number,
  ) => {
    ctx.font = `${bold ? "700" : "400"} ${size}px Arial`;
    ctx.fillStyle = color;
    if (maxWidth) {
      while (ctx.measureText(value).width > maxWidth && size > 18) {
        size--;
        ctx.font = `${bold ? "700" : "400"} ${size}px Arial`;
      }
    }
    ctx.fillText(value, x, y);
  };
  const icon = (
    index: number,
    x: number,
    y: number,
    size: number,
    color: string,
    opacity = 1,
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(paths[index]!));
    ctx.restore();
  };
  const background = ctx.createLinearGradient(0, 0, 1080, 1920);
  background.addColorStop(0, "#e7f0ff");
  background.addColorStop(0.5, "#f4f8ff");
  background.addColorStop(1, "#e5efff");
  box(0, 0, 1080, 1920, 0, background);
  ctx.shadowColor = "#b4cdf544";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  box(24, 24, 1032, 304, 32, "#ffffffdd");
  ctx.shadowColor = "transparent";
  text("BÁO CÁO", 65, 153, 92, true);
  box(54, 182, 972, 116, 25, "#f0f6ff");
  text("Ngày báo cáo", 80, 222, 25, false, "#506893");
  text(data.date.split("-").reverse().join("/"), 80, 270, 34, true);
  box(530, 202, 2, 77, 0, "#d4e3fa");
  text("Nhân viên", 570, 222, 25, false, "#506893");
  text(data.name, 570, 270, 34, true);

  data.entries.forEach(([label, value], index) => {
    const x = 24 + (index % 2) * 528;
    const y = 352 + Math.floor(index / 2) * 234;
    const color = colors[index]!;
    ctx.shadowColor = "#a7c2ef33";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 9;
    box(x, y, 504, 220, 28, "#ffffff");
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, 504, 220, 28);
    ctx.clip();
    const wash = ctx.createLinearGradient(x + 270, y, x + 504, y + 220);
    wash.addColorStop(0, "#ffffff00");
    wash.addColorStop(1, color + "22");
    box(x + 240, y + 80, 300, 160, 80, wash);
    icon(index, x + 397, y + 124, 90, color, 0.13);
    ctx.restore();
    box(x + 24, y + 29, 100, 112, 25, color + "20");
    icon(index, x + 43, y + 53, 62, color);
    text(label, x + 145, y + 72, 29, false, "#284979", 337);
    text(value, x + 145, y + 145, 60, true, "#071f50", 333);
  });
  box(24, 1536, 1032, 360, 28, "#ffffffcc");
  text("Ghi chú", 65, 1588, 32, true);
  const note = data.notes?.trim().replace(/\s+/gu, " ") || "—";
  let noteSize = 28;
  let lines: string[] = [];
  do {
    ctx.font = `400 ${noteSize}px Arial`;
    lines = [];
    let line = "";
    for (const character of note) {
      if (ctx.measureText(line + character).width > 940 && line) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
    if (line) lines.push(line);
    if (lines.length * (noteSize + 8) <= 220 || noteSize <= 12) break;
    noteSize--;
  } while (true);
  lines.forEach((line, index) =>
    text(line, 65, 1632 + index * (noteSize + 8), noteSize, false, "#506893"),
  );
  text(
    data.saved ? "Đã lưu báo cáo" : "Bản nháp chưa lưu",
    65,
    1864,
    22,
    false,
    "#617aa2",
  );
}
