import Link from "next/link";
import Image from "next/image";
import { formatInTimeZone } from "date-fns-tz";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatTime, todayISO } from "@/lib/dates";
import { requireManager, requireTeaching } from "@/lib/auth/session";
import type { TeachingPage } from "@/features/b2c/teaching-schema";
import { TeachingSessionDialog } from "@/features/b2c/components/teaching-dialog";
import { TeachingCheckpoint } from "@/features/b2c/components/teaching-checkpoint";
import { getMyB2CPermissionsAction } from "../server/permission-actions";
import { permissionRpc } from "../server/permission-rpc";
import { TeachingSetup } from "./teaching-setup";
import { CheckinWindow } from "./checkin-window";
export async function B2CTeachingPage({
  params,
  mine,
}: {
  params: Record<string, string | string[] | undefined>;
  mine: boolean;
}) {
  if (mine) await requireTeaching();
  else await requireManager();
  const permissions = mine ? await getMyB2CPermissionsAction() : null;
  const canPay = !permissions || permissions.includes("view_pay");
  const canCheck = !permissions || permissions.includes("check_teaching");
  if (mine && !canPay && !canCheck)
    return (
      <>
        <PageHeader title="Chấm công" />
        <p>
          Bạn chưa được cấp quyền chấm công hoặc xem tiền công. Liên hệ quản lý
          để được phân quyền.
        </p>
      </>
    );
  const month =
    typeof params.month === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month)
      ? params.month
      : todayISO().slice(0, 7);
  const n = typeof params.page === "string" ? Number(params.page) : 0;
  const page = Number.isSafeInteger(n) && n >= 0 && n <= 1000000 ? n : 0;
  const client = await createClient();
  const { data, error } = await client.rpc("get_b2c_teaching_page", {
    p_month: `${month}-01`,
    p_page: page,
    p_mine: mine,
  });
  if (error) throw Error("Không tải được giờ dạy.");
  const result = data as unknown as TeachingPage;
  const meetings =
    mine && canCheck
      ? await permissionRpc<
          {
            id: string;
            class_id?: string;
            source?: "weekly";
            class_name: string;
            starts_at: string;
            ends_at: string;
            teaching_session_id: string | null;
            check_in_at: string | null;
            check_out_at: string | null;
            can_start: boolean;
          }[]
        >("read_b2c_checkin_meetings")
      : [];
  const paths = result.rows.flatMap((s) =>
    [s.check_in_photo, s.check_out_photo].filter((p): p is string =>
      Boolean(p),
    ),
  );
  const signed = paths.length
    ? await client.storage.from("b2c-check-photos").createSignedUrls(paths, 300)
    : null;
  const urls = new Map(
    (signed?.data ?? [])
      .filter((x) => x.signedUrl)
      .map((x) => [x.path, x.signedUrl]),
  );
  let options: {
    classes: { id: string; name: string }[];
    teachers: { id: string; full_name: string }[];
  } | null = null;
  if (!mine) {
    const [classes, teachers] = await Promise.all([
      client
        .from("b2c_classes")
        .select("id,name")
        .in("status", ["active", "planned", "paused"])
        .order("name"),
      client
        .from("b2c_teachers")
        .select("id,full_name")
        .not("source_teacher_id", "is", null)
        .order("full_name"),
    ]);
    if (classes.error || teachers.error)
      throw Error("Không tải được danh sách lớp/giảng viên.");
    options = { classes: classes.data ?? [], teachers: teachers.data ?? [] };
  }
  const base = mine ? "/teacher/b2c-teaching" : "/admin/b2c/teaching";
  const href = (next: number) =>
    `${base}?${new URLSearchParams({ month, page: String(next) })}`;
  return (
    <>
      <PageHeader
        title={mine ? "Chấm công" : "Giờ dạy & Lương"}
        description="Đủ ảnh check-in và check-out sẽ ghi nhận giờ dạy theo lịch. Chưa có đơn giá vẫn chấm công được; tiền công chờ quản lý cập nhật đơn giá cho buổi."
        action={
          options ? (
            <TeachingSessionDialog {...options} today={todayISO()} />
          ) : undefined
        }
      />
      {mine && canCheck && (
        <section className="mb-5 space-y-3" aria-label="Chấm công hôm nay">
          <h2 className="text-lg font-semibold">Buổi dạy hôm nay</h2>
          {meetings.length ? (
            meetings.map((m) => {
              const session = result.rows.find(
                (row) => row.id === m.teaching_session_id,
              );
              const checkInUrl = session?.check_in_photo
                ? urls.get(session.check_in_photo)
                : undefined;
              const checkOutUrl = session?.check_out_photo
                ? urls.get(session.check_out_photo)
                : undefined;
              return (
                <Card key={m.id}>
                  <CardContent className="space-y-3 pt-5">
                    <p className="font-semibold">
                      {m.class_name} · {formatTime(m.starts_at)}–
                      {formatTime(m.ends_at)}
                    </p>
                    {m.check_out_at ? (
                      <div className="space-y-2">
                        <p className="font-medium text-emerald-700 dark:text-emerald-300">
                          Đã hoàn tất chấm công
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            {
                              label: "Check-in",
                              url: checkInUrl,
                              time: session?.check_in_at,
                              latitude: session?.check_in_latitude,
                              longitude: session?.check_in_longitude,
                              accuracy: session?.check_in_accuracy,
                            },
                            {
                              label: "Check-out",
                              url: checkOutUrl,
                              time: session?.check_out_at,
                              latitude: session?.check_out_latitude,
                              longitude: session?.check_out_longitude,
                              accuracy: session?.check_out_accuracy,
                            },
                          ].map(
                            ({
                              label,
                              url,
                              time,
                              latitude,
                              longitude,
                              accuracy,
                            }) =>
                              url ? (
                                <a
                                  key={label}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="space-y-1"
                                >
                                  <p className="text-xs font-medium">{label}</p>
                                  <span className="relative block overflow-hidden rounded-lg border">
                                    <Image
                                      src={url}
                                      alt={`Ảnh ${label}`}
                                      width={240}
                                      height={135}
                                      unoptimized
                                      className="aspect-video w-full object-cover"
                                    />
                                    <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] leading-3.5 font-semibold text-white">
                                      {time && (
                                        <span className="block">
                                          {label.toUpperCase()} ·{" "}
                                          {formatDate(time)} {formatTime(time)}
                                        </span>
                                      )}
                                      {latitude != null &&
                                        longitude != null && (
                                          <span className="block">
                                            GPS {Number(latitude).toFixed(6)},{" "}
                                            {Number(longitude).toFixed(6)}
                                            {accuracy != null
                                              ? ` · ±${Math.round(Number(accuracy))} m`
                                              : ""}
                                          </span>
                                        )}
                                    </span>
                                  </span>
                                </a>
                              ) : null,
                          )}
                        </div>
                      </div>
                    ) : (
                      <CheckinWindow
                        startsAt={m.starts_at}
                        endsAt={m.ends_at}
                        checkedIn={Boolean(m.check_in_at)}
                      >
                        {m.teaching_session_id ? (
                          <TeachingCheckpoint
                            id={m.teaching_session_id}
                            kind={m.check_in_at ? "out" : "in"}
                            previousPhotoUrl={
                              m.check_in_at
                                ? (checkInUrl ?? undefined)
                                : undefined
                            }
                            previousPhotoTime={
                              session?.check_in_at
                                ? `${formatDate(session.check_in_at)} ${formatTime(session.check_in_at)}`
                                : undefined
                            }
                            previousPhotoLocation={
                              session?.check_in_latitude != null &&
                              session.check_in_longitude != null
                                ? `GPS ${Number(session.check_in_latitude).toFixed(6)}, ${Number(session.check_in_longitude).toFixed(6)}${session.check_in_accuracy != null ? ` · ±${Math.round(Number(session.check_in_accuracy))} m` : ""}`
                                : undefined
                            }
                          />
                        ) : (
                          <TeachingSetup
                            meetingId={m.source === "weekly" ? undefined : m.id}
                            classId={
                              m.source === "weekly" ? m.class_id : undefined
                            }
                          />
                        )}
                      </CheckinWindow>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-muted-foreground">
              Hôm nay chưa có lịch dạy được phân công với giờ bắt đầu và kết
              thúc hợp lệ.
            </p>
          )}
        </section>
      )}
      <form method="get" className="mb-4 flex items-center gap-2">
        <Input
          type="month"
          name="month"
          aria-label="Tháng chấm công"
          defaultValue={month}
          className="max-w-48"
        />
        <Button type="submit" variant="outline">
          Xem tháng
        </Button>
      </form>
      {canPay && Number(result.pending_price_count) > 0 && (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Có {result.pending_price_count} buổi đã đủ check-in/out đang chờ cập
          nhật đơn giá. Tổng tiền công bên dưới chưa bao gồm các buổi này.
        </p>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Buổi trong lịch", String(result.total)],
          [
            "Giờ đã xác nhận",
            Number(result.hours).toLocaleString("vi-VN", {
              maximumFractionDigits: 2,
            }),
          ],
          ["Tiền công đã ghi nhận", formatCurrency(Number(result.salary))],
        ]
          .filter(([label]) => canPay || label === "Buổi trong lịch")
          .map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
      </div>
      {mine && canCheck && (
        <p className="text-muted-foreground mb-4 text-sm">
          Chụp ảnh tại buổi dạy. Check-in từ 15 phút trước giờ dạy đến trước giờ
          kết thúc; check-out sau giờ kết thúc, trong cùng ngày. Buổi thiếu một
          trong hai bước chưa được tính giờ và tiền công.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[950px] text-left text-sm">
          <caption className="sr-only">
            {mine ? "Buổi dạy và chấm công" : "Buổi dạy và chấm công"}
          </caption>
          <thead className="bg-muted">
            <tr>
              {[
                "Buổi dạy",
                "Giảng viên",
                "Check-in",
                "Check-out",
                ...(canPay ? ["Đơn giá / giờ", "Giờ / Tiền công"] : []),
                ...(mine && canCheck ? ["Chấm công"] : []),
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length ? (
              result.rows.map((s) => (
                <tr key={s.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.class_name}</p>
                    <p>
                      {formatDate(s.starts_at)} · {formatTime(s.starts_at)}–
                      {formatTime(s.ends_at)}
                    </p>
                  </td>
                  <td className="px-4 py-3">{s.teacher_name}</td>
                  {[s.check_in_at, s.check_out_at].map((time, i) => {
                    const photo =
                      i === 0 ? s.check_in_photo : s.check_out_photo;
                    const latitude =
                      i === 0 ? s.check_in_latitude : s.check_out_latitude;
                    const longitude =
                      i === 0 ? s.check_in_longitude : s.check_out_longitude;
                    const accuracy =
                      i === 0 ? s.check_in_accuracy : s.check_out_accuracy;
                    const url = photo ? urls.get(photo) : null;
                    return (
                      <td key={i} className="px-4 py-3">
                        <p>
                          {time
                            ? `${formatDate(time)} · ${formatTime(time)}`
                            : "Chưa ghi nhận"}
                        </p>
                        {latitude != null && longitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary block text-xs underline"
                          >
                            GPS {Number(latitude).toFixed(6)},{" "}
                            {Number(longitude).toFixed(6)}
                            {accuracy != null
                              ? ` · ±${Math.round(Number(accuracy))} m`
                              : ""}
                          </a>
                        ) : time ? (
                          <p className="text-muted-foreground text-xs">
                            Ảnh cũ chưa có vị trí
                          </p>
                        ) : null}
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            Xem ảnh
                          </a>
                        )}
                      </td>
                    );
                  })}
                  {canPay && (
                    <>
                      <td className="px-4 py-3">
                        {s.hourly_rate == null
                          ? "Chờ cập nhật đơn giá"
                          : formatCurrency(Number(s.hourly_rate))}
                        {!mine && s.hourly_rate == null && (
                          <TeachingSetup sessionId={s.id} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.check_out_at ? (
                          <>
                            <p>
                              {Number(s.teaching_hours).toLocaleString(
                                "vi-VN",
                                {
                                  maximumFractionDigits: 2,
                                },
                              )}{" "}
                              giờ
                            </p>
                            <p className="font-medium">
                              {s.hourly_rate == null
                                ? "Chờ cập nhật đơn giá"
                                : formatCurrency(Number(s.salary))}
                            </p>
                          </>
                        ) : (
                          "Chưa đủ check-in/out"
                        )}
                      </td>
                    </>
                  )}
                  {mine && canCheck && (
                    <td className="px-4 py-3">
                      {s.check_out_at ? (
                        "Đã hoàn tất"
                      ) : formatInTimeZone(
                          s.starts_at,
                          "Asia/Ho_Chi_Minh",
                          "yyyy-MM-dd",
                        ) === todayISO() ? (
                        <CheckinWindow
                          startsAt={s.starts_at}
                          endsAt={s.ends_at}
                          checkedIn={Boolean(s.check_in_at)}
                        >
                          <TeachingCheckpoint
                            id={s.id}
                            kind={s.check_in_at ? "out" : "in"}
                            previousPhotoUrl={
                              s.check_in_at && s.check_in_photo
                                ? (urls.get(s.check_in_photo) ?? undefined)
                                : undefined
                            }
                            previousPhotoTime={
                              s.check_in_at
                                ? `${formatDate(s.check_in_at)} ${formatTime(s.check_in_at)}`
                                : undefined
                            }
                            previousPhotoLocation={
                              s.check_in_latitude != null &&
                              s.check_in_longitude != null
                                ? `GPS ${Number(s.check_in_latitude).toFixed(6)}, ${Number(s.check_in_longitude).toFixed(6)}${s.check_in_accuracy != null ? ` · ±${Math.round(Number(s.check_in_accuracy))} m` : ""}`
                                : undefined
                            }
                          />
                        </CheckinWindow>
                      ) : (
                        "Chưa đến ngày / đã qua ngày"
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={mine ? 7 : 6}
                  className="text-muted-foreground py-10 text-center"
                >
                  Chưa có buổi dạy trong tháng này.
                  {mine
                    ? " Quản lý cần tạo lịch và phân công cho bạn."
                    : " Bấm Thêm buổi dạy; có thể bổ sung đơn giá sau."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        {page > 0 ? <Link href={href(page - 1)}>← Trước</Link> : <span />}
        <span>
          Trang {page + 1}/{Math.max(1, Math.ceil(result.total / 50))}
        </span>
        {(page + 1) * 50 < result.total ? (
          <Link href={href(page + 1)}>Sau →</Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
