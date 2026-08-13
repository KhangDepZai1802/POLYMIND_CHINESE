"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Camera,
  Info,
  Loader2,
  Lock,
  Save,
  Send,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { compressFlashcardImage } from "@/features/flashcards/client/compress-image";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatTime } from "@/lib/dates";

import {
  getReportCompletion,
  type ReportStudentEntry,
  type SessionReportForm,
} from "../domain/completion";
import {
  COMPREHENSION_LEVELS,
  CONFIRMATION_TEXT,
  EVIDENCE_KINDS,
  FOCUS_LEVELS,
  HOMEWORK_COMPLETIONS,
  INTERACTION_LEVELS,
  ISSUE_CATEGORIES,
  ISSUE_IMPACTS,
  ISSUE_SEVERITIES,
  OVERALL_RATINGS,
  PLAN_COMPLETIONS,
  SECTION_5_CATEGORIES,
  SESSION_REPORT_MODES,
} from "../domain/labels";
import type { AttendanceLine, SessionReportEditorData } from "../server/queries";
import {
  attachReportEvidenceAction,
  removeReportEvidenceAction,
  saveSessionReportAction,
  submitSessionReportAction,
} from "../server/actions";
import {
  CheckboxGrid,
  CheckboxRow,
  Field,
  RadioList,
  RatingScale,
  SegmentedChoice,
  YesNoChoice,
} from "./report-controls";
import { ReportSectionPicker, ReportSectionRail } from "./report-section-nav";
import { StudentCategoryField } from "./report-student-picker";

const EVIDENCE_BUCKET = "session-report-evidence";
const MAX_EVIDENCE = 4;

export type LessonOption = {
  id: string;
  title: string;
  moduleId: string;
  moduleTitle: string;
};

export function SessionReportFormView({
  data,
  lessons,
  userId,
}: {
  data: SessionReportEditorData;
  lessons: LessonOption[];
  userId: string;
}) {
  const router = useRouter();
  const locked = data.report.status === "submitted";

  const [form, setForm] = useState<SessionReportForm>(data.report.form);
  const [students, setStudents] = useState<ReportStudentEntry[]>(data.report.students);
  const [lessonId, setLessonId] = useState<string | null>(data.session.lessonId);
  const [lessonLog, setLessonLog] = useState(data.session.lessonLog);
  // Giữ nguyên ghi chú nội bộ của nhật ký cũ, KHÔNG dựng ô sửa: mẫu
  // `BaoCao.pdf` không có trường này, thêm vào là "thêm" (`D-43` điểm 3).
  // Truyền lại nguyên giá trị để dữ liệu cũ không bị xoá trắng khi lưu.
  const teacherNote = data.session.teacherNote;
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.attendance.lines.map((line) => [line.enrollmentId, line.note])),
  );
  const [evidence, setEvidence] = useState(data.report.evidence);

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(1);

  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  // --- Tiến độ ---------------------------------------------------------------
  //
  // 🔴 ĐÚNG hàm mà nút Gửi dùng để chặn. Mục lục và nút Gửi không được có hai
  // luật riêng (`D-43` điểm 6).
  const completion = useMemo(
    () =>
      getReportCompletion({
        form,
        lesson: { lessonId, lessonLog },
        attendance: {
          needingReason: data.attendance.lines.length,
          withReason: Object.values(reasons).filter((note) => note.trim()).length,
        },
        students,
        evidenceCount: evidence.length,
      }),
    [form, lessonId, lessonLog, reasons, students, evidence.length, data.attendance.lines.length],
  );

  // --- Tự lưu nháp -----------------------------------------------------------
  //
  // Gộp 1,5 giây sau lần gõ cuối. Trạng thái nói bằng một dòng chữ nhỏ cạnh nút
  // gửi, KHÔNG bao giờ là hộp thoại chen ngang: giáo viên bị học viên hỏi giữa
  // chừng, khoá máy, mở lại vẫn còn nguyên.
  const dirty = useRef(false);
  const payload = useRef({ form, students, lessonId, lessonLog, teacherNote, reasons });

  // Đồng bộ SAU render, không gán thẳng trong thân component: ghi vào ref lúc
  // render là thứ `react-hooks/refs` chặn, và nó hỏng thật khi React render lại
  // mà không commit (Strict Mode, transition bị bỏ dở).
  useEffect(() => {
    payload.current = { form, students, lessonId, lessonLog, teacherNote, reasons };
  });

  const save = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    const current = payload.current;

    const result = await saveSessionReportAction({
      session_id: data.session.id,
      form: current.form,
      students: current.students.filter((entry) => entry.enrollment_id),
      log: {
        lesson_id: current.lessonId,
        lesson_log: current.lessonLog,
        teacher_note: current.teacherNote,
      },
    });

    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    dirty.current = false;
    setSavedAt(
      new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    );
  }, [data.session.id, locked]);

  useEffect(() => {
    if (locked || !dirty.current) return;
    const timer = setTimeout(() => void save(), 1500);
    return () => clearTimeout(timer);
  }, [form, students, lessonId, lessonLog, teacherNote, locked, save]);

  function patch(next: Partial<SessionReportForm>) {
    dirty.current = true;
    setForm((prev) => ({ ...prev, ...next }));
  }

  function patchStudents(next: ReportStudentEntry[]) {
    dirty.current = true;
    setStudents(next);
  }

  // --- Mục lục bám theo chỗ đang cuộn ---------------------------------------
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const number = Number(visible.target.getAttribute("data-section"));
        if (number) setActiveSection(number);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );

    for (const element of Object.values(sectionRefs.current)) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  function goToSection(number: number) {
    setActiveSection(number);
    sectionRefs.current[number]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Một callback ref duy nhất cho cả 9 mục: số mục đọc từ chính `data-section`
   * của phần tử. Bản đầu là `registerSection(n)` trả về một closure mới mỗi lần
   * render — đúng thứ `react-hooks/refs` cảnh báo, và cũng khiến React gỡ/gắn
   * lại ref sau mỗi lần render.
   */
  const registerSection = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const number = Number(element.getAttribute("data-section"));
    if (number) sectionRefs.current[number] = element;
  }, []);

  // --- Lý do vắng: ghi thẳng vào ghi chú điểm danh ---------------------------
  //
  // MỘT trường, MỘT nơi ghi. Cho giáo viên gõ lý do vào một cột riêng của báo
  // cáo là tạo ra hai câu trả lời cho cùng một câu hỏi (`BUG_M10_01`).
  async function saveReason(enrollmentId: string, note: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("attendance_records")
      .update({ note: note.trim() || null })
      .eq("session_id", data.session.id)
      .eq("enrollment_id", enrollmentId);

    if (error) toast.error("Không lưu được lý do vắng.");
  }

  // --- Minh chứng ------------------------------------------------------------
  async function uploadEvidence(files: FileList | null) {
    if (!files?.length || locked) return;
    const room = MAX_EVIDENCE - evidence.length;
    if (room <= 0) {
      toast.error(`Tối đa ${MAX_EVIDENCE} ảnh cho mỗi buổi.`);
      return;
    }

    const supabase = createClient();

    // Tuần tự, không song song: giải mã một tấm 4000px ngốn vài chục MB, mở
    // bốn tấm cùng lúc là tab chết trên máy yếu — cùng lý do với bộ nén của
    // flashcard.
    for (const file of Array.from(files).slice(0, room)) {
      const compressed = await compressFlashcardImage(file);
      const path = `${userId}/${data.session.id}/${crypto.randomUUID()}-${compressed.file.name}`;

      const { error } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, compressed.file, { upsert: false });

      if (error) {
        toast.error(`Không tải được ${file.name}: ${error.message}`);
        continue;
      }

      const body = new FormData();
      body.set("session_id", data.session.id);
      body.set("storage_path", path);
      body.set("bytes", String(compressed.bytes));

      const result = await attachReportEvidenceAction(body);
      if (result.error) {
        toast.error(result.error);
        await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
        continue;
      }
      toast.success(
        compressed.keptOriginal
          ? "Đã thêm ảnh minh chứng."
          : `Đã thêm ảnh · nén từ ${formatBytes(compressed.originalBytes)} xuống ${formatBytes(compressed.bytes)}.`,
      );
    }

    router.refresh();
  }

  async function dropEvidence(id: string) {
    const body = new FormData();
    body.set("evidence_id", id);
    body.set("session_id", data.session.id);
    const result = await removeReportEvidenceAction(body);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEvidence((prev) => prev.filter((item) => item.id !== id));
  }

  // --- Gửi -------------------------------------------------------------------
  async function submit() {
    if (!completion.isComplete || !form.confirmed) {
      setMissingOpen(true);
      return;
    }
    setSubmitting(true);
    if (dirty.current) await save();

    const body = new FormData();
    body.set("session_id", data.session.id);
    const result = await submitSessionReportAction(body);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success ?? "Đã gửi báo cáo.");
    router.refresh();
  }

  const lessonsByModule = useMemo(() => {
    const map = new Map<string, { title: string; lessons: LessonOption[] }>();
    for (const lesson of lessons) {
      const entry = map.get(lesson.moduleId) ?? { title: lesson.moduleTitle, lessons: [] };
      entry.lessons.push(lesson);
      map.set(lesson.moduleId, entry);
    }
    return [...map.entries()];
  }, [lessons]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <ReportSectionRail
        sections={completion.sections}
        doneCount={completion.doneCount}
        activeSection={activeSection}
        onSelect={goToSection}
      />

      <div className="grid min-w-0 gap-4">
        {/*
          `top-16` = đúng chiều cao header dashboard (`sticky top-0 h-16`).
          `top-2` thì thanh chọn mục nằm LỌT sau header — cùng một lỗi với cột
          mục lục màn rộng, chỉ khác là ở đây nó bị che hoàn toàn.
        */}
        <ReportSectionPicker
          sections={completion.sections}
          doneCount={completion.doneCount}
          activeSection={activeSection}
          onSelect={goToSection}
          className="sticky top-16 z-10 shadow-sm"
        />

        {locked && (
          <Alert>
            <Lock className="size-4" aria-hidden />
            <AlertDescription>
              Báo cáo đã gửi lúc{" "}
              <strong>{formatDate(data.report.submittedAt)}</strong> và được khoá.
              Cần sửa thì báo bộ phận đào tạo.
            </AlertDescription>
          </Alert>
        )}

        {/* ---------------------------------------------------------- Mục 1 */}
        <SectionCard
          number={1}
          title="Thông tin buổi học"
          badge={<StatusBadge label="Tự động" tone="neutral" />}
          register={registerSection}
        >
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Meta label="Tên lớp" value={`${data.session.classCode} · ${data.session.className}`} />
            <Meta label="Giáo viên" value={data.session.teacherName} />
            <Meta label="Ngày học" value={formatDate(data.session.startsAt)} />
            <Meta
              label="Thời gian"
              value={`${formatTime(data.session.startsAt)}–${formatTime(data.session.endsAt)}`}
            />
            <Meta label="Buổi số" value={String(data.session.sessionNumber)} />
          </dl>

          <SegmentedChoice
            label="Hình thức"
            required
            options={SESSION_REPORT_MODES}
            value={form.mode}
            onChange={(mode) => patch({ mode })}
            disabled={locked}
            className="sm:max-w-sm"
          />

          <Field id="topic" label="Bài / Chủ đề giảng dạy" required>
            <Input
              id="topic"
              value={form.topic}
              maxLength={500}
              disabled={locked}
              placeholder="Ví dụ: Bài 11 — Đàm phán lãi suất vay doanh nghiệp"
              onChange={(event) => patch({ topic: event.target.value })}
            />
          </Field>
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 2 */}
        <SectionCard
          number={2}
          title="Chuyên cần học viên"
          badge={<StatusBadge label="Lấy từ điểm danh" tone="info" />}
          register={registerSection}
        >
          <Alert>
            <Info className="size-4" aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-x-2">
              Số liệu lấy thẳng từ điểm danh buổi này. Sai chỗ nào thì sửa ở điểm
              danh, báo cáo tự cập nhật theo.
              <Link
                href={`/teacher/attendance?session=${data.session.id}`}
                className="text-primary font-semibold underline underline-offset-2"
              >
                Sửa điểm danh →
              </Link>
            </AlertDescription>
          </Alert>

          {/*
            KHÔNG có ô nào để gõ lại sĩ số / có mặt / vắng — vế (b) của `D-43`.
            Cho gõ tay là mở đường cho hai con số khác nhau về cùng một buổi.
          */}
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Sĩ số lớp" value={data.attendance.rosterSize} />
            <Stat label="Có mặt" value={data.attendance.present} />
            <Stat label="Vắng" value={data.attendance.absent} tone="warning" />
            <Stat label="Đi trễ / về sớm" value={data.attendance.late + data.attendance.excused} />
          </dl>

          {data.attendance.lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Cả lớp có mặt đầy đủ — không cần ghi lý do.
            </p>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm font-semibold">Lý do vắng / đi trễ / về sớm</p>
              <ul className="grid gap-2">
                {data.attendance.lines.map((line) => (
                  <li
                    key={line.enrollmentId}
                    className="grid gap-1.5 rounded-lg border p-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center"
                  >
                    <span className="flex items-center gap-2">
                      <StatusBadge
                        label={ATTENDANCE_LABEL[line.status]}
                        tone={line.status === "absent" ? "danger" : "warning"}
                      />
                      <span className="truncate text-sm font-semibold">
                        {line.fullName}
                      </span>
                    </span>
                    <Input
                      value={reasons[line.enrollmentId] ?? ""}
                      disabled={locked}
                      placeholder="Lý do…"
                      aria-label={`Lý do của ${line.fullName}`}
                      onChange={(event) => {
                        dirty.current = true;
                        setReasons((prev) => ({
                          ...prev,
                          [line.enrollmentId]: event.target.value,
                        }));
                      }}
                      onBlur={(event) =>
                        void saveReason(line.enrollmentId, event.target.value)
                      }
                    />
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                Chỉ hiện học viên vắng, đi trễ hoặc về sớm. Ghi ở đây cũng cập
                nhật luôn ghi chú điểm danh.
              </p>
            </div>
          )}
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 3 */}
        <SectionCard
          number={3}
          title="Tiến độ giảng dạy"
          badge={<StatusBadge label="Thay nhật ký buổi" tone="neutral" />}
          register={registerSection}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="lesson" label="Bài học đã dạy" required>
              {lessons.length === 0 ? (
                <Alert>
                  <AlertCircle className="size-4" aria-hidden />
                  <AlertDescription>
                    Khóa học chưa có bài học. Quản trị viên cần bổ sung giáo trình.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={lessonId ?? ""}
                  disabled={locked}
                  onValueChange={(value) => {
                    dirty.current = true;
                    setLessonId(value);
                  }}
                >
                  <SelectTrigger id="lesson" className="w-full">
                    <SelectValue placeholder="Chọn bài học" />
                  </SelectTrigger>
                  <SelectContent>
                    {lessonsByModule.map(([moduleId, group]) => (
                      <SelectGroup key={moduleId}>
                        <SelectLabel>{group.title}</SelectLabel>
                        {group.lessons.map((lesson) => (
                          <SelectItem key={lesson.id} value={lesson.id}>
                            {lesson.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <SegmentedChoice
              label="Mức độ hoàn thành kế hoạch buổi học"
              required
              options={PLAN_COMPLETIONS}
              value={form.plan_completion}
              onChange={(plan_completion) => patch({ plan_completion })}
              disabled={locked}
            />
          </div>

          <Field id="lesson-log" label="Nội dung đã giảng" required>
            <Textarea
              id="lesson-log"
              rows={4}
              maxLength={5000}
              value={lessonLog}
              disabled={locked}
              placeholder="Ví dụ: Ôn từ vựng bài 10; luyện mẫu câu thương lượng; hoàn thành trang 78–84."
              onChange={(event) => {
                dirty.current = true;
                setLessonLog(event.target.value);
              }}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <YesNoChoice
                label="Nội dung chưa hoàn thành"
                noLabel="Không có"
                value={form.has_unfinished}
                onChange={(has_unfinished) => patch({ has_unfinished })}
                disabled={locked}
              />
              {form.has_unfinished && (
                <>
                  <Textarea
                    rows={2}
                    maxLength={2000}
                    value={form.unfinished_content}
                    disabled={locked}
                    placeholder="Nội dung chưa hoàn thành…"
                    aria-label="Nội dung chưa hoàn thành"
                    onChange={(event) => patch({ unfinished_content: event.target.value })}
                  />
                  <Input
                    value={form.unfinished_reason}
                    maxLength={2000}
                    disabled={locked}
                    placeholder="Lý do chưa hoàn thành…"
                    aria-label="Lý do chưa hoàn thành"
                    onChange={(event) => patch({ unfinished_reason: event.target.value })}
                  />
                </>
              )}
            </div>

            <div className="grid gap-2">
              <YesNoChoice
                label="Bài tập / bài luyện tập đã giao"
                noLabel="Không có"
                value={form.has_homework}
                onChange={(has_homework) => patch({ has_homework })}
                disabled={locked}
              />
              {form.has_homework && (
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={form.homework_assigned}
                  disabled={locked}
                  placeholder="Bài tập đã giao…"
                  aria-label="Bài tập đã giao"
                  onChange={(event) => patch({ homework_assigned: event.target.value })}
                />
              )}
            </div>
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 4 */}
        <SectionCard number={4} title="Đánh giá kết quả buổi học" register={registerSection}>
          <div className="grid gap-4 sm:grid-cols-2">
            <RatingScale
              id="comprehension"
              label="4.1 Mức độ tiếp thu chung của học viên"
              options={COMPREHENSION_LEVELS}
              value={form.comprehension_level}
              onChange={(comprehension_level) => patch({ comprehension_level })}
              disabled={locked}
            />
            <RatingScale
              id="interaction"
              label="4.2 Mức độ tương tác trong lớp"
              options={INTERACTION_LEVELS}
              value={form.interaction_level}
              onChange={(interaction_level) => patch({ interaction_level })}
              disabled={locked}
            />
            <RatingScale
              id="focus"
              label="4.3 Mức độ tập trung"
              options={FOCUS_LEVELS}
              value={form.focus_level}
              onChange={(focus_level) => patch({ focus_level })}
              disabled={locked}
            />

            {/*
              4.4 KHÔNG phải thang 1–5: bốn mốc phần trăm là một thang, còn
              "Chưa có bài tập cần kiểm tra" là trạng thái không áp dụng. Nhét
              chung thành năm nút cùng cỡ là nói dối về hình dạng dữ liệu.
            */}
            <div className="grid gap-1.5">
              <SegmentedChoice
                label="4.4 Tình hình hoàn thành bài tập"
                options={HOMEWORK_COMPLETIONS.filter((option) => option.onScale)}
                value={
                  form.homework_completion === "no_homework" ? null : form.homework_completion
                }
                onChange={(homework_completion) => patch({ homework_completion })}
                disabled={locked}
              />
              <CheckboxRow
                label="Chưa có bài tập cần kiểm tra"
                checked={form.homework_completion === "no_homework"}
                disabled={locked}
                onChange={() =>
                  patch({
                    homework_completion:
                      form.homework_completion === "no_homework" ? null : "no_homework",
                  })
                }
              />
            </div>
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 5 */}
        <SectionCard
          number={5}
          title="Đánh giá học viên cần lưu ý"
          register={registerSection}
        >
          {/*
            Ô này đứng TRÊN ĐẦU mục và thu gọn cả phần còn lại: mục nặng nhất
            biểu mẫu biến mất bằng một cú chạm ở những buổi bình thường — mà
            phần lớn buổi là bình thường.
          */}
          <CheckboxRow
            label="Không có học viên cần lưu ý trong buổi học này"
            emphasis
            checked={form.no_students_of_note}
            disabled={locked}
            onChange={() => patch({ no_students_of_note: !form.no_students_of_note })}
          />

          {!form.no_students_of_note && (
            <div className="grid gap-2">
              {SECTION_5_CATEGORIES.map((category) => (
                <StudentCategoryField
                  key={category.value}
                  category={category.value}
                  label={category.label}
                  noteLabel={category.noteLabel}
                  roster={data.roster}
                  entries={students}
                  onChange={patchStudents}
                  disabled={locked}
                  tone={category.value === "escalate" ? "warning" : "default"}
                  hint={
                    category.value === "escalate"
                      ? "Tên ghi ở đây sẽ hiện trên bảng của bộ phận đào tạo."
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 6 */}
        <SectionCard
          number={6}
          title="Vấn đề phát sinh trong buổi học"
          register={registerSection}
        >
          <YesNoChoice
            label="Buổi học có vấn đề phát sinh không?"
            value={form.has_issue}
            onChange={(has_issue) => patch({ has_issue })}
            disabled={locked}
          />

          {form.has_issue === true && (
            <div className="grid gap-3">
              <CheckboxGrid
                label="Nhóm vấn đề"
                options={ISSUE_CATEGORIES}
                values={form.issue_categories}
                disabled={locked}
                onToggle={(value) =>
                  patch({
                    issue_categories: form.issue_categories.includes(value)
                      ? form.issue_categories.filter((item) => item !== value)
                      : [...form.issue_categories, value],
                  })
                }
              />

              {form.issue_categories.includes("other") && (
                <Field id="issue-other" label="Vấn đề khác">
                  <Input
                    id="issue-other"
                    value={form.issue_other}
                    maxLength={500}
                    disabled={locked}
                    onChange={(event) => patch({ issue_other: event.target.value })}
                  />
                </Field>
              )}

              <Field id="issue-description" label="Mô tả ngắn vấn đề">
                <Textarea
                  id="issue-description"
                  rows={3}
                  maxLength={2000}
                  value={form.issue_description}
                  disabled={locked}
                  onChange={(event) => patch({ issue_description: event.target.value })}
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <RadioList
                  label="Ảnh hưởng đến buổi học"
                  options={ISSUE_IMPACTS}
                  value={form.issue_impact}
                  onChange={(issue_impact) => patch({ issue_impact })}
                  disabled={locked}
                />
                <div className="grid gap-1">
                  <RadioList
                    label="Mức độ cần xử lý"
                    options={ISSUE_SEVERITIES}
                    value={form.issue_severity}
                    onChange={(issue_severity) => patch({ issue_severity })}
                    disabled={locked}
                  />
                  {/* Hệ quả nói TRƯỚC khi bấm, không phải sau. */}
                  <p className="text-muted-foreground px-2 text-xs">
                    Chọn <strong>Cao</strong> sẽ báo ngay cho bộ phận đào tạo.
                  </p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 7 */}
        <SectionCard
          number={7}
          title="Kế hoạch cho buổi học tiếp theo"
          register={registerSection}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="next-content" label="Nội dung dự kiến" required>
              <Input
                id="next-content"
                value={form.next_content}
                maxLength={2000}
                disabled={locked}
                onChange={(event) => patch({ next_content: event.target.value })}
              />
            </Field>
            <Field id="review-content" label="Nội dung cần ôn lại / củng cố">
              <Input
                id="review-content"
                value={form.review_content}
                maxLength={2000}
                disabled={locked}
                onChange={(event) => patch({ review_content: event.target.value })}
              />
            </Field>
          </div>

          <StudentCategoryField
            category="follow_up_next"
            label="Học viên cần theo dõi thêm"
            noteLabel="Ghi chú"
            roster={data.roster}
            entries={students}
            onChange={patchStudents}
            disabled={locked}
          />

          <Field id="watch-note" label="Nội dung cần giáo viên lưu ý">
            <Input
              id="watch-note"
              value={form.teacher_watch_note}
              maxLength={2000}
              disabled={locked}
              placeholder="Ví dụ: chuẩn bị sẵn bản in nếu máy chiếu chưa sửa…"
              onChange={(event) => patch({ teacher_watch_note: event.target.value })}
            />
          </Field>

          <div className="grid gap-2">
            <YesNoChoice
              label="Giáo viên có cần bộ phận đào tạo hỗ trợ không?"
              value={form.needs_support}
              onChange={(needs_support) => patch({ needs_support })}
              disabled={locked}
            />
            {form.needs_support && (
              <Textarea
                rows={3}
                maxLength={2000}
                value={form.support_request}
                disabled={locked}
                placeholder="Nội dung cần hỗ trợ…"
                aria-label="Nội dung cần hỗ trợ"
                onChange={(event) => patch({ support_request: event.target.value })}
              />
            )}
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 8 */}
        <SectionCard
          number={8}
          title="Minh chứng buổi học"
          badge={
            <StatusBadge
              label={`${evidence.length}/${MAX_EVIDENCE} ảnh`}
              tone="neutral"
            />
          }
          register={registerSection}
        >
          <CheckboxGrid
            label="Loại minh chứng"
            options={EVIDENCE_KINDS}
            values={form.evidence_kinds}
            disabled={locked}
            onToggle={(value) =>
              patch({
                evidence_kinds: form.evidence_kinds.includes(value)
                  ? form.evidence_kinds.filter((item) => item !== value)
                  : [...form.evidence_kinds, value],
              })
            }
          />

          {!locked && evidence.length < MAX_EVIDENCE && (
            <div className="flex flex-wrap gap-2">
              {/*
                `capture="environment"` mở THẲNG máy ảnh, không bắt đi qua thư
                viện — giáo viên chụp bảng ngay cuối buổi là hành vi thật của
                mục 8.
              */}
              <label className="border-input hover:bg-muted focus-within:ring-ring inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold focus-within:ring-2 sm:flex-none">
                <Camera className="size-4" aria-hidden />
                Chụp ảnh
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => void uploadEvidence(event.target.files)}
                />
              </label>
              <label className="border-input hover:bg-muted focus-within:ring-ring inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold focus-within:ring-2 sm:flex-none">
                <Upload className="size-4" aria-hidden />
                Chọn từ máy
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => void uploadEvidence(event.target.files)}
                />
              </label>
            </div>
          )}

          {evidence.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {evidence.map((item) => (
                <li
                  key={item.id}
                  className="bg-surface-sunken relative grid aspect-[4/3] place-items-center rounded-lg border"
                >
                  <span className="text-muted-foreground px-2 text-center text-xs break-all">
                    {item.storagePath.split("/").pop()}
                  </span>
                  {!locked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-1 right-1 size-7 p-0"
                      aria-label="Gỡ ảnh minh chứng"
                      onClick={() => void dropEvidence(item.id)}
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="text-muted-foreground text-xs">
            Ảnh được nén tự động trước khi tải lên · tối đa {MAX_EVIDENCE} ảnh.
          </p>
        </SectionCard>

        {/* ---------------------------------------------------------- Mục 9 */}
        <SectionCard
          number={9}
          title="Nhận xét tổng kết của giáo viên"
          register={registerSection}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <RadioList
              label="Đánh giá chung về buổi học"
              options={OVERALL_RATINGS}
              value={form.overall_rating}
              onChange={(overall_rating) => patch({ overall_rating })}
              disabled={locked}
            />
            <Field id="closing-note" label="Nhận xét hoặc đề xuất thêm">
              <Textarea
                id="closing-note"
                rows={7}
                maxLength={3000}
                value={form.closing_note}
                disabled={locked}
                onChange={(event) => patch({ closing_note: event.target.value })}
              />
            </Field>
          </div>
        </SectionCard>

        {/* --------------------------------------------------------- XÁC NHẬN */}
        {!locked && (
          <Card className="border-primary-200 bg-primary-50">
            <CardContent className="grid gap-3 py-4">
              <CheckboxRow
                label={CONFIRMATION_TEXT}
                emphasis
                checked={form.confirmed}
                onChange={() => patch({ confirmed: !form.confirmed })}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span
                  className="text-muted-foreground mr-auto text-xs"
                  aria-live="polite"
                >
                  {saving
                    ? "Đang lưu nháp…"
                    : savedAt
                      ? `Đã lưu nháp ${savedAt}`
                      : "Nháp tự lưu sau mỗi thay đổi"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  <Save className="size-4" aria-hidden />
                  Lưu nháp
                </Button>
                {/*
                  Nút Gửi KHÔNG bị khoá khi biểu mẫu còn thiếu: bấm vào sẽ mở
                  bảng liệt kê đúng mục nào còn trống kèm đường nhảy tới đó. Một
                  nút mờ không giải thích được vì sao nó mờ.
                */}
                <Button type="button" disabled={submitting} onClick={() => void submit()}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  Gửi báo cáo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={missingOpen} onOpenChange={setMissingOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chưa gửi được — còn thiếu</DialogTitle>
            <DialogDescription>
              Bấm vào một mục để nhảy thẳng tới chỗ cần điền.
            </DialogDescription>
          </DialogHeader>

          <ul className="grid gap-1">
            {completion.missing.map((section) => (
              <li key={section.number}>
                <button
                  type="button"
                  className="hover:bg-muted focus-visible:ring-ring flex w-full items-start gap-2 rounded-md p-2 text-left focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => {
                    setMissingOpen(false);
                    goToSection(section.number);
                  }}
                >
                  <TriangleAlert
                    className="text-warning mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <span className="text-sm">
                    <span className="font-semibold">
                      {section.number}. {section.title}
                    </span>
                    {section.hint && (
                      <span className="text-muted-foreground block text-xs">
                        {section.hint}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {!form.confirmed && (
              <li className="flex items-start gap-2 p-2">
                <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="text-sm font-semibold">
                  Chưa tích ô xác nhận ở cuối biểu mẫu
                </span>
              </li>
            )}
          </ul>

          <DialogFooter>
            <Button type="button" onClick={() => setMissingOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Khoá theo đúng union của `AttendanceLine["status"]` chứ không phải
 * `Record<string, string>`: kiểu rộng thì tra cứu trả `string | undefined` và
 * thêm một trạng thái điểm danh mới sẽ lọt qua typecheck rồi hiện ô trống.
 */
const ATTENDANCE_LABEL: Record<AttendanceLine["status"], string> = {
  present: "Có mặt",
  late: "Đi trễ",
  absent: "Vắng",
  excused: "Có phép",
};

function SectionCard({
  number,
  title,
  badge,
  register,
  children,
}: {
  number: number;
  title: string;
  badge?: React.ReactNode;
  register: (element: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <Card
      ref={register as React.Ref<HTMLDivElement>}
      data-section={number}
      className="scroll-mt-20"
    >
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">
          <span className="text-muted-foreground mr-1.5 font-mono">{number}.</span>
          {title}
        </CardTitle>
        {badge}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={`text-xl font-bold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
