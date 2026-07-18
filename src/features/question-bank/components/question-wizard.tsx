"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { saveQuestionAction } from "@/features/question-bank/server/actions";
import {
  AUDIO_QUESTION_TYPES,
  QUESTION_SKILL_LABELS,
  QUESTION_TYPE_LABELS,
  SKILL_QUESTION_TYPES,
  WIZARD_SKILLS,
  type QuestionType,
  type StructuredContent,
} from "@/features/question-builder/domain/questions";
import { QuestionRenderer } from "@/features/question-builder/renderers/question-renderer";
import { PinyinField } from "@/features/question-bank/components/pinyin-tone-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/lib/use-form-action";

type WizardSkill = (typeof WIZARD_SKILLS)[number];

const DIFFICULTIES = [
  ["easy", "Dễ"],
  ["medium", "Vừa"],
  ["hard", "Khó"],
] as const;

type VersionInitial = {
  questionId: string;
  skill: WizardSkill;
  type: QuestionType;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  explanation: string;
  choices: Array<{ key: string; content: string }>;
  answerKey: unknown;
  gradingConfig: unknown;
  promptContent: unknown;
  hasAudio: boolean;
  sourceVersionId: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function rubricRows(
  value: unknown,
): Array<{ criterion: string; points: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const item = asRecord(row);
    return typeof item.criterion === "string" &&
      typeof item.points === "number" &&
      item.points > 0
      ? [{ criterion: item.criterion, points: item.points }]
      : [];
  });
}

function emptyState() {
  return {
    step: 1,
    skill: null as WizardSkill | null,
    type: null as QuestionType | null,
    title: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
    prompt: "",
    explanation: "",
    choices: ["", ""],
    correctIndex: 0,
    correctIndexes: [] as number[],
    partialCredit: false,
    wrongSelectionZero: false,
    trueValue: true,
    accepted: [""],
    tokens: ["", ""],
    rubric: [{ criterion: "", points: 1 }],
    maxPlays: 2,
    audioFile: null as File | null,
  };
}

type WizardState = ReturnType<typeof emptyState>;

/**
 * P-B — Wizard soạn câu hỏi theo kỹ năng (Kahoot-style).
 * Bước 1 Kỹ năng → 2 Dạng câu → 3 Nội dung + đáp án + audio → 4 Xem trước & lưu.
 * `create`: chọn từ đầu. `version`: skill/type prefill, nhập lại đáp án & audio.
 */
export function QuestionWizard({
  trigger,
  version,
}: {
  trigger: React.ReactNode;
  version?: VersionInitial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const form = useFormAction(saveQuestionAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    toastError: true,
  });
  const [s, setS] = useState<WizardState>(emptyState);

  // Nạp lại state khi MỞ dialog (trong event, không dùng setState-in-effect).
  function initialState(): WizardState {
    const base = emptyState();
    if (!version) return base;
    const choices =
      version.choices.length >= 2
        ? version.choices.map((choice) => choice.content)
        : ["", ""];
    const answerKey = asRecord(version.answerKey);
    const gradingConfig = asRecord(version.gradingConfig);
    const promptContent = asRecord(version.promptContent);
    const correctKeys = stringArray(answerKey.values);
    const correctIndex = Math.max(
      0,
      version.choices.findIndex((choice) => choice.key === answerKey.value),
    );
    const correctIndexes = correctKeys.flatMap((key) => {
      const index = version.choices.findIndex((choice) => choice.key === key);
      return index >= 0 ? [index] : [];
    });
    const storedTokens = stringArray(answerKey.value);
    const storedRubric = rubricRows(gradingConfig.rubric);
    return {
      ...base,
      step: 3,
      skill: version.skill,
      type: version.type,
      title: version.title,
      difficulty: version.difficulty,
      prompt: version.prompt,
      explanation: version.explanation,
      choices,
      correctIndex,
      correctIndexes,
      partialCredit: gradingConfig.scoring_mode === "partial_credit",
      wrongSelectionZero: gradingConfig.wrong_selection_zero === true,
      trueValue: answerKey.value === true || answerKey.value === "true",
      accepted: stringArray(answerKey.accepted).length
        ? stringArray(answerKey.accepted)
        : base.accepted,
      tokens:
        version.type === "ordering"
          ? storedTokens.length >= 2
            ? storedTokens
            : choices
          : base.tokens,
      rubric: storedRubric.length ? storedRubric : base.rubric,
      maxPlays:
        typeof promptContent.max_plays === "number"
          ? promptContent.max_plays
          : base.maxPlays,
    };
  }

  function handleOpenChange(next: boolean) {
    if (next) setS(initialState());
    setOpen(next);
  }

  const patch = (next: Partial<WizardState>) =>
    setS((prev) => ({ ...prev, ...next }));

  const needsAudio = s.type ? AUDIO_QUESTION_TYPES.includes(s.type) : false;
  const audioUrl = useMemo(
    () => (s.audioFile ? URL.createObjectURL(s.audioFile) : null),
    [s.audioFile],
  );
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const contentError = validate(
    s,
    needsAudio && !s.audioFile && !version?.hasAudio,
  );

  const buildContent = (): StructuredContent | null => {
    if (!s.type) return null;
    switch (s.type) {
      case "single_choice":
      case "listening_choice":
        return {
          type: s.type,
          options: s.choices.map((c) => c.trim()),
          correctIndex: s.correctIndex,
          maxPlays: s.maxPlays,
        };
      case "multiple_choice":
        return {
          type: "multiple_choice",
          options: s.choices.map((c) => c.trim()),
          correctIndexes: s.correctIndexes,
          partialCredit: s.partialCredit,
          wrongSelectionZero: s.wrongSelectionZero,
        };
      case "true_false":
        return { type: "true_false", correct: s.trueValue };
      case "fill_blank":
      case "short_text":
        return {
          type: s.type,
          accepted: s.accepted.map((a) => a.trim()).filter(Boolean),
        };
      case "dictation":
        return {
          type: "dictation",
          accepted: s.accepted.map((a) => a.trim()).filter(Boolean),
          maxPlays: s.maxPlays,
        };
      case "ordering":
        return {
          type: "ordering",
          tokens: s.tokens.map((t) => t.trim()).filter(Boolean),
        };
      case "essay_translation":
        return {
          type: "essay_translation",
          rubric: s.rubric.map((r) => ({
            criterion: r.criterion.trim(),
            points: r.points,
          })),
        };
      case "speaking":
        return { type: "speaking" };
      default:
        return null;
    }
  };

  const submit = async () => {
    const content = buildContent();
    if (!s.skill || !s.type || !content || contentError) return;
    const fd = new FormData();
    fd.set("mode", version ? "version" : "create");
    if (version) fd.set("question_id", version.questionId);
    fd.set("title", s.title.trim());
    fd.set("skill", s.skill);
    fd.set("difficulty", s.difficulty);
    fd.set("question_type", s.type);
    fd.set("prompt_text", s.prompt.trim());
    fd.set("explanation_text", s.explanation.trim());
    fd.set("content", JSON.stringify(content));
    if (version?.hasAudio) fd.set("source_version_id", version.sourceVersionId);
    if (s.audioFile) fd.set("audio", s.audioFile);
    setPending(true);
    try {
      await form.formAction(fd);
    } finally {
      setPending(false);
    }
  };

  const previewOptions =
    s.type &&
    ["single_choice", "multiple_choice", "listening_choice"].includes(s.type)
      ? s.choices
          .map((c, i) => ({ option_key: String(i + 1), content: c.trim() }))
          .filter((o) => o.content)
      : s.type === "ordering"
        ? s.tokens
            .map((t, i) => ({ option_key: String(i + 1), content: t.trim() }))
            .filter((o) => o.content)
        : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {version ? "Chỉnh sửa câu hỏi" : "Soạn câu hỏi"}
          </DialogTitle>
          <DialogDescription>
            {version
              ? "Bạn đang sửa câu hỏi trong ngân hàng. Bài tập/đề đã dùng câu này không bị thay đổi; lần chọn sau sẽ dùng nội dung mới."
              : "Chọn kỹ năng → dạng câu → nội dung → xem trước. Đáp án lưu riêng, không gửi cho học viên."}
          </DialogDescription>
        </DialogHeader>

        <Stepper step={s.step} version={Boolean(version)} />

        {form.state.error && (
          <Alert variant="destructive">
            <AlertDescription>{form.state.error}</AlertDescription>
          </Alert>
        )}

        {/* Bước 1 — Kỹ năng */}
        {s.step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Chọn kỹ năng</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {WIZARD_SKILLS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => patch({ skill, type: null, step: 2 })}
                  className={`hover:border-primary rounded-lg border p-4 text-left transition ${
                    s.skill === skill
                      ? "border-primary ring-primary ring-1"
                      : ""
                  }`}
                >
                  <span className="font-medium">
                    {QUESTION_SKILL_LABELS[skill]}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {SKILL_QUESTION_TYPES[skill].length} dạng câu
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bước 2 — Dạng câu */}
        {s.step === 2 && s.skill && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Dạng câu cho kỹ năng {QUESTION_SKILL_LABELS[s.skill]}
            </p>
            <div className="grid gap-2">
              {SKILL_QUESTION_TYPES[s.skill].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => patch({ type, step: 3 })}
                  className={`hover:border-primary rounded-lg border p-3 text-left transition ${
                    s.type === type ? "border-primary ring-primary ring-1" : ""
                  }`}
                >
                  {QUESTION_TYPE_LABELS[type]}
                  {AUDIO_QUESTION_TYPES.includes(type) && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      · cần audio
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bước 3 — Nội dung */}
        {s.step === 3 && s.type && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="w-title">Tiêu đề nội bộ</Label>
                <Input
                  id="w-title"
                  value={s.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-diff">Độ khó</Label>
                <select
                  id="w-diff"
                  value={s.difficulty}
                  onChange={(e) =>
                    patch({
                      difficulty: e.target.value as WizardState["difficulty"],
                    })
                  }
                  className="bg-background h-11 w-full rounded-md border px-3 text-sm"
                >
                  {DIFFICULTIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nội dung câu hỏi</Label>
              <PinyinField
                multiline
                rows={3}
                value={s.prompt}
                onChange={(value) => patch({ prompt: value })}
                placeholder="Nhập đề bài (hỗ trợ IME tiếng Trung)…"
              />
            </div>

            {needsAudio && (
              <AudioEditor
                audioUrl={audioUrl}
                fileName={s.audioFile?.name}
                maxPlays={s.maxPlays}
                onFile={(file) => patch({ audioFile: file })}
                onMaxPlays={(value) => patch({ maxPlays: value })}
              />
            )}

            <TypeEditor state={s} patch={patch} />

            <div className="space-y-1.5">
              <Label>Giải thích (hiện sau khi công bố)</Label>
              <PinyinField
                multiline
                rows={2}
                value={s.explanation}
                onChange={(value) => patch({ explanation: value })}
              />
            </div>
          </div>
        )}

        {/* Bước 4 — Xem trước */}
        {s.step === 4 && s.type && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Xem trước như học viên</p>
            <div className="rounded-xl border p-4">
              <QuestionRenderer
                type={s.type}
                prompt={s.prompt}
                options={previewOptions}
                disabled
                promptContent={audioUrl ? { audio_url: audioUrl } : {}}
              />
            </div>
            {contentError && (
              <Alert variant="destructive">
                <AlertDescription>{contentError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Điều hướng */}
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={s.step <= (version ? 3 : 1) || pending}
            onClick={() => patch({ step: s.step - 1 })}
          >
            Quay lại
          </Button>
          {s.step < 4 ? (
            <Button
              type="button"
              disabled={!canAdvance(s) || pending}
              onClick={() => patch({ step: s.step + 1 })}
            >
              Tiếp tục
            </Button>
          ) : (
            <Button
              type="button"
              disabled={Boolean(contentError) || pending}
              onClick={submit}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Đang lưu…
                </>
              ) : version ? (
                "Lưu chỉnh sửa"
              ) : (
                "Lưu & công bố"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function canAdvance(s: WizardState): boolean {
  if (s.step === 1) return Boolean(s.skill);
  if (s.step === 2) return Boolean(s.type);
  if (s.step === 3)
    return s.title.trim().length >= 2 && s.prompt.trim().length >= 1;
  return true;
}

function validate(s: WizardState, needsAudio: boolean): string | null {
  if (s.title.trim().length < 2) return "Nhập tiêu đề nội bộ (≥ 2 ký tự).";
  if (s.prompt.trim().length < 1) return "Nhập nội dung câu hỏi.";
  if (needsAudio && !s.audioFile) return "Dạng câu Nghe cần một file audio.";
  if (!s.type) return "Chưa chọn dạng câu.";
  switch (s.type) {
    case "single_choice":
    case "listening_choice":
    case "multiple_choice": {
      const filled = s.choices.filter((c) => c.trim());
      if (filled.length < 2) return "Cần ít nhất hai lựa chọn.";
      if (s.choices.some((c, i) => !c.trim() && i < filled.length))
        return "Không để trống lựa chọn ở giữa.";
      if (s.type === "multiple_choice") {
        if (s.correctIndexes.length < 1) return "Chọn ít nhất một đáp án đúng.";
        if (s.correctIndexes.some((i) => !s.choices[i]?.trim()))
          return "Đáp án đúng phải là lựa chọn có nội dung.";
      } else if (!s.choices[s.correctIndex]?.trim()) {
        return "Đáp án đúng phải là lựa chọn có nội dung.";
      }
      return null;
    }
    case "fill_blank":
    case "short_text":
    case "dictation":
      if (s.accepted.filter((a) => a.trim()).length < 1)
        return "Cần ít nhất một đáp án chấp nhận.";
      return null;
    case "ordering":
      if (s.tokens.filter((t) => t.trim()).length < 2)
        return "Cần ít nhất hai token.";
      return null;
    case "essay_translation":
      if (s.rubric.filter((r) => r.criterion.trim()).length < 1)
        return "Cần ít nhất một tiêu chí rubric.";
      if (s.rubric.some((r) => r.criterion.trim() && r.points <= 0))
        return "Điểm tiêu chí phải lớn hơn 0.";
      return null;
    default:
      return null;
  }
}

function Stepper({ step, version }: { step: number; version: boolean }) {
  const labels = ["Kỹ năng", "Dạng câu", "Nội dung", "Xem trước"];
  return (
    <ol className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {labels.map((label, index) => {
        const n = index + 1;
        const locked = version && n < 3;
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 ${
              step === n ? "text-foreground font-medium" : ""
            } ${locked ? "opacity-40" : ""}`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
                step >= n ? "border-primary text-primary" : ""
              }`}
            >
              {n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function AudioEditor({
  audioUrl,
  fileName,
  maxPlays,
  onFile,
  onMaxPlays,
}: {
  audioUrl: string | null;
  fileName?: string;
  maxPlays: number;
  onFile: (file: File | null) => void;
  onMaxPlays: (value: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>Audio (MP3/M4A, tối đa 50 MB)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="audio/mpeg,audio/mp4"
          className="h-11 max-w-72"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="w-maxplays" className="text-xs">
            Số lần nghe
          </Label>
          <Input
            id="w-maxplays"
            type="number"
            min={1}
            max={20}
            value={maxPlays}
            onChange={(e) =>
              onMaxPlays(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
            }
            className="h-11 w-20"
          />
        </div>
      </div>
      {audioUrl ? (
        <audio controls preload="metadata" src={audioUrl} className="w-full">
          <track kind="captions" />
        </audio>
      ) : (
        <p className="text-muted-foreground text-xs">Chưa có audio.</p>
      )}
      {fileName && (
        <p className="text-muted-foreground text-xs">Đã chọn: {fileName}</p>
      )}
    </div>
  );
}

function TypeEditor({
  state: s,
  patch,
}: {
  state: WizardState;
  patch: (next: Partial<WizardState>) => void;
}) {
  if (!s.type) return null;

  if (
    ["single_choice", "listening_choice", "multiple_choice"].includes(s.type)
  ) {
    const multi = s.type === "multiple_choice";
    return (
      <div className="space-y-2">
        <Label>Lựa chọn (đánh dấu đáp án đúng)</Label>
        {s.choices.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type={multi ? "checkbox" : "radio"}
              name="w-correct"
              aria-label={`Đáp án đúng ${index + 1}`}
              checked={
                multi
                  ? s.correctIndexes.includes(index)
                  : s.correctIndex === index
              }
              onChange={(e) => {
                if (multi) {
                  patch({
                    correctIndexes: e.target.checked
                      ? [...s.correctIndexes, index]
                      : s.correctIndexes.filter((i) => i !== index),
                  });
                } else {
                  patch({ correctIndex: index });
                }
              }}
            />
            <div className="flex-1">
              <PinyinField
                value={choice}
                onChange={(value) => {
                  const next = [...s.choices];
                  next[index] = value;
                  patch({ choices: next });
                }}
                placeholder={`Lựa chọn ${index + 1}`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={s.choices.length <= 2}
              onClick={() => {
                const next = s.choices.filter((_, i) => i !== index);
                patch({
                  choices: next,
                  correctIndex: Math.min(s.correctIndex, next.length - 1),
                  correctIndexes: s.correctIndexes
                    .filter((i) => i !== index)
                    .map((i) => (i > index ? i - 1 : i)),
                });
              }}
            >
              Xóa
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => patch({ choices: [...s.choices, ""] })}
        >
          Thêm lựa chọn
        </Button>
        {multi && (
          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.partialCredit}
                onChange={(e) => patch({ partialCredit: e.target.checked })}
              />
              Chấm một phần (partial credit) — điểm theo tỉ lệ đáp án đúng đã
              chọn
            </label>
            {s.partialCredit && (
              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.wrongSelectionZero}
                  onChange={(e) =>
                    patch({ wrongSelectionZero: e.target.checked })
                  }
                />
                Chọn sai bất kỳ đáp án nào → 0 điểm toàn câu
              </label>
            )}
          </div>
        )}
      </div>
    );
  }

  if (s.type === "true_false") {
    return (
      <div className="space-y-2">
        <Label>Đáp án đúng</Label>
        <div className="flex gap-2">
          {[
            [true, "Đúng"],
            [false, "Sai"],
          ].map(([value, label]) => (
            <Button
              key={String(value)}
              type="button"
              variant={s.trueValue === value ? "default" : "outline"}
              onClick={() => patch({ trueValue: value as boolean })}
            >
              {label as string}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (["fill_blank", "short_text", "dictation"].includes(s.type)) {
    return (
      <div className="space-y-2">
        <Label>Đáp án chấp nhận (mỗi ô một cách viết đúng)</Label>
        {s.accepted.map((answer, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1">
              <PinyinField
                value={answer}
                onChange={(value) => {
                  const next = [...s.accepted];
                  next[index] = value;
                  patch({ accepted: next });
                }}
                placeholder={`Đáp án ${index + 1}`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={s.accepted.length <= 1}
              onClick={() =>
                patch({ accepted: s.accepted.filter((_, i) => i !== index) })
              }
            >
              Xóa
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => patch({ accepted: [...s.accepted, ""] })}
        >
          Thêm đáp án
        </Button>
      </div>
    );
  }

  if (s.type === "ordering") {
    return (
      <div className="space-y-2">
        <Label>Token theo đúng thứ tự</Label>
        {s.tokens.map((token, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-muted-foreground w-6 text-sm">
              {index + 1}.
            </span>
            <div className="flex-1">
              <PinyinField
                value={token}
                onChange={(value) => {
                  const next = [...s.tokens];
                  next[index] = value;
                  patch({ tokens: next });
                }}
                placeholder={`Token ${index + 1}`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={s.tokens.length <= 2}
              onClick={() =>
                patch({ tokens: s.tokens.filter((_, i) => i !== index) })
              }
            >
              Xóa
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => patch({ tokens: [...s.tokens, ""] })}
        >
          Thêm token
        </Button>
      </div>
    );
  }

  if (s.type === "essay_translation") {
    return (
      <div className="space-y-2">
        <Label>Rubric chấm (tiêu chí · điểm)</Label>
        {s.rubric.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              className="flex-1"
              value={row.criterion}
              placeholder={`Tiêu chí ${index + 1}`}
              onChange={(e) =>
                patch({
                  rubric: s.rubric.map((r, i) =>
                    i === index ? { ...r, criterion: e.target.value } : r,
                  ),
                })
              }
            />
            <Input
              type="number"
              min={0.25}
              step={0.25}
              className="w-24"
              value={row.points}
              onChange={(e) =>
                patch({
                  rubric: s.rubric.map((r, i) =>
                    i === index
                      ? { ...r, points: Number(e.target.value) || 0 }
                      : r,
                  ),
                })
              }
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={s.rubric.length <= 1}
              onClick={() =>
                patch({ rubric: s.rubric.filter((_, i) => i !== index) })
              }
            >
              Xóa
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            patch({ rubric: [...s.rubric, { criterion: "", points: 1 }] })
          }
        >
          Thêm tiêu chí
        </Button>
      </div>
    );
  }

  if (s.type === "speaking") {
    return (
      <p className="text-muted-foreground rounded-lg border p-3 text-sm">
        Học viên đọc đề rồi thu âm trả lời ngay trên web (không giới hạn thời
        lượng); giáo viên nghe và chấm tay.
      </p>
    );
  }

  return null;
}
