import { BookOpen, Languages, Palette, UserRound, UsersRound } from "lucide-react";

export const B2C_PROGRAMS = [
  {
    slug: "tieng-anh",
    title: "Tiếng Anh",
    description: "Các lớp tiếng Anh dành cho học viên đăng ký trực tiếp tại trung tâm.",
    icon: Languages,
    iconClassName: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  },
  {
    slug: "tieng-trung",
    title: "Tiếng Trung",
    description: "Các lớp tiếng Trung B2C, tách biệt với chương trình doanh nghiệp VCB.",
    icon: BookOpen,
    iconClassName: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  },
  {
    slug: "tieng-viet",
    title: "Tiếng Việt",
    description: "Các lớp tiếng Việt theo danh sách học viên lẻ của trung tâm.",
    icon: UsersRound,
    iconClassName: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  {
    slug: "lop-ve",
    title: "Lớp Vẽ",
    description: "Nhóm lớp mỹ thuật và vẽ dành cho học viên lẻ.",
    icon: Palette,
    iconClassName: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  },
  {
    slug: "kem-1-1",
    title: "Kèm 1-1",
    description: "Các lớp cá nhân với lịch học và lộ trình riêng cho từng học viên.",
    icon: UserRound,
    iconClassName: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
] as const;

export type B2CProgram = (typeof B2C_PROGRAMS)[number];

export function getB2CProgram(slug: string): B2CProgram | undefined {
  return B2C_PROGRAMS.find((program) => program.slug === slug);
}
