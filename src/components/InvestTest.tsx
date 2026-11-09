"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUESTIONS, resultPath } from "@/lib/invest-test";

/** 투자 성향 테스트 문항 화면. 한 문항씩 보이고, 고르면 바로 다음으로. 끝나면 결과 주소로 간다 */
export function InvestTest() {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const i = answers.length;

  if (!started) {
    return (
      <section className="card it-intro">
        <p className="it-emojis" aria-hidden>
          🐢🚀🐻🌊⚖️🦉🎯🦈
        </p>
        <h1 className="it-title">나는 어떤 투자 대가와 닮았을까?</h1>
        <p className="muted">
          12문항에 답하면 버핏·캐시 우드 등 대가 8명 중 가장 닮은 사람과 닮은
          정도를 %로 보여 줘요.
        </p>
        <button
          type="button"
          className="it-start"
          onClick={() => setStarted(true)}
        >
          테스트 시작
        </button>
      </section>
    );
  }

  const q = QUESTIONS[i];
  const pick = (a: number) => {
    const next = [...answers, a];
    if (next.length < QUESTIONS.length) return setAnswers(next);
    router.push(resultPath(next));
  };

  return (
    <section className="card it-q" aria-live="polite">
      <div className="it-progress" aria-hidden>
        <i style={{ width: `${(i / QUESTIONS.length) * 100}%` }} />
      </div>
      <p className="muted it-step">
        {i + 1} / {QUESTIONS.length}
      </p>
      <h1 className="it-question">{q?.q ?? "결과를 계산하고 있어요"}</h1>
      {q && (
        <div className="it-options">
          {q.options.map((o, k) => (
            <button
              key={k}
              type="button"
              className="it-option"
              onClick={() => pick(k)}
            >
              {o.text}
            </button>
          ))}
        </div>
      )}
      {i > 0 && q && (
        <button
          type="button"
          className="it-back"
          onClick={() => setAnswers(answers.slice(0, -1))}
        >
          ‹ 이전 문항
        </button>
      )}
    </section>
  );
}
