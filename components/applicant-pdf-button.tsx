"use client";

import { FileText } from "lucide-react";

/**
 * 지원자 1명 PDF 저장 — 인쇄 화면을 새 탭에서 열고 바로 인쇄 대화상자를 띄운다.
 * 명부의 행 전체가 링크라 여기서 클릭이 위로 번지지 않게 막는다.
 */
export default function ApplicantPdfButton({
  jobId,
  applicantId,
  variant = "icon",
}: {
  jobId: string;
  applicantId: string;
  variant?: "icon" | "button";
}) {
  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      `/jobs/${jobId}/applicants/${encodeURIComponent(applicantId)}/print?auto=1`,
      "_blank",
      "noopener",
    );
  };

  if (variant === "button") {
    return (
      <button type="button" onClick={open} className="btn-ghost inline-flex items-center gap-2">
        <FileText size={13} /> PDF
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      title="이 지원자만 PDF 로 저장"
      className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition p-0.5"
    >
      <FileText size={13} />
    </button>
  );
}
