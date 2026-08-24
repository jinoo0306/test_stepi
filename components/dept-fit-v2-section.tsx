"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, type DeptFitResponse } from "@/lib/api";
import DeptFitList from "@/components/dept-fit-list";

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

  return (
    <DeptFitList
      items={data.items}
      computedAt={data.computed_at}
      action={
        <button
          onClick={onRecompute}
          disabled={enqueuing}
          data-print-hide
          className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center gap-1"
          title="강제 재계산"
        >
          {enqueuing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          재계산
        </button>
      }
    />
  );
}
