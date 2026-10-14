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
  const router = useRouter();
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      let path = pendingPhoto;
      if (!path) {
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
      }
      const r = await recordTeachingCheckpoint({ id, kind, photo: path });
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
