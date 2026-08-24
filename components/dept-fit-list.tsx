import type { DeptFitItem } from "@/lib/api";
import { cleanReason } from "@/lib/clean-reason";

/** 직군 적합도 순위 목록 — 화면(dept-fit-v2-section)과 인쇄 화면이 같이 쓴다 */
export default function DeptFitList({
  items,
  computedAt,
  action,
}: {
  items: DeptFitItem[];
  computedAt?: string | null;
  action?: React.ReactNode;
}) {
  const max = Math.max(...items.map((d) => d.score), 100);
  const sorted = [...items].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-[var(--ink-muted)]">
          자기소개서와 논문 분석을 종합한 7개 연구부서별 적합도입니다.{" "}
          {computedAt && (
            <>
              <span className="mx-1">·</span>
              {new Date(computedAt).toLocaleString("ko-KR")}
            </>
          )}
        </p>
        {action}
      </div>

      <ol className="border-t-2 border-[var(--line-strong)]">
        {sorted.map((d, i) => {
          const pct = (d.score / max) * 100;
          return (
            <li
              key={d.dept_name}
              className="grid grid-cols-12 gap-x-4 gap-y-2 py-4 border-b border-[var(--line)]"
            >
              <div className="col-span-1 text-[13px] font-medium text-[var(--ink-muted)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-11 lg:col-span-4 text-[15px] font-medium self-center">{d.dept_name}</div>
              <div className="col-span-9 lg:col-span-5 self-center">
                <div className="h-2 w-full rounded-full bg-[var(--bg-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, var(--gold), var(--gold-2))",
                    }}
                  />
                </div>
              </div>
              <div className="col-span-3 lg:col-span-2 text-right serif text-[20px] tabular-nums">
                {d.score.toFixed(0)}
              </div>
              {d.reason && (
                <p className="col-span-12 lg:col-start-3 lg:col-span-10 text-[13px] leading-[1.7] text-[var(--ink-muted)]">
                  {cleanReason(d.reason)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
