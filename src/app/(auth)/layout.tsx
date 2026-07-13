import { Logo } from "@/components/shared/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="from-brand-navy to-primary flex min-h-screen flex-col items-center justify-center bg-gradient-to-br p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={72} radius="rounded-2xl" priority className="mb-4" />
        <h1 className="text-2xl font-bold tracking-tight text-white">
          POLYMIND CHINESE
        </h1>
        <p className="text-sm text-white/70">Quản lý học viên tiếng Trung</p>
      </div>

      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
