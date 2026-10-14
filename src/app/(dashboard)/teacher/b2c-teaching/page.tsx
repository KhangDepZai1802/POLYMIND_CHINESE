import type { Metadata } from "next";
import { B2CTeachingPage } from "@/features/b2c/components/teaching-page";
export const metadata: Metadata = { title: "Chấm công B2C" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <B2CTeachingPage params={await searchParams} mine={true} />;
}
