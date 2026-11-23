"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronRight,
  FileText,
  FolderClosed,
  Paperclip,
  X,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { getB2CProgram } from "../domain/programs";
import { MEETING_STATUSES } from "../domain/class-workspace";
import type {
  JournalClass,
  JournalMeeting,
  JournalMeetingPage,
  PreviewReport,
} from "../domain/class-journal-preview";
import { readJournalPreviewMeetings } from "../server/class-journal-preview";

const emptyReport = (): PreviewReport => ({
  content: "",
  homework: "",
  files: [],
  status: "draft",
});
const date = (value: string) =>
  formatInTimeZone(value, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
const time = (value: string) =>
  formatInTimeZone(value, "Asia/Ho_Chi_Minh", "HH:mm");
type Branch = "reports" | "attendance";
type Notice = { classId: string; meeting: JournalMeeting };

export function ClassJournalPreview({
  classes,
  actorName,
  canCompose,
  classBase,
}: {
  classes: JournalClass[];
  actorName: string;
  canCompose: boolean;
  classBase: string;
}) {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [meetings, setMeetings] = useState<JournalMeetingPage | null>(null);
  const [meeting, setMeeting] = useState<JournalMeeting | null>(null);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Record<string, PreviewReport>>({});
  const [draft, setDraft] = useState<PreviewReport>(emptyReport);
  const [reader, setReader] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNotices, setShowNotices] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [retry, setRetry] = useState(0);
  const selectedClass = classes.find((c) => c.id === classId);
  const programTitle = program
    ? (getB2CProgram(program)?.title ?? "Chưa phân nhóm")
    : "";
  const branchTitle =
    branch === "reports" ? "Báo bài các lớp" : "Điểm danh các lớp";
  const programs = Array.from(new Set(classes.map((c) => c.program_slug)));

  useEffect(() => {
    if (!classId) return;
    let current = true;
    readJournalPreviewMeetings(classId, page)
      .then((result) => {
        if (current) setMeetings(result);
      })
      .catch(() => {
        if (current)
          setError(
            "Không tải được buổi học. Kiểm tra quyền xem lịch hoặc thử lại.",
          );
      });
    return () => {
      current = false;
    };
  }, [classId, page, retry]);

  function navigate(level: "root" | "branch" | "program" | "class") {
    setMeeting(null);
    setReader(false);
    setFeedback("");
    if (level !== "class") {
      setClassId(null);
      setMeetings(null);
      setPage(0);
      setError("");
    }
    if (level === "root" || level === "branch") setProgram(null);
    if (level === "root") setBranch(null);
  }
  function openClass(id: string) {
    setClassId(id);
    setMeetings(null);
    setError("");
    setPage(0);
    setMeeting(null);
    setReader(false);
    setFeedback("");
  }
  function openMeeting(value: JournalMeeting) {
    setMeeting(value);
    setDraft(reports[value.id] ?? emptyReport());
    setReader(false);
    setFeedback("");
  }
  function save(sent: boolean) {
    if (!meeting || !canCompose || meeting.status === "cancelled") return;
    if (sent && !draft.content.trim()) {
      setFeedback("Nhập nội dung bài học trước khi gửi thử.");
      return;
    }
    const value: PreviewReport = { ...draft, status: sent ? "sent" : "draft" };
    setReports((previous) => ({ ...previous, [meeting.id]: value }));
    setDraft(value);
    if (sent && classId) {
      setNotices((previous) => [
        { classId, meeting },
        ...previous.filter((n) => n.meeting.id !== meeting.id),
      ]);
      setFeedback(
        "Đã tạo thông báo minh họa. Bấm chuông để mở lại báo bài như người nhận.",
      );
    } else setFeedback("Đã lưu nháp trong phiên xem thử này.");
  }
  function openNotice(notice: Notice) {
    const cls = classes.find((c) => c.id === notice.classId);
    if (!cls) return;
    setBranch("reports");
    setProgram(cls.program_slug);
    openClass(cls.id);
    setMeeting(notice.meeting);
    setReader(true);
    setShowNotices(false);
  }
  function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const published =
    meeting && reports[meeting.id]?.status === "sent"
      ? reports[meeting.id]
      : null;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Điểm danh + Báo bài các lớp"
        description="Môn học → Lớp → Buổi học"
        action={
          <Button
            variant="outline"
            onClick={() => setShowNotices(!showNotices)}
            aria-expanded={showNotices}
          >
            <Bell className="size-4" aria-hidden /> Thông báo thử (
            {notices.length})
          </Button>
        }
      />
      <div className="bg-muted/50 rounded-lg border p-4 text-sm leading-relaxed">
        <Badge variant="secondary">Bản xem thử</Badge>
        <p className="mt-2">
          Dùng lớp và lịch học hiện có của tài khoản {actorName}. Báo bài, file
          và thông báo chỉ được mô phỏng trong phiên này; tải lại trang sẽ xóa
          nội dung thử.
        </p>
      </div>
      {showNotices && (
        <section
          aria-label="Thông báo thử"
          className="bg-card rounded-lg border p-4"
        >
          <h2 className="font-semibold">Thông báo trong hệ thống · Xem thử</h2>
          {!notices.length ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Thông báo sẽ xuất hiện khi bấm “Thử gửi cho lớp”.
            </p>
          ) : (
            <ul className="mt-3 divide-y">
              {notices.map((n) => (
                <li key={n.meeting.id}>
                  <button
                    onClick={() => openNotice(n)}
                    className="hover:bg-muted w-full py-3 text-left text-sm"
                  >
                    <span className="block font-medium">
                      {classes.find((c) => c.id === n.classId)?.name} có báo bài
                      mới
                    </span>
                    <span className="text-muted-foreground">
                      Buổi {date(n.meeting.starts_at)} ·{" "}
                      {time(n.meeting.starts_at)} ·{" "}
                      {reports[n.meeting.id]?.files.length ?? 0} file
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <nav
        aria-label="Đường dẫn thư mục"
        className="flex flex-wrap items-center gap-1 text-sm"
      >
        <Button variant="ghost" onClick={() => navigate("root")}>
          Điểm danh + Báo bài
        </Button>
        {branch && (
          <>
            <ChevronRight
              className="text-muted-foreground size-4"
              aria-hidden
            />
            <Button variant="ghost" onClick={() => navigate("branch")}>
              {branchTitle}
            </Button>
          </>
        )}
        {program && (
          <>
            <ChevronRight
              className="text-muted-foreground size-4"
              aria-hidden
            />
            <Button variant="ghost" onClick={() => navigate("program")}>
              {programTitle}
            </Button>
          </>
        )}
        {selectedClass && (
          <>
            <ChevronRight
              className="text-muted-foreground size-4"
              aria-hidden
            />
            <Button
              variant="ghost"
              className="h-auto max-w-full text-left whitespace-normal"
              onClick={() => navigate("class")}
            >
              {selectedClass.name}
            </Button>
          </>
        )}
        {meeting && (
          <span className="text-muted-foreground">
            / {date(meeting.starts_at)} · {time(meeting.starts_at)}
          </span>
        )}
      </nav>

      {!branch && (
        <FolderList
          items={[
            {
              id: "reports",
              label: "Báo bài các lớp",
              detail: `${classes.length} lớp trong hệ thống`,
            },
            {
              id: "attendance",
              label: "Điểm danh các lớp",
              detail: `${classes.length} lớp trong hệ thống`,
            },
          ]}
          onOpen={(id) => setBranch(id as Branch)}
        />
      )}

      {branch && !program && (
        <FolderList
          items={programs.map((slug) => ({
            id: slug,
            label: `${branch === "reports" ? "Báo bài" : "Điểm danh"} ${getB2CProgram(slug)?.title ?? "Chưa phân nhóm"}`,
            detail: `${classes.filter((c) => c.program_slug === slug).length} lớp`,
          }))}
          onOpen={setProgram}
          empty="Chưa có lớp thuộc phạm vi tài khoản của bạn."
        />
      )}

      {program && !classId && (
        <FolderList
          items={classes
            .filter((c) => c.program_slug === program)
            .map((c) => ({
              id: c.id,
              label: c.name,
              detail: [
                c.code,
                c.weekdays_text,
                c.time_text,
                c.status === "completed"
                  ? "Đã kết thúc"
                  : c.status === "cancelled"
                    ? "Đã hủy"
                    : c.status === "paused"
                      ? "Tạm dừng"
                      : null,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
          onOpen={openClass}
        />
      )}

      {selectedClass && !meeting && (
        <section aria-label="Các buổi học" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedClass.name}</h2>
              <p className="text-muted-foreground text-sm">
                {selectedClass.code} · {programTitle}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`${classBase}/${selectedClass.id}?tab=schedule`}>
                Mở lịch học của lớp
              </Link>
            </Button>
          </div>
          {error ? (
            <div role="alert" className="space-y-3">
              <p>{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setError("");
                  setRetry((n) => n + 1);
                }}
              >
                Thử lại
              </Button>
            </div>
          ) : !meetings ? (
            <p role="status">Đang tải buổi học…</p>
          ) : !meetings.rows.length ? (
            <p className="text-muted-foreground py-8 text-center">
              Lớp này chưa có buổi học. Các buổi được tạo trong lịch học sẽ xuất
              hiện tại đây.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-4 font-medium">Ngày học</th>
                      <th className="p-4 font-medium">Giáo viên</th>
                      <th className="p-4 font-medium">Buổi học</th>
                      <th className="p-4 font-medium">
                        {branch === "reports"
                          ? "Báo bài · Bản thử"
                          : "Điểm danh"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {meetings.rows.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="p-4">
                          <span className="block font-medium whitespace-nowrap">
                            {date(m.starts_at)}
                          </span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {time(m.starts_at)}–{time(m.ends_at)}
                          </span>
                        </td>
                        <td className="p-4">
                          {m.teacher_name || "Chưa phân công"}
                        </td>
                        <td className="p-4">{MEETING_STATUSES[m.status]}</td>
                        <td className="p-4">
                          {branch === "attendance" ? (
                            <Button variant="outline" asChild>
                              <Link
                                href={`${classBase}/${selectedClass.id}?tab=attendance&meeting=${m.id}`}
                              >
                                Mở điểm danh
                              </Link>
                            </Button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {reports[m.id] && (
                                <Badge variant="secondary">
                                  {reports[m.id]?.status === "sent"
                                    ? "Đã gửi thử"
                                    : "Bản nháp thử"}
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                onClick={() => openMeeting(m)}
                              >
                                {canCompose && m.status !== "cancelled"
                                  ? "Mở báo bài"
                                  : "Xem báo bài"}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-muted-foreground">
                  {meetings.total} buổi · Trang {page + 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => {
                      setMeetings(null);
                      setError("");
                      setPage(page - 1);
                    }}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="outline"
                    disabled={(page + 1) * 25 >= meetings.total}
                    onClick={() => {
                      setMeetings(null);
                      setError("");
                      setPage(page + 1);
                    }}
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {meeting && selectedClass && (
        <section
          className="bg-card space-y-5 rounded-xl border p-4 sm:p-6"
          aria-label="Báo bài của buổi học"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Báo bài · {date(meeting.starts_at)}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {selectedClass.name} · {time(meeting.starts_at)}–
                {time(meeting.ends_at)} ·{" "}
                {meeting.teacher_name || "Chưa phân công giáo viên"}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("class")}>
              Trở về danh sách buổi
            </Button>
          </div>
          {canCompose && meeting.status !== "cancelled" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={reader ? "outline" : "default"}
                onClick={() => setReader(false)}
              >
                Soạn báo bài
              </Button>
              <Button
                variant={reader ? "default" : "outline"}
                onClick={() => setReader(true)}
              >
                Xem như người nhận
              </Button>
            </div>
          )}
          {meeting.status === "cancelled" ? (
            <p>Buổi đã hủy. Không soạn hoặc gửi báo bài cho buổi này.</p>
          ) : reader || !canCompose ? (
            <>
              <Badge variant="secondary">
                Góc nhìn giáo viên / học viên · Mô phỏng
              </Badge>
              {!published ? (
                <p className="text-muted-foreground">
                  Chưa có báo bài được gửi thử cho buổi này. Bản nháp chỉ hiển
                  thị ở phần soạn báo bài.
                </p>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="mb-2 font-medium">Nội dung đã học</h3>
                    <p className="break-words whitespace-pre-wrap">
                      {published.content}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium">Dặn dò / BTVN</h3>
                    <p className="break-words whitespace-pre-wrap">
                      {published.homework || "Không có dặn dò thêm."}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-medium">
                      Tài liệu ({published.files.length})
                    </h3>
                    <ul className="space-y-2">
                      {published.files.map((file, index) => (
                        <li key={index}>
                          <Button
                            variant="outline"
                            className="h-auto max-w-full whitespace-normal"
                            onClick={() => download(file)}
                          >
                            <Paperclip
                              className="size-4 shrink-0"
                              aria-hidden
                            />
                            {file.name}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="journal-content">Nội dung đã học</Label>
                <Textarea
                  id="journal-content"
                  rows={5}
                  maxLength={5000}
                  placeholder="Bài học, trang sách, từ vựng, kỹ năng đã luyện…"
                  value={draft.content}
                  onChange={(e) =>
                    setDraft({ ...draft, content: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-homework">Dặn dò / BTVN</Label>
                <Textarea
                  id="journal-homework"
                  rows={3}
                  maxLength={3000}
                  placeholder="Bài tập, nội dung ôn tập hoặc đường dẫn luyện tập…"
                  value={draft.homework}
                  onChange={(e) =>
                    setDraft({ ...draft, homework: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-files">File đính kèm</Label>
                <Input
                  id="journal-files"
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setDraft({ ...draft, files: [...draft.files, ...files] });
                    e.target.value = "";
                  }}
                />
                <p className="text-muted-foreground text-sm">
                  File chỉ được giữ trên trình duyệt trong bản thử.
                </p>
                <ul className="divide-y">
                  {draft.files.map((file, index) => (
                    <li
                      className="flex items-center gap-2 py-2 text-sm"
                      key={index}
                    >
                      <FileText
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {Math.max(1, Math.round(file.size / 1024))} KB
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Gỡ ${file.name}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            files: draft.files.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t pt-4">
                <p className="text-muted-foreground mb-3 text-sm">
                  Người nhận dự kiến: giáo viên được phân công và học viên thuộc
                  lớp {selectedClass.name}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => save(false)}>
                    Lưu nháp thử
                  </Button>
                  <Button onClick={() => save(true)}>Thử gửi cho lớp</Button>
                </div>
              </div>
            </div>
          )}
          {feedback && (
            <p role="status" className="text-sm">
              {feedback}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function FolderList({
  items,
  onOpen,
  empty = "Chưa có lớp trong nhóm này.",
}: {
  items: { id: string; label: string; detail: string }[];
  onOpen: (id: string) => void;
  empty?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/50 border-b px-5 py-3 text-sm font-medium">
        Tên
      </div>
      {!items.length ? (
        <p className="text-muted-foreground p-6 text-sm">{empty}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <button
                aria-label={`${item.label} ${item.detail}`}
                onClick={() => onOpen(item.id)}
                className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-4 p-5 text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                <FolderClosed
                  className="size-6 shrink-0 text-blue-600 dark:text-blue-400"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">
                    {item.label}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm break-words">
                    {item.detail}
                  </span>
                </span>
                <ChevronRight
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
