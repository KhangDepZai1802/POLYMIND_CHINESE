"use client";

import { useEffect, useRef, useState } from "react";
import {
  readSaleWorkReport,
  saveSaleWorkReport,
} from "../server/salework-reports";
import type { SaleWorkSnapshot } from "../salework-schema";

const names = { "co-le": "Cô Lê", "co-thy": "Cô Thy" };
const metrics: [keyof Omit<SaleWorkSnapshot, "syncedAt">, string][] = [
  ["conversations", "Hội thoại"],
  ["sentMessages", "Tin đã gửi"],
  ["receivedMessages", "Tin đã nhận"],
  ["incomingCalls", "Cuộc gọi đến"],
  ["outgoingCalls", "Cuộc gọi đi"],
  ["missedCalls", "Cuộc gọi nhỡ"],
  ["callDurationSeconds", "Thời lượng gọi (giây)"],
];
const number = new Intl.NumberFormat("vi-VN");
const button =
  "rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50";

export function SaleWorkReport({
  initialDate,
  ownPerson,
  manager,
}: {
  initialDate: string;
  ownPerson: "co-le" | "co-thy" | null;
  manager: boolean;
}) {
  const [person, setPerson] = useState<"co-le" | "co-thy">(
    ownPerson ?? "co-le",
  );
  const [date, setDate] = useState(initialDate);
  const [snapshot, setSnapshot] = useState<SaleWorkSnapshot | null>(null);
  const [customers, setCustomers] = useState("");
  const [amount, setAmount] = useState("");
  const [courses, setCourses] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    generation.current++;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setNotice("");
      setSnapshot(null);
      setSaved(false);
      setCustomers("");
      setAmount("");
      setCourses("");
      return readSaleWorkReport(person, date)
        .then((data) => {
          if (!active) return;
          setSnapshot(data.snapshot);
          setSaved(!!data.report);
          setCustomers(data.report ? String(data.report.closed_customers) : "");
          setAmount(data.report ? String(data.report.collected_amount) : "");
          setCourses(data.report ? String(data.report.closed_courses) : "");
        })
        .catch(() => {
          if (active)
            setNotice(
              "Không tải được báo cáo. Cần chạy file SQL báo cáo trước khi sử dụng.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [person, date]);
  const canEdit = ownPerson === person && !manager;
  const entries: [string, string][] = [
    ...metrics.map(
      ([key, label]) =>
        [label, snapshot ? number.format(snapshot[key]) : "Chưa đồng bộ"] as [
          string,
          string,
        ],
    ),
    [
      "Khách đã chốt",
      customers === "" ? "Chưa nhập" : number.format(Number(customers)),
    ],
    [
      "Tiền thực thu",
      amount === "" ? "Chưa nhập" : `${number.format(Number(amount))} đ`,
    ],
    [
      "Khóa đã chốt",
      courses === "" ? "Chưa nhập" : number.format(Number(courses)),
    ],
  ];
  const title = `BÁO CÁO NGÀY ${date.split("-").reverse().join("/")} · ${names[person]}`;
  async function createImage(): Promise<Blob> {
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error();
    ctx.fillStyle = "#f0f6ff";
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#fff";
    ctx.fillRect(40, 40, 1000, 1840);
    ctx.fillStyle = "#17345b";
    ctx.font = "bold 64px Arial";
    ctx.fillText("BÁO CÁO", 85, 155);
    ctx.font = "36px Arial";
    ctx.fillText(names[person], 85, 225);
    ctx.fillText(date.split("-").reverse().join("/"), 85, 285);
    entries.forEach(([label, value], index) => {
      const y = 390 + index * 135;
      ctx.font = "30px Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText(label, 85, y);
      ctx.font = "bold 40px Arial";
      ctx.fillStyle = "#17345b";
      ctx.fillText(value, 85, y + 52, 900);
    });
    ctx.font = "26px Arial";
    ctx.fillStyle = "#64748b";
    ctx.fillText(saved ? "Đã lưu báo cáo" : "Bản nháp chưa lưu", 85, 1790);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG unavailable"))),
        "image/png",
      );
    });
  }
  async function exportImage() {
    try {
      const blob = await createImage();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-${person}-${date}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice("Không xuất được ảnh. Vui lòng thử lại.");
    }
  }
  return (
    <section className="mx-auto max-w-5xl space-y-5 p-4">
      <h1 className="text-2xl font-bold">Báo cáo</h1>
      <div className="flex flex-wrap gap-4">
        {manager && (
          <label>
            Người báo cáo
            <select
              className="ml-2 rounded border p-2"
              value={person}
              disabled={saving}
              onChange={(e) => setPerson(e.target.value as typeof person)}
            >
              <option value="co-le">Cô Lê</option>
              <option value="co-thy">Cô Thy</option>
            </select>
          </label>
        )}
        <label>
          Ngày
          <input
            aria-label="Ngày báo cáo"
            className="ml-2 rounded border p-2"
            type="date"
            max={initialDate}
            value={date}
            disabled={saving}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
      </div>
      {notice && (
        <p role="status" className="rounded border p-3">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải báo cáo…</p>
      ) : (
        <>
          <article className="space-y-5 rounded-2xl border bg-white p-6 text-slate-800">
            <h2 className="text-xl font-bold">{title}</h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map(([key, label]) => (
                <div key={key}>
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="text-xl font-semibold">
                    {snapshot ? number.format(snapshot[key]) : "Chưa đồng bộ"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Khách đã chốt", customers, setCustomers],
                ["Tiền thực thu (VNĐ)", amount, setAmount],
                ["Khóa đã chốt", courses, setCourses],
              ].map(([label, value, setter]) => (
                <label key={String(label)} className="space-y-2">
                  <span className="block text-sm">{String(label)}</span>
                  <input
                    className="w-full rounded-lg border p-3"
                    type="number"
                    min="0"
                    step="1"
                    max={
                      label === "Tiền thực thu (VNĐ)" ? 999999999999 : 1000000
                    }
                    value={String(value)}
                    disabled={!canEdit || saving}
                    onChange={(e) => {
                      (setter as typeof setAmount)(e.target.value);
                      setSaved(false);
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              {saved ? "Đã lưu báo cáo" : "Chưa lưu báo cáo"}
            </p>
          </article>
          <div className="flex flex-wrap gap-3">
            {canEdit && (
              <button
                className={`${button} bg-blue-600 text-white`}
                disabled={
                  saving ||
                  [customers, amount, courses].some((v) => v.trim() === "")
                }
                onClick={async () => {
                  const version = generation.current;
                  setSaving(true);
                  try {
                    const result = await saveSaleWorkReport({
                      person,
                      date,
                      closed_customers: Number(customers),
                      collected_amount: Number(amount),
                      closed_courses: Number(courses),
                    });
                    if (version === generation.current) {
                      setNotice(result.error ?? "Đã lưu báo cáo.");
                      if (result.success) setSaved(true);
                    }
                  } catch {
                    setNotice("Không lưu được báo cáo.");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Đang lưu…" : "Lưu báo cáo"}
              </button>
            )}
            <button
              className={button}
              onClick={async () => {
                try {
                  if (
                    !navigator.clipboard?.write ||
                    typeof ClipboardItem === "undefined"
                  ) {
                    setNotice(
                      "Trình duyệt chưa hỗ trợ sao chép ảnh. Hãy dùng Xuất ảnh PNG.",
                    );
                    return;
                  }
                  await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": createImage() }),
                  ]);
                  setNotice("Đã sao chép ảnh báo cáo.");
                } catch {
                  setNotice(
                    "Không sao chép được ảnh. Hãy cho phép truy cập bộ nhớ tạm hoặc dùng Xuất ảnh PNG.",
                  );
                }
              }}
            >
              Sao chép báo cáo
            </button>
            <button className={button} onClick={() => void exportImage()}>
              Xuất ảnh PNG
            </button>
          </div>
        </>
      )}
    </section>
  );
}
