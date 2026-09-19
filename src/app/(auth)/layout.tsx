import { Logo } from "@/components/shared/logo";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen max-h-screen w-full overflow-hidden bg-white">
      {/* Cột trái: Ảnh banner thiết kế sẵn (anhbentrai.png) vừa khít chiều cao màn hình */}
      <div className="relative hidden h-full w-1/2 overflow-hidden bg-slate-100 lg:block">
        <Image
          src="/anhbentrai.png"
          alt="POLYMIND - Cùng bạn kiến tạo tương lai"
          fill
          priority
          className="object-cover object-center"
          sizes="50vw"
        />
      </div>

      {/* Cột phải: Nền xám xanh nhẹ để làm nổi bật khung viền trắng của form */}
      <div className="relative flex h-full w-full flex-col justify-between overflow-y-auto bg-[#f4f7fb] px-4 py-4 sm:px-8 sm:py-6 lg:w-1/2 lg:overflow-hidden xl:px-16">
        {/* Thanh trên cùng: Chỉ hiện Logo trên mobile */}
        <div className="flex shrink-0 items-center justify-center pt-2 lg:hidden">
          <Logo height={32} variant="bare" />
        </div>
        <div className="hidden h-2 shrink-0 lg:block" />

        {/* Khối giữa: Form nằm giữa không gian màn hình */}
        <div className="my-auto flex w-full max-w-[440px] shrink-0 flex-col justify-center self-center py-2">
          <main className="w-full">{children}</main>
        </div>

        {/* Chân trang dưới cùng */}
        <footer className="shrink-0 py-1 text-center text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} Bản quyền thuộc về POLYMIND · Đồng Hành
            Cùng Bạn Vươn Xa
          </p>
        </footer>
      </div>
    </div>
  );
}
