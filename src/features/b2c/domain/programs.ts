import { BookOpen, Languages, Palette, UserRound, UsersRound } from "lucide-react";

export const B2C_PROGRAMS = [
  {
    slug: "tieng-anh",
    title: "Tiếng Anh",
    description: "Các lớp tiếng Anh dành cho học viên đăng ký trực tiếp tại trung tâm.",
    icon: Languages,
  },
  {
    slug: "tieng-trung",
    title: "Tiếng Trung",
    description: "Các lớp tiếng Trung B2C, tách biệt với chương trình doanh nghiệp VCB.",
    icon: BookOpen,
  },
  {
    slug: "tieng-viet",
    title: "Tiếng Việt",
    description: "Các lớp tiếng Việt theo danh sách học viên lẻ của trung tâm.",
    icon: UsersRound,
  },
  {
    slug: "lop-ve",
    title: "Lớp Vẽ",
    description: "Nhóm lớp mỹ thuật và vẽ dành cho học viên lẻ.",
    icon: Palette,
  },
  {
    slug: "kem-1-1",
    title: "Kèm 1-1",
    description: "Các lớp cá nhân với lịch học và lộ trình riêng cho từng học viên.",
    icon: UserRound,
  },
] as const;

export type B2CProgram = (typeof B2C_PROGRAMS)[number];

export function getB2CProgram(slug: string): B2CProgram | undefined {
  return B2C_PROGRAMS.find((program) => program.slug === slug);
}
