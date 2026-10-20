import { SiteFooter, SiteHeader } from "./SiteHeader";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@kosnas.com";

export function TextPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <SiteHeader />
      <article className="card seo-text doc">
        <h1>{title}</h1>
        {children}
      </article>
      <SiteFooter />
    </div>
  );
}
