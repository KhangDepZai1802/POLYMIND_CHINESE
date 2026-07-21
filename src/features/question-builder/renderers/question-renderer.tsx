"use client";

import type { QuestionType } from "@/features/question-builder/domain/questions";
import { SpeakingRecorder } from "@/features/question-builder/renderers/speaking-recorder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { option_key: string; content: string };

export function QuestionRenderer({
  type,
  prompt,
  options = [],
  value,
  onChange,
  disabled = false,
  promptContent = {},
}: {
  type: QuestionType;
  prompt: string;
  options?: Option[];
  value?: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  promptContent?: Record<string, unknown>;
}) {
  const selected =
    typeof value === "object" && value && "value" in value
      ? String((value as { value: unknown }).value ?? "")
      : "";
  const selectedMany =
    typeof value === "object" &&
    value &&
    "values" in value &&
    Array.isArray((value as { values: unknown[] }).values)
      ? (value as { values: string[] }).values
      : [];

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="text-base font-medium whitespace-pre-wrap">
        {prompt}
      </legend>
      {type === "reading_group" &&
        typeof promptContent.passage === "string" && (
          <div className="bg-muted/40 rounded-lg border p-4 whitespace-pre-wrap">
            {promptContent.passage}
          </div>
        )}
      {type === "reading_group" && (
        <Input
          value={selected}
          onChange={(event) => onChange?.({ value: event.target.value })}
          onCompositionEnd={(event) =>
            onChange?.({ value: event.currentTarget.value })
          }
          placeholder="Nhập câu trả lời cho bài đọc…"
        />
      )}
      {["listening_choice", "dictation"].includes(type) &&
        typeof promptContent.audio_url === "string" && (
          <audio controls preload="metadata" className="w-full">
            <source src={promptContent.audio_url} />
          </audio>
        )}
      {["single_choice", "listening_choice", "true_false"].includes(type) && (
        <div className="space-y-2">
          {(type === "true_false"
            ? [
                { option_key: "true", content: "Đúng" },
                { option_key: "false", content: "Sai" },
              ]
            : options
          ).map((option) => (
            <Label
              key={option.option_key}
              className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3"
            >
              <input
                type="radio"
                name={`q-${prompt.slice(0, 12)}`}
                checked={selected === option.option_key}
                onChange={() => onChange?.({ value: option.option_key })}
              />
              <span>{option.content}</span>
            </Label>
          ))}
        </div>
      )}
      {type === "multiple_choice" && (
        <div className="space-y-2">
          {options.map((option) => (
            <Label
              key={option.option_key}
              className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3"
            >
              <input
                type="checkbox"
                checked={selectedMany.includes(option.option_key)}
                onChange={(event) =>
                  onChange?.({
                    values: event.target.checked
                      ? [...selectedMany, option.option_key]
                      : selectedMany.filter((key) => key !== option.option_key),
                  })
                }
              />
              <span>{option.content}</span>
            </Label>
          ))}
        </div>
      )}
      {["fill_blank", "short_text", "dictation"].includes(type) && (
        <Input
          value={selected}
          onChange={(event) => onChange?.({ value: event.target.value })}
          onCompositionEnd={(event) =>
            onChange?.({ value: event.currentTarget.value })
          }
          placeholder="Nhập câu trả lời…"
        />
      )}
      {type === "ordering" && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Nhập thứ tự các token, cách nhau bằng dấu phẩy. Trên mobile có thể
            dùng bàn phím thay cho kéo thả.
          </p>
          <Input
            value={selected}
            onChange={(event) =>
              onChange?.({
                value: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder={options.map((option) => option.content).join(", ")}
          />
        </div>
      )}
      {type === "matching" && (
        <Textarea
          value={selected}
          onChange={(event) => onChange?.({ value: event.target.value })}
          placeholder="Mỗi dòng: vế trái = vế phải"
          rows={5}
        />
      )}
      {type === "speaking" && <SpeakingRecorder disabled />}
      {type === "essay_translation" && (
        <Textarea
          value={selected}
          onChange={(event) => onChange?.({ value: event.target.value })}
          onCompositionEnd={(event) =>
            onChange?.({ value: event.currentTarget.value })
          }
          rows={8}
          placeholder="Nhập bài tự luận hoặc bản dịch…"
        />
      )}
    </fieldset>
  );
}
