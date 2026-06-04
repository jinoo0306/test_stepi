"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  jobId: string;
  applicantId: string;
}

export default function ApplicantDeleteButton({ jobId, applicantId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const click = async (e: MouseEvent) => {
    // Job 목록 row 가 Link 라 row 클릭 시 페이지 이동되니 여기서 막음.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (
      !confirm(
        `지원자 ${applicantId} 의 모든 데이터 (자기소개서·논문·점수·피드백) 가 영구 삭제됩니다. 계속할까요?`,
      )
    )
      return;
    setBusy(true);
    try {
      await api.deleteApplicant(jobId, applicantId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
      setBusy(false);
    }
  };

  return (
    <button
      onClick={click}
      disabled={busy}
      title="지원자 영구 삭제"
      aria-label="지원자 삭제"
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition ${
        busy
          ? "text-[var(--ink-soft)] cursor-not-allowed"
          : "text-[var(--ink-muted)] hover:text-[var(--bad)] hover:bg-[var(--bad)]/8"
      }`}
    >
      <Trash2 size={14} strokeWidth={1.6} />
    </button>
  );
}
