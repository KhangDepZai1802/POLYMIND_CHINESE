"use client";

import Link from "next/link";
import { School } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LOW_ENROLLMENT_THRESHOLD } from "../domain/class-enrollment-warning";

type ClassRow = {
  id: string;
  code: string;
  name: string;
  teacher_name: string | null;
  actualEnrollmentCount: number;
};

export function LowEnrollmentCard({ classes }: { classes: ClassRow[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="flex h-full min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-red-900 shadow-sm transition-colors hover:border-red-400 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 dark:hover:border-red-700 dark:hover:bg-red-950/60">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-400">
            <School className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-2xl leading-tight font-semibold tabular-nums">{classes.length}</span>
            <span className="block text-sm font-medium">Lớp dưới {LOW_ENROLLMENT_THRESHOLD} học viên</span>
            <span className="block text-sm text-red-700 dark:text-red-300">Bấm để xem danh sách</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lớp dưới {LOW_ENROLLMENT_THRESHOLD} học viên · {classes.length} lớp</DialogTitle>
          <DialogDescription>
            Các lớp đang hoạt động, xếp theo sĩ số tăng dần để cân nhắc gộp hoặc đóng lớp. Ngưỡng sĩ số quy ước, chưa tính hòa vốn theo chi phí từng lớp.
          </DialogDescription>
        </DialogHeader>
        {classes.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Không có lớp đang hoạt động dưới ngưỡng.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Danh sách lớp đang hoạt động dưới {LOW_ENROLLMENT_THRESHOLD} học viên</caption>
              <thead className="bg-muted"><tr>{["Lớp", "Giáo viên", "Sĩ số", "Còn thiếu"].map((label) => <th key={label} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">{label}</th>)}</tr></thead>
              <tbody>{classes.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-3"><Link href={`/admin/b2c/classes/${item.id}`} className="text-primary rounded font-medium hover:underline focus-visible:outline-2">{item.code} · {item.name}</Link></td>
                  <td className="px-3 py-3">{item.teacher_name || "Chưa phân công"}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{item.actualEnrollmentCount} HV</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">{LOW_ENROLLMENT_THRESHOLD - item.actualEnrollmentCount} HV</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
