"use client";
import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  teachingPhotoTicket,
  recordTeachingCheckpoint,
  reverseGeocodeCheckpoint,
} from "@/features/b2c/server/teaching-actions";

type CheckpointLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string | null;
};

function currentLocation(): Promise<CheckpointLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error("Thiết bị không hỗ trợ lấy vị trí."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      () =>
        reject(
          new Error(
            "Không lấy được vị trí. Hãy bật GPS và cho phép trình duyệt truy cập vị trí.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

async function stampPhoto(
  file: File,
  location: CheckpointLocation,
  kind: "in" | "out",
) {
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
    location.address
      ? `ĐỊA ĐIỂM · ${location.address}`
      : `VỊ TRÍ · ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} · ±${Math.round(location.accuracy)} m`,
  ];
  context.font = `600 ${fontSize}px sans-serif`;
  const padding = Math.round(fontSize * 0.7);
  const lineHeight = Math.round(fontSize * 1.35);
  const boxHeight = lineHeight * lines.length + padding * 2;
  context.fillStyle = "rgba(0,0,0,0.68)";
  context.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
  context.fillStyle = "white";
  const fittedLines = lines.map((line) => {
    let fitted = line;
    while (
      fitted.length > 1 &&
      context.measureText(`${fitted}…`).width > canvas.width - padding * 2
    )
      fitted = fitted.slice(0, -1);
    return fitted === line ? line : `${fitted}…`;
  });
  fittedLines.forEach((line, index) =>
    context.fillText(
      line,
      padding,
      canvas.height - boxHeight + padding + fontSize + index * lineHeight,
    ),
  );
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.86),
  );
  if (!blob) throw new Error("Không đóng dấu được ảnh chấm công.");
  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, mime === "image/png" ? ".png" : ".jpg"),
    { type: mime },
  );
}
export function TeachingCheckpoint({
  id,
  kind,
  previousPhotoUrl,
}: {
  id: string;
  kind: "in" | "out";
  previousPhotoUrl?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] =
    useState<CheckpointLocation | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const router = useRouter();
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  async function preparePhoto(selected: File | null) {
    setFile(null);
    setPreviewUrl(null);
    setPendingPhoto(null);
    setPendingLocation(null);
    setError("");
    if (!selected) return;
    setPreparing(true);
    try {
      const location = await currentLocation();
      location.address = await reverseGeocodeCheckpoint(
        location.latitude,
        location.longitude,
      );
      const stamped = await stampPhoto(selected, location, kind);
      setFile(stamped);
      setPendingLocation(location);
      setPreviewUrl(URL.createObjectURL(stamped));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Không tạo được ảnh xem trước có thời gian và địa điểm.",
      );
    } finally {
      setPreparing(false);
    }
  }
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      let path = pendingPhoto;
      const location = pendingLocation;
      if (!path) {
        if (!location)
          throw Error("Thiếu vị trí chấm công. Vui lòng chụp lại ảnh.");
        const ticket = await teachingPhotoTicket(
          id,
          kind,
          file.type,
          file.size,
        );
        if ("error" in ticket) throw Error(ticket.error);
        const result = await createClient()
          .storage.from("b2c-check-photos")
          .uploadToSignedUrl(ticket.path, ticket.token, file, {
            contentType: file.type,
          });
        if (result.error) throw Error("Không tải được ảnh. Vui lòng thử lại.");
        path = ticket.path;
        setPendingPhoto(path);
        setPendingLocation(location);
      }
      if (!location)
        throw Error("Thiếu vị trí chấm công. Vui lòng chọn lại ảnh.");
      const r = await recordTeachingCheckpoint({
        id,
        kind,
        photo: path,
        ...location,
      });
      if (r.error) throw Error(r.error);
      setFile(null);
      setPreviewUrl(null);
      setPendingPhoto(null);
      setPendingLocation(null);
      toast.success(
        kind === "in" ? "Check-in thành công" : "Check-out thành công",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không chấm công được.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-xs space-y-2">
      <Label htmlFor={`camera-photo-${id}`}>
        Ảnh {kind === "in" ? "check-in" : "check-out"}
      </Label>
      {previousPhotoUrl && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Đã check-in
          </p>
          <a
            href={previousPhotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block overflow-hidden rounded-lg border"
          >
            <Image
              src={previousPhotoUrl}
              alt="Ảnh check-in đã ghi nhận"
              width={320}
              height={180}
              unoptimized
              className="aspect-video w-full object-cover"
            />
          </a>
        </div>
      )}
      {previewUrl && (
        <Image
          src={previewUrl}
          alt={`Ảnh ${kind === "in" ? "check-in" : "check-out"} vừa chụp`}
          width={320}
          height={180}
          unoptimized
          className="aspect-video w-full rounded-lg border object-cover"
        />
      )}
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`camera-photo-${id}`}
          aria-disabled={busy || preparing}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <Camera className="size-4" aria-hidden />
          Chụp ảnh
        </Label>
        <Input
          id={`camera-photo-${id}`}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy || preparing}
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            void preparePhoto(selected);
            e.currentTarget.value = "";
          }}
        />
        <Button
          size="sm"
          disabled={busy || preparing || !file}
          onClick={() => void submit()}
        >
          {busy ? "Đang ghi nhận…" : kind === "in" ? "Check-in" : "Check-out"}
        </Button>
      </div>
      {preparing && (
        <p className="text-primary text-sm font-medium" role="status">
          Đang thêm thời gian và địa điểm lên ảnh…
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
