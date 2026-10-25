import type { ReactNode } from "react";

/**
 * 긴 설명을 제목만 보이게 접어 둔다. 본문은 HTML에 그대로 있어 검색엔진이 읽고, 누르면 펼쳐진다.
 * small은 차트 아래 작은 안내 문구용(제목 대신 작은 글씨 한 줄).
 */
export function Fold({ title, children, small, className }: { title: ReactNode; children: ReactNode; small?: boolean; className?: string }) {
  return (
    <details className={["fold", small && "fold-sm", className].filter(Boolean).join(" ")}>
      <summary>{small ? <span>{title}</span> : <h2 className="card-title">{title}</h2>}</summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
