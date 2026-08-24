import PaperCard from "@/components/paper-card";
import type { PaperDetail, PaperFile } from "@/lib/api";

/** 인쇄용 논문 목록 — 업로드·삭제 없이 카드만 쌓는다 */
export default function PapersPrintList({
  files,
  details,
  jobId,
  applicantId,
}: {
  files: PaperFile[];
  details: Record<number, PaperDetail | null>;
  jobId: string;
  applicantId: string;
}) {
  return (
    <div className="space-y-10">
      {files.map((f) => (
        <PaperCard
          key={f.file_id ?? `meta-${f.paper_id}`}
          file={f}
          detail={f.file_id != null ? (details[f.file_id] ?? null) : null}
          jobId={jobId}
          applicantId={applicantId}
        />
      ))}
    </div>
  );
}
