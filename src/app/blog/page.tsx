import type { Metadata } from "next";
import {
  MarketingHero,
  MarketingPage,
} from "@/components/marketing/marketing-site";
export const metadata: Metadata = {
  title: "Blog",
  robots: { index: false, follow: true },
};
export default function BlogPage() {
  return (
    <MarketingPage>
      <MarketingHero
        eyebrow="SY Blog"
        title="Góc chia sẻ đang được hoàn thiện"
        description="Bài viết và tài liệu học tiếng Trung sẽ được POLYMIND bổ sung sau."
      />
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-[#65758a] sm:px-6 lg:px-8">
        Chưa có bài viết được công bố.
      </div>
    </MarketingPage>
  );
}
