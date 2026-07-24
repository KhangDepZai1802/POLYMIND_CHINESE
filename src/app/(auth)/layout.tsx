import { SiteFooter } from "@/components/layout/site-footer";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="from-brand-navy to-primary flex min-h-screen flex-col items-center justify-center bg-gradient-to-br p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        {/* Nền gradient tối nên phải dùng `plate`: file logo có nền trắng đặc,
            đặt trần lên gradient sẽ ra một mảng trắng lởm chởm. `alt=""` vì
            tên thương hiệu đã nằm ngay dưới dạng chữ đọc được. */}
        <Logo
          height={52}
          variant="plate"
          alt=""
          radius="rounded-2xl"
          priority
          className="mb-4"
        />
        {/* Cố ý là <p> chứ không phải <h1>.
         *
         * Bản cũ đặt <h1>POLYMIND CHINESE</h1> ở layout, nên đo được: cả 4 màn
         * auth có ĐÚNG MỘT heading và cả 4 mang cùng một chữ. Người dùng trình
         * đọc màn hình điều hướng bằng danh sách heading sẽ nghe y hệt nhau ở
         * /login, /forgot-password, /reset-password và /accept-invite — không
         * có cách nào biết mình đang ở màn nào. Tên màn thật ("Đăng nhập"…)
         * lại là <div> vì `CardTitle` mặc định là <div>.
         *
         * Nay <h1> chuyển xuống chính tiêu đề card của từng trang; khối này giữ
         * nguyên hình thức, chỉ đổi thẻ. */}
        <p className="text-2xl font-bold tracking-tight text-white">
          POLYMIND CHINESE
        </p>
        <p className="text-sm text-white/70">Quản lý học viên tiếng Trung</p>
      </div>

      {/* Bản cũ không có landmark nào bọc form: đo được `main: 0` ở cả 4 màn,
          và thẻ <form> nằm ngoài mọi landmark. Khu đã đăng nhập
          (`(dashboard)/layout.tsx`) thì có <main> — auth bị bỏ sót. */}
      <main className="w-full max-w-md">{children}</main>

      <SiteFooter variant="onDark" className="mt-8" />
    </div>
  );
}
