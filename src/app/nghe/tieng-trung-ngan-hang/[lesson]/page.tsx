import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ListeningShell } from "@/features/listening/components/listening-shell";
import lessons from "@/features/listening/bank-lessons.json";

type Props = { params: Promise<{ lesson: string }> };
function findLesson(slug: string) {
  return lessons.find((lesson) => `bai-${lesson.number}` === slug);
}
export function generateStaticParams() {
  return lessons.map((lesson) => ({ lesson: `bai-${lesson.number}` }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lesson = findLesson((await params).lesson);
  return {
    title: lesson
      ? `Bài ${lesson.number} · ${lesson.title}`
      : "Không tìm thấy bài học",
    robots: { index: false, follow: false },
  };
}

export default async function BankLessonPage({ params }: Props) {
  const lesson = findLesson((await params).lesson);
  if (!lesson) notFound();
  return (
    <ListeningShell
      classNameLabel="Tiếng Trung ngân hàng"
      lesson={`MSUTONG · Bài ${lesson.number}`}
    >
      <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/nghe/tieng-trung-ngan-hang"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#1a5fa8]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Tất cả bài học của lớp
        </Link>
        <header className="my-5 rounded-2xl bg-[#0d3f78] p-6 text-white sm:p-8">
          <p className="mb-3 text-sm font-semibold text-[#91bbe8]">
            Bài {lesson.number} · MSUTONG sơ cấp · Quyển 1
          </p>
          <h1 className="text-2xl leading-relaxed font-bold sm:text-3xl">
            {lesson.title}
          </h1>
        </header>
        <nav
          aria-label="Các phần trong bài"
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            ["tu-vung", "Từ vựng"],
            ["ngu-phap", "Ngữ pháp"],
            ["bai-khoa-1", "Bài khóa 1"],
            ["bai-khoa-2", "Bài khóa 2"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-xl border border-[#c3dbf4] bg-white px-4 py-3 text-center text-sm font-semibold text-[#0d3f78] transition hover:bg-blue-50"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="rounded-2xl border border-[#c3dbf4] bg-white p-4 sm:p-8">
          {lesson.blocks.map((block, index) => {
            if (block.type === "table" && block.rows)
              return (
                <div
                  key={index}
                  className="my-6 overflow-x-auto rounded-xl border border-emerald-200"
                  role="region"
                  aria-label={`Bảng từ vựng bài ${lesson.number}`}
                  tabIndex={0}
                >
                  <table className="w-full min-w-190 border-collapse text-sm">
                    <caption className="sr-only">
                      Từ vựng bài {lesson.number}
                    </caption>
                    <thead className="bg-emerald-800 text-white">
                      <tr>
                        {block.rows[0]?.map((cell, i) => (
                          <th
                            key={i}
                            scope="col"
                            className="px-4 py-3 text-left font-semibold"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.slice(1).map((row, i) => (
                        <tr
                          key={i}
                          className="border-t border-emerald-100 odd:bg-emerald-50/40"
                        >
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className={`px-4 py-3 leading-7 whitespace-pre-line ${j === 1 ? "text-xl font-semibold text-emerald-900" : ""}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            const text = block.text ?? "";
            if (/^(I|II|III)\./.test(text))
              return (
                <h2
                  key={index}
                  id={
                    text.startsWith("III.")
                      ? "bai-khoa"
                      : text.startsWith("II.")
                        ? "ngu-phap"
                        : "tu-vung"
                  }
                  className="mt-8 mb-4 scroll-mt-24 rounded-xl bg-blue-50 px-4 py-3 text-xl font-bold text-[#0d3f78]"
                >
                  {text.startsWith("III.")
                    ? "Bài khóa"
                    : text.startsWith("II.")
                      ? "Ngữ pháp"
                      : "Từ vựng"}
                </h2>
              );
            if (/^Bài khóa \d/.test(text))
              return (
                <h3
                  key={index}
                  id={`bai-khoa-${text.match(/\d+/)?.[0]}`}
                  className="mt-6 mb-3 scroll-mt-24 border-b border-[#dde5ee] pb-3 text-lg font-bold text-[#0d3f78]"
                >
                  {text}
                </h3>
              );
            const chinese = /[\u3400-\u9fff]/.test(text);
            return (
              <p
                key={index}
                className={`my-2 leading-8 whitespace-pre-line ${chinese ? "text-lg text-[#10243f]" : "text-base text-[#5b6b80]"}`}
              >
                {text}
              </p>
            );
          })}
        </div>
        <nav aria-label="Chuyển bài học" className="mt-6 flex flex-wrap gap-3">
          {lessons.map((item) => (
            <Link
              key={item.number}
              href={`/nghe/tieng-trung-ngan-hang/bai-${item.number}`}
              aria-current={item.number === lesson.number ? "page" : undefined}
              className={`rounded-full border px-5 py-3 text-sm font-semibold ${item.number === lesson.number ? "border-[#0d3f78] bg-[#0d3f78] text-white" : "border-[#c3dbf4] bg-white text-[#0d3f78]"}`}
            >
              Bài {item.number}
            </Link>
          ))}
        </nav>
      </article>
    </ListeningShell>
  );
}
