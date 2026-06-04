"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Undo2 } from "lucide-react";
import { api } from "@/lib/api";

export default function TrashRowActions({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const restore = () => {
    setErr(null);
    startTransition(async () => {
      try {
        await api.restoreJob(jobId);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "복구 실패");
      }
    });
  };

  const hard = () => {
    if (
      !confirm(
        "이 작업을 영구 삭제합니다.\n원본 자기소개서·분석 결과·논문·평가가 모두 사라지며 복구 불가합니다. 계속할까요?",
      )
    )
      return;
    setErr(null);
    startTransition(async () => {
      try {
        await api.hardDeleteJob(jobId);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "영구삭제 실패");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={restore}
        disabled={pending}
        title="복구"
        aria-label="복구"
        className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--line-strong)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--bg-2)] transition disabled:opacity-50"
      >
        <Undo2 size={13} strokeWidth={1.7} />
        복구
      </button>
      <button
        type="button"
        onClick={hard}
        disabled={pending}
        title="영구 삭제"
        aria-label="영구 삭제"
        className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--line-strong)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink-muted)] hover:border-[var(--bad)] hover:text-[var(--bad)] hover:bg-[var(--bad)]/8 transition disabled:opacity-50"
      >
        <Trash2 size={13} strokeWidth={1.7} />
        영구삭제
      </button>
      {err && <span className="text-[11px] text-[var(--bad)] ml-2">{err}</span>}
    </div>
  );
}
