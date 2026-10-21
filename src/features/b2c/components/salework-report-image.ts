type ReportImage = {
  name: string;
  date: string;
  entries: [string, string][];
  saved: boolean;
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
  box(24, 24, 1032, 364, 32, "#ffffffdd");
  ctx.shadowColor = "transparent";
  text("BÁO CÁO", 65, 153, 92, true);
  box(54, 220, 616, 124, 25, "#f0f6ff");
  text("Ngày báo cáo", 80, 264, 25, false, "#506893");
  text(data.date.split("-").reverse().join("/"), 80, 309, 34, true);
  box(350, 244, 2, 77, 0, "#d4e3fa");
  text("Nhân viên", 380, 264, 25, false, "#506893");
  text(data.name, 380, 309, 34, true);
  // Vector headset: gradient shells and padded cups, no external image dependency.
  ctx.save();
  ctx.translate(712, 75);
  const blue = ctx.createLinearGradient(0, 0, 270, 260);
  blue.addColorStop(0, "#8bdfff");
  blue.addColorStop(0.4, "#247dff");
  blue.addColorStop(1, "#153cb3");
  ctx.lineWidth = 36;
  ctx.strokeStyle = "#d2e7ff";
  ctx.beginPath();
  ctx.arc(137, 130, 116, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = 23;
  ctx.strokeStyle = blue;
  ctx.beginPath();
  ctx.arc(137, 130, 116, Math.PI, 0);
  ctx.stroke();
  box(7, 126, 68, 121, 30, blue);
  box(25, 144, 37, 85, 18, "#123d99");
  box(205, 126, 68, 121, 30, blue);
  box(214, 140, 43, 92, 20, "#e4efff");
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#285cc3";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(237, 236);
  ctx.quadraticCurveTo(232, 281, 151, 275);
  ctx.stroke();
  box(127, 262, 45, 24, 12, "#113b92");
  box(-28, -18, 75, 54, 17, blue);
  text("•••", -14, 20, 30, true, "#fff");
  ctx.restore();

  data.entries.forEach(([label, value], index) => {
    const x = 24 + (index % 2) * 528;
    const y = 418 + Math.floor(index / 2) * 244;
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
  box(24, 1658, 1032, 226, 28, "#ffffffcc");
  box(42, 1676, 996, 190, 26, "#edf3fc");
  box(66, 1710, 70, 78, 18, "#dfeafa");
  icon(9, 81, 1728, 40, "#506a9c");
  text("Ghi chú", 164, 1742, 32, true);
  text(
    data.saved ? "Đã lưu báo cáo" : "Bản nháp chưa lưu",
    164,
    1796,
    29,
    false,
    "#617aa2",
  );
}
