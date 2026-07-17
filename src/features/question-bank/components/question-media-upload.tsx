"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const ALLOWED = new Set(["audio/mpeg", "audio/mp4", "image/jpeg", "image/png", "image/webp"]);

export function QuestionMediaUpload({ versionId }: { versionId: string }) {
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const upload = async () => {
    if (!file || !ALLOWED.has(file.type) || file.size > 50 * 1024 * 1024) {
      setMessage("Chỉ nhận MP3/M4A/JPG/PNG/WebP, tối đa 50 MB.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const rate = await supabase.rpc("consume_rate_limit", { p_scope: "question_media" });
    if (rate.error || !rate.data) { setMessage("Đã vượt giới hạn upload. Vui lòng thử lại sau."); setPending(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage("Phiên đăng nhập đã hết hạn."); setPending(false); return; }
    const safeName = file.name.normalize("NFC").replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${auth.user.id}/${versionId}/${crypto.randomUUID()}-${safeName}`;
    const uploaded = await supabase.storage.from("question-media").upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) { setMessage(uploaded.error.message); setPending(false); return; }
    const inserted = await supabase.from("question_media").insert({
      question_version_id: versionId,
      media_role: file.type.startsWith("audio/") ? "prompt_audio" : "prompt_image",
      object_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: auth.user.id,
    });
    if (inserted.error) {
      await supabase.storage.from("question-media").remove([path]);
      setMessage(inserted.error.message);
    } else {
      setMessage("Đã tải media private.");
      setFile(undefined);
    }
    setPending(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="file" accept="audio/mpeg,audio/mp4,image/jpeg,image/png,image/webp" className="h-9 max-w-64" onChange={(event) => setFile(event.target.files?.[0])} />
      <Button type="button" size="sm" variant="outline" disabled={!file || pending} onClick={upload}>{pending ? "Đang tải…" : "Tải media"}</Button>
      {message && <span className="text-muted-foreground text-xs">{message}</span>}
    </div>
  );
}
