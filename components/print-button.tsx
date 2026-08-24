"use client";

import { Printer } from "lucide-react";

/** 인쇄 대화상자를 여는 버튼. 저장 위치·파일명은 브라우저가 묻는다 */
export default function PrintButton({ label = "인쇄 · PDF 저장" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-ghost inline-flex items-center gap-2"
    >
      <Printer size={13} /> {label}
    </button>
  );
}
