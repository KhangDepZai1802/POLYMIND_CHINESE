"use client";
import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TeachingPhotoPreview({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return <Dialog><DialogTrigger asChild><button type="button" className="mt-2 block space-y-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Xem ${label}`}>
    {!failed && <Image src={url} alt={label} width={144} height={108} unoptimized className="h-24 w-32 rounded-lg border object-cover" onError={() => setFailed(true)} />}
    <span className="text-primary block text-xs underline">{failed ? "Tải lại trang để xem ảnh" : "Xem ảnh lớn"}</span>
  </button></DialogTrigger><DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>Ảnh chấm công đã ghi nhận của buổi dạy.</DialogDescription></DialogHeader>
    {failed ? <p role="alert">Không tải được ảnh. Tải lại trang để lấy liên kết ảnh mới.</p> : <Image src={url} alt={`${label} phóng lớn`} width={1280} height={960} unoptimized className="max-h-[75dvh] w-full rounded-lg object-contain" onError={() => setFailed(true)} />}
  </DialogContent></Dialog>;
}
