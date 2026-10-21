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
  const text = [
    title,
    ...entries.map(([label, value]) => `${label}: ${value}`),
    snapshot
      ? `Đồng bộ: ${new Date(snapshot.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
      : "Chưa có dữ liệu BikeForce",
    saved ? "Đã lưu" : "Bản nháp chưa lưu",
  ].join("\n");
  async function exportImage() {
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 1120;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.fillStyle = "#f0f6ff";
      ctx.fillRect(0, 0, 1200, 1120);
      ctx.fillStyle = "#fff";
      ctx.fillRect(35, 35, 1130, 1050);
      ctx.fillStyle = "#17345b";
      ctx.font = "bold 32px Arial";
      ctx.fillText(title, 65, 100);
      ctx.font = "25px Arial";
      entries.forEach(([label, value], index) => {
        const y = 165 + index * 72;
        ctx.fillStyle = "#64748b";
        ctx.fillText(label, 65, y);
        ctx.fillStyle = "#17345b";
        ctx.fillText(value, 730, y);
      });
      ctx.font = "20px Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText(saved ? "Đã lưu báo cáo" : "Bản nháp chưa lưu", 65, 970);
      if (snapshot)
        ctx.fillText(
          `BikeForce đồng bộ: ${new Date(snapshot.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
          65,
          1020,
        );
      canvas.toBlob((blob) => {
        if (!blob) {
          setNotice("Không xuất được ảnh.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bao-cao-${person}-${date}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch {
      setNotice("Không xuất được ảnh. Bạn có thể sao chép báo cáo.");
    }
  }
  return (
    <section className="mx-auto max-w-5xl space-y-5 p-4">
      <h1 className="text-2xl font-bold">Báo cáo ngày · SaleWork</h1>
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
              {snapshot
                ? ` · BikeForce đồng bộ ${new Date(snapshot.syncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
                : " · Chưa có snapshot trong ngày này"}
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
                  await navigator.clipboard.writeText(text);
                  setNotice("Đã sao chép báo cáo.");
                } catch {
                  setNotice("Trình duyệt không cho phép sao chép.");
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
