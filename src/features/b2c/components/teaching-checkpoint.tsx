"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  teachingPhotoTicket,
  recordTeachingCheckpoint,
} from "@/features/b2c/server/teaching-actions";

type CheckpointLocation = { latitude: number; longitude: number; accuracy: number };

function currentLocation(): Promise<CheckpointLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Thiết bị không hỗ trợ lấy vị trí."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      () => reject(new Error("Không lấy được vị trí. Hãy bật GPS và cho phép trình duyệt truy cập vị trí.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

async function stampPhoto(file: File, location: CheckpointLocation, kind: "in" | "out") {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không xử lý được ảnh trên thiết bị này.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const fontSize = Math.max(18, Math.round(canvas.width / 38));
  const lines = [
    `${kind === "in" ? "CHECK-IN" : "CHECK-OUT"} · ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "medium" }).format(new Date())}`,
    `GPS ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} · ±${Math.round(location.accuracy)} m`,
  ];
  context.font = `600 ${fontSize}px sans-serif`;
  const padding = Math.round(fontSize * 0.7);
  const lineHeight = Math.round(fontSize * 1.35);
  const boxHeight = lineHeight * lines.length + padding * 2;
  context.fillStyle = "rgba(0,0,0,0.68)";
  context.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
  context.fillStyle = "white";
  lines.forEach((line, index) => context.fillText(line, padding, canvas.height - boxHeight + padding + fontSize + index * lineHeight));
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.86));
  if (!blob) throw new Error("Không đóng dấu được ảnh chấm công.");
  return new File([blob], file.name.replace(/\.[^.]+$/, mime === "image/png" ? ".png" : ".jpg"), { type: mime });
}
export function TeachingCheckpoint({
  id,
  kind,
}: {
  id: string;
  kind: "in" | "out";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<CheckpointLocation | null>(null);
  const router = useRouter();
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      let path = pendingPhoto;
      let location = pendingLocation;
      if (!path) {
        location = await currentLocation();
        const stamped = await stampPhoto(file, location, kind);
        const ticket = await teachingPhotoTicket(
          id,
          kind,
          stamped.type,
          stamped.size,
        );
        if ("error" in ticket) throw Error(ticket.error);
        const result = await createClient()
          .storage.from("b2c-check-photos")
          .uploadToSignedUrl(ticket.path, ticket.token, stamped, {
            contentType: stamped.type,
          });
        if (result.error) throw Error("Không tải được ảnh. Vui lòng thử lại.");
        path = ticket.path;
        setPendingPhoto(path);
        setPendingLocation(location);
      }
      if (!location) throw Error("Thiếu vị trí chấm công. Vui lòng chọn lại ảnh.");
      const r = await recordTeachingCheckpoint({ id, kind, photo: path, ...location });
      if (r.error) throw Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không chấm công được.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-xs space-y-2">
      <Label htmlFor={`photo-${id}`}>
        Ảnh {kind === "in" ? "check-in" : "check-out"}
      </Label>
      <Input
        id={`photo-${id}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={busy}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPendingPhoto(null);
          setPendingLocation(null);
          setError("");
        }}
      />
      <Button size="sm" disabled={busy || !file} onClick={() => void submit()}>
        {busy ? "Đang ghi nhận…" : kind === "in" ? "Check-in" : "Check-out"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
