import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketPage } from "@/components/MarketPage";

// 국내는 첫 화면(/)이 맡고, 여기서는 미국만 만든다
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ market: "us" }];
}

export const metadata: Metadata = {
  title: "미국 증시 섹터 흐름",
  description: "나스닥·S&P 섹터의 강도와 흐름을 한눈에.",
  alternates: { canonical: "/us" },
};

export default async function UsPage({ params }: PageProps<"/[market]">) {
  const { market } = await params;
  if (market !== "us") notFound();
  return <MarketPage market="us" />;
}
