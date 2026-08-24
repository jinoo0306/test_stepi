"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { api, type PaperDetail, type PaperFile, type PaperStatus } from "@/lib/api";
import PaperCard from "@/components/paper-card";

const PENDING: PaperStatus[] = ["uploaded", "extracted", "extract_partial"];

export default function PapersSection({
  jobId,
  applicantId,
}: {
  jobId: string;
  applicantId: string;
}) {
  const [files, setFiles] = useState<PaperFile[]>([]);
  const [details, setDetails] = useState<Record<number, PaperDetail | null>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listPapers(jobId, applicantId);
      setFiles(list);
      // 분석 완료된 파일은 detail 미리 가져오기 (카드 렌더용). meta_only 는 file_id null → 제외.
      const needDetail = list.filter(
        (f): f is PaperFile & { file_id: number } =>
          f.file_id != null && f.status === "analyzed" && !details[f.file_id],
      );
      if (needDetail.length > 0) {
        const fetched = await Promise.all(
          needDetail.map((f) =>
            api.getPaperDetail(jobId, applicantId, f.file_id).catch(() => null),
          ),
        );
        setDetails((prev) => {
          const next = { ...prev };
          needDetail.forEach((f, i) => {
            next[f.file_id] = fetched[i];
          });
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [jobId, applicantId, details]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 처리중 파일 있으면 3초 폴링
  useEffect(() => {
    const hasPending = files.some((f) => PENDING.includes(f.status));
    if (!hasPending) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [files, refresh]);

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await api.uploadPaper(jobId, applicantId, file);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (fileId: number) => {
    if (!confirm("이 논문 첨부를 삭제할까요?")) return;
    try {
      await api.deletePaper(jobId, applicantId, fileId);
      setDetails((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <div className="text-[13px] text-[var(--ink-muted)] flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> 논문 목록 로딩…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 업로드 영역 */}
      <label
        className="flex items-center justify-center gap-2 border border-dashed border-[var(--line-strong)] py-6 cursor-pointer hover:bg-[var(--bg-2)] transition"
      >
        <Upload size={14} className="text-[var(--ink-muted)]" />
        <span className="text-[13px] text-[var(--ink-muted)]">
          {uploading ? "업로드 중…" : "PDF 논문 첨부 (50MB까지)"}
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <div className="text-[12px] text-red-600 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-muted)]">
          학술지 게재 이력 없음. xlsx 지원정보 또는 PDF 업로드로 등록됩니다.
        </p>
      ) : (
        <div className="space-y-10">
          {files.map((f) => (
            <PaperCard
              key={f.file_id ?? `meta-${f.paper_id}`}
              file={f}
              detail={f.file_id != null ? (details[f.file_id] ?? null) : null}
              jobId={jobId}
              applicantId={applicantId}
              onDelete={() => f.file_id != null && onDelete(f.file_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
