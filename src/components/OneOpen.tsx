"use client";

import { useEffect } from "react";

/**
 * 같은 name의 <details>는 하나만 펼쳐 둔다. 새 브라우저는 name 속성만으로 그렇게 하고,
 * 이를 모르는 옛 브라우저(iOS 17.1 이하 등)를 위해 다른 것을 직접 접는다.
 */
export function OneOpen({ name }: { name: string }) {
  useEffect(() => {
    const onToggle = (e: Event) => {
      const t = e.target as HTMLDetailsElement;
      if (t.tagName !== "DETAILS" || t.getAttribute("name") !== name || !t.open) return;
      document.querySelectorAll<HTMLDetailsElement>(`details[name="${name}"][open]`).forEach((d) => {
        if (d !== t) d.open = false;
      });
    };
    document.addEventListener("toggle", onToggle, true);
    return () => document.removeEventListener("toggle", onToggle, true);
  }, [name]);
  return null;
}
