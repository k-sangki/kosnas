import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { SITE_URL } from "@/app/layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { GUIDES, findGuide } from "@/lib/guides";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guide/[slug]">): Promise<Metadata> {
  const g = findGuide((await params).slug);
  return g ? pageMeta({ title: g.title, description: g.description, path: `/guide/${g.slug}` }) : {};
}

export default async function GuidePage({ params }: PageProps<"/guide/[slug]">) {
  const g = findGuide((await params).slug);
  if (!g) notFound();
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  return (
    <div className="shell">
      <SiteHeader active="guide" />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [["가이드", "/guide"], [g.title, `/guide/${g.slug}`]])} />
        <Link href="/guide" className="back">
          ← 가이드
        </Link>
        <article className="card seo-text doc">
          <h1>{g.title}</h1>
          {g.body}
        </article>
        <AdSlot slot={AD_SLOTS.sector} />
        <section className="card">
          <h2 className="card-title">다른 가이드</h2>
          <ul className="guide-links">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/guide/${o.slug}`}>{o.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
