"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  readSaleWorkReport,
  saveSaleWorkReport,
} from "../server/salework-reports";
import type { SaleWorkSnapshot } from "../salework-schema";
import { drawSaleWorkReport } from "./salework-report-image";

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
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (preview.current)
      drawSaleWorkReport(preview.current, {
        name: names[person],
        date,
        entries,
        saved,
      });
  });
  async function createImage(): Promise<Blob> {
    await document.fonts.ready;
    const canvas = document.createElement("canvas");
    drawSaleWorkReport(canvas, { name: names[person], date, entries, saved });
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
          <article className="space-y-5 rounded-2xl border bg-white p-4 text-slate-800">
            <canvas
              ref={preview}
              role="img"
              aria-label={`Báo cáo ${names[person]} ngày ${date.split("-").reverse().join("/")}`}
              className="mx-auto block h-auto w-full max-w-[640px] rounded-2xl"
            />
            <dl className="sr-only">
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
                setNotice("");
                try {
                  if (
                    !navigator.clipboard?.write ||
                    typeof ClipboardItem === "undefined"
                  ) {
                    toast.error(
                      "Trình duyệt chưa hỗ trợ sao chép ảnh. Hãy dùng Xuất ảnh PNG.",
                    );
                    return;
                  }
                  await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": createImage() }),
                  ]);
                  toast.success("Đã sao chép ảnh báo cáo.", {
                    description: "Bạn có thể dán ảnh vào tin nhắn.",
                    duration: 4000,
                  });
                } catch {
                  toast.error(
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
