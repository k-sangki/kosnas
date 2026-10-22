/** 구조화 데이터(JSON-LD). '<' 를 이스케이프해 본문이 스크립트를 닫지 못하게 한다 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
