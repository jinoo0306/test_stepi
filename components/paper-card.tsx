import { ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import { api, type PaperDetail, type PaperFile, type PaperStatus } from "@/lib/api";

export const PAPER_STATUS_LABEL: Record<PaperStatus, string> = {
  uploaded: "업로드됨",
  extracted: "텍스트 추출 완료",
  extract_partial: "부분 추출",
  extract_fail: "추출 실패",
  analyzed: "분석 완료",
  analysis_fail: "분석 실패",
  meta_only: "PDF 미첨부",
};

export const PAPER_STATUS_TONE: Record<PaperStatus, string> = {
  uploaded: "text-[var(--ink-muted)]",
  extracted: "text-[var(--ink-muted)]",
  extract_partial: "text-[#b08a00]",
  extract_fail: "text-red-600",
  analyzed: "text-[var(--secondary-2)]",
  analysis_fail: "text-red-600",
  meta_only: "text-[var(--ink-soft)]",
};

/**
 * 논문 카드 한 장 — 화면(papers-section)과 인쇄 화면이 같이 쓴다.
 * onDelete 를 넘기지 않으면 삭제 버튼이 빠져 읽기 전용이 된다.
 */
export default function PaperCard({
  file,
  detail,
  jobId,
  applicantId,
  onDelete,
}: {
  file: PaperFile;
  detail: PaperDetail | null;
  jobId: string;
  applicantId: string;
  onDelete?: () => void;
}) {
  const isAnalyzed = file.status === "analyzed" && detail;
  const isMetaOnly = file.file_id == null;
  const pdfUrl = !isMetaOnly ? api.paperPdfUrl(jobId, applicantId, file.file_id!) : null;

  return (
    <article className="border border-[var(--line)] rounded-sm overflow-hidden">
      {/* 헤더 */}
      <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--line)] bg-[var(--bg-2)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText size={13} className="text-[var(--ink-muted)] shrink-0" />
            <span className="text-[12px] text-[var(--ink-muted)] truncate">
              {file.original_filename}
            </span>
          </div>
          <h3 className="serif text-[18px] leading-[1.35] truncate">
            {file.claimed_title || detail?.title || file.title || "(제목 추출 중)"}
          </h3>
          {(file.claimed_journal || file.claimed_year || detail?.journal || detail?.year) && (
            <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
              {[file.claimed_journal || detail?.journal, file.claimed_year || detail?.year]
                .filter(Boolean)
                .join(" · ")}
              {detail?.doi && (
                <>
                  {" · "}
                  <a
                    href={detail.doi}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[var(--ink)]"
                  >
                    DOI
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[12px] ${PAPER_STATUS_TONE[file.status]}`}>
            {file.status === "uploaded" && (
              <Loader2 size={11} className="inline mr-1 animate-spin" />
            )}
            {PAPER_STATUS_LABEL[file.status]}
          </span>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              data-print-hide
              className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] inline-flex items-center gap-1"
              title="원문 PDF 보기"
            >
              원문 <ExternalLink size={11} />
            </a>
          )}
          {!isMetaOnly && onDelete && (
            <button
              onClick={onDelete}
              data-print-hide
              className="text-[var(--ink-muted)] hover:text-red-600 transition"
              title="삭제"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>

      {isMetaOnly ? (
        <div className="px-5 py-6 text-[13px] text-[var(--ink-muted)]">
          xlsx 지원정보의 학술지 게재 이력. PDF 를 업로드하면 본문 분석 (problem · solution · result 등) 이 자동 진행됩니다.
        </div>
      ) : !isAnalyzed ? (
        <div className="px-5 py-8 text-[13px] text-[var(--ink-muted)] text-center">
          {file.status === "extract_fail" || file.status === "analysis_fail"
            ? `처리 실패: ${file.error_message ?? "오류"}`
            : "분석 진행 중…"}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
          {/* §1 P-S-R + §3 tech */}
          <div className="p-5 space-y-5">
            <PSRRow label="Problem"  value={detail.paper_problem}  evidence={detail.paper_evidence?.problem} />
            <PSRRow label="Solution" value={detail.paper_solution} evidence={detail.paper_evidence?.solution} />
            <PSRRow label="Result"   value={detail.paper_result}   evidence={detail.paper_evidence?.result} />

            {detail.paper_tech_stack && detail.paper_tech_stack.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)] mb-2">
                  Tech Stack
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.paper_tech_stack.map((t, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded-[2px] border border-[var(--line-strong)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.paper_process && detail.paper_process.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)] mb-2">
                  Process
                </div>
                <ol className="text-[13px] text-[var(--ink)] space-y-1.5">
                  {detail.paper_process.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[var(--ink-muted)] tabular-nums shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* §4 strength/weakness/interview */}
          <div className="p-5 space-y-5">
            {detail.paper_strength && (
              <SWBlock label="Strength" tone="strength" value={detail.paper_strength} />
            )}
            {detail.paper_weakness && (
              <SWBlock label="Weakness" tone="weakness" value={detail.paper_weakness} />
            )}
            {detail.paper_interview_qs && detail.paper_interview_qs.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)] mb-2">
                  예상 면접 질문
                </div>
                <ul className="space-y-2.5">
                  {detail.paper_interview_qs.map((q, i) => (
                    <li
                      key={i}
                      className="text-[13px] leading-[1.65] text-[var(--ink)] grid grid-cols-[auto_1fr] gap-3"
                    >
                      <span className="text-[var(--ink-muted)] tabular-nums">
                        Q{String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function PSRRow({
  label,
  value,
  evidence,
}: {
  label: string;
  value?: string | null;
  evidence?: string | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-muted)] mb-1.5">
        {label}
      </div>
      <p className="text-[14px] leading-[1.7] text-[var(--ink)]">{value}</p>
      {evidence && (
        <p className="mt-1.5 text-[12px] leading-[1.65] text-[var(--ink-muted)] italic border-l-2 border-[var(--line-strong)] pl-2.5">
          “{evidence}”
        </p>
      )}
    </div>
  );
}

function SWBlock({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "strength" | "weakness";
  value: string;
}) {
  const color = tone === "strength" ? "var(--secondary-2)" : "#9a4a4a";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color }}>
        {label}
      </div>
      <p className="text-[14px] leading-[1.7] text-[var(--ink)]">{value}</p>
    </div>
  );
}
