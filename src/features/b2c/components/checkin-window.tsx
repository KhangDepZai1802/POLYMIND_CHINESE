"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatTime } from "@/lib/dates";

export function CheckinWindow({
  startsAt,
  endsAt,
  checkedIn,
  children,
}: {
  startsAt: string;
  endsAt: string;
  checkedIn: boolean;
  children: ReactNode;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  const opens = new Date(startsAt).getTime() - 15 * 60_000;
  const ends = new Date(endsAt).getTime();
  const sameDay =
    now !== null &&
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
      now,
    ) ===
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(startsAt),
      );
  const allowed =
    sameDay &&
    now !== null &&
    (checkedIn ? now >= ends : now >= opens && now < ends);
  return (
    <div className="space-y-2">
      <div className="text-sm" role="status">
        {checkedIn ? (
          <p className="flex flex-wrap gap-x-1.5 gap-y-1">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              Đã check-in.
            </span>
            <span className="font-semibold text-orange-700 dark:text-orange-300">
              Check-out từ {formatTime(endsAt)} đến hết ngày.
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">
            {now !== null && now >= ends
              ? "Đã hết giờ check-in."
              : `Check-in từ ${formatTime(new Date(opens).toISOString())} đến trước ${formatTime(endsAt)}.`}
          </p>
        )}
      </div>
      <fieldset disabled={!allowed} className="min-w-0 disabled:opacity-60">
        <legend className="sr-only">
          {checkedIn ? "Check-out" : "Check-in"}
        </legend>
        {children}
      </fieldset>
    </div>
  );
}
