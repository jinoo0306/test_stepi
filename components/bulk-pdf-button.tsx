"use client";

import { useEffect, useRef, useState } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { API_BASE } from "@/lib/api";

type Status = {
  status: "running" | "ready" | "error";
  done: number;
  total: number;
  failed: string[];
  error: string | null;
};

const POLL_MS = 2000;

/**
 * 전체 지원자 PDF 를 ZIP 으로 받는다.
 *
 * 한 번의 요청으로 끝내지 않는 이유는 Cloudflare 원본 타임아웃(100초)이다. 지원자가
 * 수백 명이면 동기 요청은 반드시 끊긴다. 그래서 시작 → 진행률 폴링 → 내려받기로 나눈다.
 * 몇 명까지 끝났는지 보여줘야 담당자가 창을 닫지 않고 기다린다.
 */
export default function BulkPdfButton({ jobId }: { jobId: string }) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [state, setState] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/analysis-jobs/${encodeURIComponent(jobId)}/applicants-report/${taskId}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(await res.text());
        const next = (await res.json()) as Status;
        if (cancelled) return;
        setState(next);
        if (next.status === "running") {
          timerRef.current = setTimeout(poll, POLL_MS);
        } else if (next.status === "error") {
          setError(next.error ?? "생성에 실패했습니다.");
          setBusy(false);
        } else {
          setBusy(false);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    };
    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [taskId, jobId]);

  const start = async () => {
    setBusy(true);
    setError(null);
    setState(null);
    setTaskId(null);
    try {
      const res = await fetch(`/api/bulk-pdf/${encodeURIComponent(jobId)}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "요청에 실패했습니다.");
      setTaskId(body.task_id);
      setState({ status: "running", done: 0, total: body.total ?? 0, failed: [], error: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const zipUrl =
    taskId && state?.status === "ready"
      ? `${API_BASE}/analysis-jobs/${encodeURIComponent(jobId)}/applicants-report/${taskId}.zip`
      : null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {zipUrl ? (
        <a href={zipUrl} className="btn-ghost inline-flex items-center gap-2" download>
          <FileArchive size={13} /> ZIP 내려받기 ({state?.total}명)
        </a>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
          title="지원자별 PDF 를 모두 만들어 ZIP 으로 묶습니다"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <FileArchive size={13} />}
          {busy ? "만드는 중" : "전체 지원자 PDF"}
        </button>
      )}

      {busy && state && state.total > 0 && (
        <span className="text-[12px] text-[var(--ink-muted)] tabular-nums">
          {state.done} / {state.total}명
        </span>
      )}
      {state && state.status === "ready" && state.failed.length > 0 && (
        <span className="text-[12px] text-[var(--bad)]">
          {state.failed.length}명 실패 (나머지는 담겨 있습니다)
        </span>
      )}
      {error && <span className="text-[12px] text-[var(--bad)] max-w-[280px] text-right">{error}</span>}
    </div>
  );
}
