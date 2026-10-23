"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirmation } from "@/components/shared/confirmation-provider";
import { archiveB2CAdmissionAction } from "@/features/b2c/server/actions";

export function DeleteAdmissionButton({ id, fullName }: { id: string; fullName: string }) {
  const confirm = useConfirmation();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  async function remove() {
    setConfirming(true);
    const accepted = await confirm({
      title: "Xóa khách tuyển sinh?",
      description: `Xóa “${fullName}” khỏi danh sách tuyển sinh? Hồ sơ và lịch sử chăm sóc vẫn được lưu lại.`,
      confirmLabel: "Xóa khách",
      variant: "destructive",
    });
    setConfirming(false);
    if (!accepted) return;
    startTransition(async () => {
      try {
        const result = await archiveB2CAdmissionAction(id);
        if (result.error) toast.error(result.error);
        else if (result.success) toast.success(result.success);
      } catch { toast.error("Không xóa được khách. Vui lòng thử lại."); }
    });
  }
  return <Button type="button" variant="ghost" size="icon" className="text-destructive size-8 shrink-0" aria-label={`Xóa khách ${fullName}`} title="Xóa khách" disabled={pending || confirming} onClick={remove}><X className="size-4" aria-hidden /></Button>;
}
