"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  teachingPhotoTicket,
  recordTeachingCheckpoint,
} from "@/features/b2c/server/teaching-actions";

type CheckpointLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
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
    `GPS ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} · ±${Math.round(location.accuracy)} m`,
  ];
  context.font = `600 ${fontSize}px sans-serif`;
  const padding = Math.round(fontSize * 0.7);
  const lineHeight = Math.round(fontSize * 1.35);
  const boxHeight = lineHeight * lines.length + padding * 2;
  context.fillStyle = "rgba(0,0,0,0.68)";
  context.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
  context.fillStyle = "white";
  lines.forEach((line, index) =>
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
}: {
  id: string;
  kind: "in" | "out";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] =
    useState<CheckpointLocation | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();
  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
  }
  useEffect(
    () => () => streamRef.current?.getTracks().forEach((track) => track.stop()),
    [],
  );
  async function openCamera() {
    setError("");
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError(
        "Không mở được camera. Hãy cấp quyền camera cho trình duyệt hoặc chọn ảnh có sẵn.",
      );
    }
  }
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video
      .play()
      .catch(() =>
        setError(
          "Camera không thể phát hình. Hãy dùng nút Chụp bằng camera máy.",
        ),
      );
  }, [cameraOpen]);
  async function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight)
      return setError("Camera chưa sẵn sàng. Vui lòng thử lại.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return setError("Không chụp được ảnh trên thiết bị này.");
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return setError("Không tạo được ảnh chụp.");
    setFile(
      new File([blob], `check-${kind}-${Date.now()}.jpg`, {
        type: "image/jpeg",
      }),
    );
    setPendingPhoto(null);
    setPendingLocation(null);
    stopCamera();
  }
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
      if (!location)
        throw Error("Thiếu vị trí chấm công. Vui lòng chọn lại ảnh.");
      const r = await recordTeachingCheckpoint({
        id,
        kind,
        photo: path,
        ...location,
      });
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || cameraOpen}
          onClick={() => void openCamera()}
        >
          <Camera className="size-4" aria-hidden />
          Mở camera
        </Button>
        <Label
          htmlFor={`camera-photo-${id}`}
          className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium"
        >
          <Camera className="size-4" aria-hidden />
          Chụp bằng camera máy
        </Label>
        <Input
          id={`camera-photo-${id}`}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPendingPhoto(null);
            setPendingLocation(null);
            setError("");
            stopCamera();
          }}
        />
        <Label
          htmlFor={`photo-${id}`}
          className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium"
        >
          <ImagePlus className="size-4" aria-hidden />
          Chọn ảnh có sẵn
        </Label>
        <Input
          id={`photo-${id}`}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPendingPhoto(null);
            setPendingLocation(null);
            setError("");
            stopCamera();
          }}
        />
      </div>
      {cameraOpen && (
        <div className="space-y-2 rounded-lg border p-2">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
            }}
            onCanPlay={() => setCameraReady(true)}
            className="aspect-video w-full rounded-md bg-black object-cover"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!cameraReady}
              onClick={() => void takePhoto()}
            >
              <Camera className="size-4" aria-hidden />
              {cameraReady ? "Chụp ảnh" : "Đang mở camera…"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={stopCamera}
            >
              Đóng camera
            </Button>
          </div>
        </div>
      )}
      {file && !cameraOpen && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Đã có ảnh: {file.name}
        </p>
      )}
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
