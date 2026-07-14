"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getMaterialDownloadUrlAction } from "@/features/courses/server/actions";
import { formatFileSize } from "@/lib/domain/files";

type Material = {
  id: string;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
  module: { id: string; title: string; order_index: number } | null;
  lesson: { id: string; title: string; order_index: number } | null;
};

export function MaterialList({ materials }: { materials: Material[] }) {
  return (
    <ul className="divide-y">
      {materials.map((material) => (
        <MaterialRow key={material.id} material={material} />
      ))}
    </ul>
  );
}

function MaterialRow({ material }: { material: Material }) {
  const [downloading, setDownloading] = useState(false);

  /**
   * Bucket `course-materials` là private. Tải về bằng **signed URL ngắn hạn** sinh
   * ở server — không có đường link tĩnh nào để chia sẻ ra ngoài lớp.
   */
  async function download() {
    setDownloading(true);
    const result = await getMaterialDownloadUrlAction(material.id);
    setDownloading(false);

    if ("error" in result) return toast.error(result.error);
    window.location.href = result.url;
  }

  const scope = material.lesson
    ? `Bài: ${material.lesson.title}`
    : material.module
      ? `Chương: ${material.module.title}`
      : "Cả khóa học";

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{material.title}</p>
        <p className="text-muted-foreground text-xs">
          {scope} · {formatFileSize(material.size_bytes)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={download}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        Tải về
      </Button>
    </li>
  );
}
