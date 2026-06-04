"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, type DeptFitResponse } from "@/lib/api";
import { cleanReason } from "@/lib/clean-reason";

export default function DeptFitV2Section({
  jobId,
  applicantId,
}: {
  jobId: string;
  applicantId: string;
}) {
  const [data, setData] = useState<DeptFitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [enqueuing, setEnqueuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getDeptFit(jobId, applicantId);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [jobId, applicantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onRecompute = async () => {
    setEnqueuing(true);
    try {
      await api.recomputeDeptFit(jobId, applicantId);
      // 5초 후 1회 폴링
      setTimeout(refresh, 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnqueuing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-[13px] text-[var(--ink-muted)] flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> 직군 적합도 로딩…
      </div>
    );
  }

  if (data?.skipped) {
    return (
      <p className="text-[13px] text-[var(--ink-muted)] italic">
        {data.skipped_reason ?? "행정직은 직군 적합도 산출 대상이 아닙니다."}
      </p>
    );
  }

  if (error) {
    return <p className="text-[12px] text-red-600">{error}</p>;
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-[13px] text-[var(--ink-muted)]">
          아직 채점 결과가 없습니다. 자기소개서 + 분석된 논문이 모두 준비되면 자동 산출됩니다.
        </p>
        <button
          onClick={onRecompute}
          disabled={enqueuing}
          className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center gap-1"
        >
          {enqueuing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          수동 재계산
        </button>
      </div>
    );
  }

  const max = Math.max(...data.items.map((d) => d.score), 100);
  const sorted = [...data.items].sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-[var(--ink-muted)]">
          자기소개서와 논문 분석을 종합한 7개 연구부서별 적합도입니다.{" "}
          {data.computed_at && (
            <>
              <span className="mx-1">·</span>
              {new Date(data.computed_at).toLocaleString("ko-KR")}
            </>
          )}
        </p>
        <button
          onClick={onRecompute}
          disabled={enqueuing}
          className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center gap-1"
          title="강제 재계산"
        >
          {enqueuing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          재계산
        </button>
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
