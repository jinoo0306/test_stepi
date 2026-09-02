import { AI_USAGE_PLAN, type AiUsageAxis, type AiUsageItem } from "@/lib/ai-usage";

/**
 * AI 사용 의심도 근거 — 지금은 만들 지표의 이름표만 보여준다.
 *
 * 점수·막대·근거 문장을 일부러 넣지 않았다. 실제로 채택된 지표가 하나뿐이라
 * 숫자를 채우면 다 된 것처럼 보인다. 지표가 나온 뒤에 표시 방식을 정한다.
 *
 * 서버 컴포넌트다. 상태가 필요 없다.
 */

const { formula, axes, caveat } = AI_USAGE_PLAN;

export default function AiUsageSection() {
  return (
    <div>
      <p className="serif text-[17px] leading-[1.6] tabular-nums text-[var(--ink)]">{formula}</p>
      <p className="mt-2 text-[13px] leading-[1.7] text-[var(--ink-muted)]">
        아직 만드는 중입니다. 채택된 지표가 하나뿐이라 점수를 내지 않습니다.
      </p>

      <div className="mt-7 space-y-7">
        {axes.map((axis) => (
          <AxisBlock key={axis.label} axis={axis} />
        ))}
      </div>

      <p className="mt-7 rounded-md border border-[var(--line-strong)] bg-[var(--bg-2)] px-3.5 py-3 text-[12.5px] leading-[1.7] text-[var(--ink-2)]">
        {caveat}
      </p>
    </div>
  );
}

function AxisBlock({ axis }: { axis: AiUsageAxis }) {
  const done = axis.items.filter((i) => i.status === "done").length;
  const total = axis.items.filter((i) => i.status !== "dropped").length;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-bold text-[var(--ink)]">{axis.label}</h3>
        <span className="serif text-[13px] tabular-nums text-[var(--ink-muted)] shrink-0">
          {done} / {total} 지표
        </span>
      </div>
      <p className="mt-1 mb-4 text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">{axis.note}</p>

      <ul className="space-y-3">
        {axis.items.map((item) => (
          <ItemRow key={item.label} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ item }: { item: AiUsageItem }) {
  const dropped = item.status === "dropped";
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-baseline">
      <StatusTag status={item.status} />
      <div className="min-w-0">
        <span
          className={`text-sm ${
            dropped ? "text-[var(--ink-muted)] line-through" : "text-[var(--ink)]"
          }`}
        >
          {item.label}
        </span>
        <p className="mt-0.5 text-[12.5px] leading-[1.6] text-[var(--ink-muted)]">{item.note}</p>
      </div>
    </li>
  );
}

/** 어디까지 왔는지 한눈에. 색으로 구분하되 글자로도 읽히게 한다 */
function StatusTag({ status }: { status: AiUsageItem["status"] }) {
  const style =
    status === "done"
      ? "border-[var(--gold-2)] text-[var(--gold-2)]"
      : status === "dropped"
        ? "border-[var(--line)] text-[var(--ink-soft)]"
        : "border-[var(--line-strong)] text-[var(--ink-muted)]";
  const text = status === "done" ? "채택" : status === "dropped" ? "제외" : "예정";

  return (
    <span
      className={`mt-[1px] rounded-full border px-2 py-[2px] text-[11px] font-medium whitespace-nowrap ${style}`}
    >
      {text}
    </span>
  );
}
