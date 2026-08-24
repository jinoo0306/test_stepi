import { AlertTriangle } from "lucide-react";
import { AI_USAGE_MOCK, aiUsageLevel, type AiUsageMetric } from "@/lib/ai-usage";

/**
 * AI 사용 의심도 근거 — 헤더 통계줄의 숫자 하나를 풀어서 설명한다.
 *
 * 이 화면에 이미 있는 관계를 그대로 따랐다:
 *   헤더 「직무적합 평균 76/100」  →  본문 「직무적합 역량별 근거」 카드
 *   헤더 「AI 사용 의심도 80%」    →  본문 이 카드
 *
 * 두 축으로 설명한다. 종합 점수 하나만으로는 면접관이 판단할 근거가 없다.
 *   ① 문항별  — 어느 문항이 점수를 끌어올렸나
 *   ② 지표별  — 무엇을 보고 그렇게 판단했나
 *
 * 서버 컴포넌트다. 상태가 필요 없고 데이터는 lib/ai-usage.ts 의 상수다.
 * (막대 애니메이션은 CSS keyframes 라 클라이언트 전환이 필요 없다 — timeline-bar.tsx 와 같다)
 */

const { overall, questions, metrics } = AI_USAGE_MOCK;

export default function AiUsageSection() {
  const level = aiUsageLevel(overall);
  // 점수를 끌어올린 문항을 짚어준다. 여러 개면 가장 높은 하나.
  // 실데이터가 들어오면 빈 배열이 올 수 있으므로 reduce 의 초기값에 기대지 않는다.
  const top = questions.length > 0 ? questions.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  return (
    <div>
      <style>{`
        @keyframes stepi-ai-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stepi-ai-grow { animation: none !important; }
        }
      `}</style>

      {/* 이 카드 전체가 예시라는 사실을 숫자보다 먼저 읽히게 맨 위에 둔다 */}
      <p className="mb-4 text-[14px] leading-[1.7] text-[var(--ink-2)]">
        <b className="font-bold text-[var(--ink)]">이 카드의 숫자는 모두 예시입니다.</b> 아직 채점이
        연결되지 않아 모든 지원자에게 같은 값이 나옵니다.
      </p>

      {/* ── 종합 ── */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="serif text-[40px] leading-none tabular-nums text-[var(--ink)]">
          {overall}
          <span className="ml-1 text-[18px] text-[var(--ink-muted)]">%</span>
        </span>
        <span
          className={`rounded-full border px-2.5 py-[3px] text-[12px] font-medium ${
            level.tone === "high"
              ? "border-[var(--bad)] text-[var(--bad)]"
              : level.tone === "mid"
                ? "border-[var(--gold-2)] text-[var(--gold-2)]"
                : "border-[var(--line-strong)] text-[var(--ink-muted)]"
          }`}
        >
          {level.text}
        </span>
      </div>
      {top && (
        <p className="mt-2.5 text-[14px] leading-[1.7] text-[var(--ink-2)]">
          {questions.length}개 문항 중{" "}
          <b className="font-semibold">{top.no}번 「{top.title}」</b>의 점수가 {top.score}% 로 가장
          높습니다.
        </p>
      )}

      {/* ── 문항별 ── */}
      <Block title="문항별 점수" desc="문항마다 따로 계산합니다.">
        <ul className="space-y-3.5">
          {questions.map((q, i) => (
            <li key={q.no}>
              <Row
                label={`${q.no}. ${q.title}`}
                score={q.score}
                index={i}
                highlight={q.no === top?.no}
              />
            </li>
          ))}
        </ul>
      </Block>

      {/* ── 지표별 ── */}
      <Block
        title="판단 근거"
        desc="종합 점수만으로는 판단할 수 없어, 사람이 확인할 수 있는 지표를 함께 냅니다."
      >
        <ul className="space-y-4">
          {metrics.map((m: AiUsageMetric, i) => (
            <li key={m.label}>
              <Row label={m.label} score={m.score} index={i} />
              <p className="mt-1.5 ml-[0.5px] text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">
                {m.hint}
              </p>
            </li>
          ))}
        </ul>
      </Block>

      {/* ── 해석 주의 ── */}
      <div className="mt-7 flex gap-2.5 rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-3.5 py-3">
        <AlertTriangle size={15} className="mt-[2px] shrink-0 text-[var(--gold-2)]" />
        <p className="text-[12.5px] leading-[1.7] text-[var(--ink-2)]">
          <b className="font-semibold">확정 판정이 아닙니다.</b> AI 탐지는 격식 있는 문체나
          정형화된 자기소개서에서 실제 본인이 쓴 글을 높게 잡는 경우가 있습니다. 이 점수만으로
          불이익을 주지 마시고, 면접에서 내용을 직접 확인하는 근거로만 사용해 주세요.
        </p>
      </div>
    </div>
  );
}

/** 소제목 + 설명을 가진 구역. talent-types-section.tsx 의 Block 과 같은 어휘. */
function Block({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h3 className="text-[15px] font-bold text-[var(--ink)]">{title}</h3>
      <p className="mt-1 mb-4 text-[12.5px] text-[var(--ink-muted)]">{desc}</p>
      {children}
    </section>
  );
}

/**
 * 한 줄 = 이름 · 점수 · 막대.
 * 막대 어휘는 dept-bar.tsx / talent-types-section.tsx 와 맞췄다 (트랙 h-1.5).
 */
function Row({
  label,
  score,
  index,
  highlight,
}: {
  label: string;
  score: number;
  index: number;
  highlight?: boolean;
}) {
  const delay = Math.min(index * 60, 360);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span
          className={`truncate text-sm ${
            highlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
          }`}
        >
          {label}
        </span>
        <span className="serif text-sm tabular-nums text-[var(--ink-muted)] shrink-0">
          {score}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--bg-2)] overflow-hidden">
        <div
          className="stepi-ai-grow h-full rounded-full"
          style={{
            // 실데이터가 0-1 스케일이나 100 초과로 오면 레이아웃이 깨진다
            width: `${Math.max(0, Math.min(100, score))}%`,
            // 높은 점수만 눈에 띄게 한다 — 전부 강한 색이면 어디를 봐야 할지 알 수 없다
            background:
              score >= 75
                ? "linear-gradient(90deg, var(--gold), var(--gold-2))"
                : "var(--line-strong)",
            transformOrigin: "left center",
            animation: "stepi-ai-grow 0.9s cubic-bezier(0.22,0.68,0.28,1) both",
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}
