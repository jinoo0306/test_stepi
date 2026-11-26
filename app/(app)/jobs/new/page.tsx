"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { failText, api } from "@/lib/api";
import PageHeader from "@/components/page-header";
import UploadForm, { type PaperHandOff } from "../../prelim/new/upload-form";

export default function NewJobPage() {
  return (
    <Suspense fallback={null}>
      <Entry />
    </Suspense>
  );
}

// 업로드 입구는 이 화면 하나(PRELIM-003 CHG-002). 만든 분석 번호는 주소에 둠. 새로고침해도 논문 ZIP 올리기 화면이 남고
// 분석을 다시 만들지 않음. 메뉴로 번호 없는 주소에 오면 지난 입력을 버린 새 화면
function Entry() {
  const sp = useSearchParams();
  const router = useRouter();
  const job = sp.get("job");
  const [handed, setHanded] = useState<PaperHandOff | null>(null);
  if (job) {
    return (
      <PaperResult
        key={job}
        createdJobId={job}
        createdPrelim={sp.get("prelim")}
        handed={handed?.jobId === job ? handed : null}
        onStarted={() => setHanded(null)}
      />
    );
  }
  return (
    <UploadForm
      onPaper={(h) => {
        setHanded(h);
        // 업로드 화면 자리를 바꿔 뒤로 가기로 빈 업로드 화면이 나오지 않게 함
        router.replace(`/jobs/new?job=${encodeURIComponent(h.jobId)}${h.ticket ? `&prelim=${encodeURIComponent(h.ticket)}` : ""}`);
      }}
    />
  );
}

function PaperResult({
  createdJobId,
  createdPrelim,
  handed,
  onStarted,
}: {
  createdJobId: string;
  createdPrelim: string | null;
  handed: PaperHandOff | null;
  onStarted: () => void;
}) {
  const router = useRouter();
  const [pdfZip, setPdfZip] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [zipSummary, setZipSummary] = useState<string | null>(null);
  const [zipErrors, setZipErrors] = useState<string[]>([]);
  const [unmatchedApplicants, setUnmatchedApplicants] = useState<string[]>([]);
  const [createWarnings] = useState(handed?.warnings ?? []);

  // 올리는 중 새로고침·창 닫기는 묻고 떠남
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const upload = async (zip: File) => {
    setBusy(true);
    setErr(null);
    setZipSummary(null);
    setZipErrors([]);
    setUnmatchedApplicants([]);
    try {
      const bulk = await api.bulkUploadPapers(createdJobId, zip);
      setZipSummary(
        `논문 PDF ${bulk.queued}건의 분석을 시작하였습니다(중복 제외 ${bulk.duplicate_skipped}건, 미연결 지원자 ${bulk.unmatched_applicants.length}명).`,
      );
      setZipErrors(bulk.errors);
      setUnmatchedApplicants(bulk.unmatched_applicants);
    } catch (zerr) {
      setErr(failText(zerr, "자기소개서 분석은 시작되었으나 논문 PDF ZIP 업로드에 실패하였습니다."));
    } finally {
      setBusy(false);
    }
  };

  // 업로드 화면에서 고른 ZIP 은 이 화면에 오자마자 한 번 올리고 넘겨받은 것은 비움(앞뒤로 가기로 다시 올리지 않게)
  const started = useRef(false);
  useEffect(() => {
    if (!handed || started.current) return;
    started.current = true;
    onStarted();
    void upload(handed.zip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handed]);

  return (
    <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto fade-up">
      <PageHeader
        eyebrow="지원자 분석"
        icon={FilePlus2}
        title="논문 PDF 업로드 결과"
        description="자기소개서 분석을 시작하였습니다. 논문 업로드 결과를 확인한 후 분석 결과로 이동해 주십시오."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pdfZip) void upload(pdfZip);
        }}
        className="space-y-6 mt-6 panel"
      >
        {busy && <p role="status">논문 PDF ZIP 업로드 중</p>}
        {createdPrelim && (
          <p>
            사전스크리닝 검토도 만들었습니다.{" "}
            <Link className="underline" href={`/prelim/${encodeURIComponent(createdPrelim)}`}>
              검토 결과 보기
            </Link>
          </p>
        )}
        {err && <p role="alert" className="text-[var(--bad)] break-words">{err}</p>}
        {createWarnings.length > 0 && (
          <section aria-label="입력 안내">
            <h2 className="font-semibold">입력 안내 {createWarnings.length}건</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1 break-words">
              {createWarnings.map((message, index) => <li key={index}>{message}</li>)}
            </ul>
          </section>
        )}
        {zipSummary && <p role="status">{zipSummary}</p>}
        {zipErrors.length > 0 && (
          <section aria-label="처리하지 못한 논문">
            <h2 className="font-semibold">논문 처리 안내 {zipErrors.length}건</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1 break-words">
              {zipErrors.map((message, index) => <li key={index}>{message}</li>)}
            </ul>
          </section>
        )}
        {unmatchedApplicants.length > 0 && (
          <section aria-label="연결하지 못한 지원자">
            <h2 className="font-semibold">연결하지 못한 지원자 {unmatchedApplicants.length}명</h2>
            <p className="mt-2 break-words">{unmatchedApplicants.join(", ")}</p>
            <p className="mt-2">폴더명의 지원자 번호가 자기소개서의 지원자 번호와 같은지 확인해 주십시오.</p>
          </section>
        )}
        <label className="block space-y-2">
          <span className="block">논문 PDF ZIP 다시 선택 (PDF 파일 1개당 최대 50MB)</span>
          <input
            type="file"
            className="block w-full min-w-0 max-w-full"
            accept=".zip,application/zip,application/x-zip-compressed"
            disabled={busy}
            onChange={(e) => setPdfZip(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-[13px] text-[var(--ink-muted)]">
          용량을 초과한 경우 파일을 나누어 업로드해 주십시오. 다시 업로드해도 자기소개서 분석은 새로 생성되지 않습니다.
          이미 등록된 논문은 중복으로 제외됩니다. 분석을 시작하지 못한 논문은 분석 결과 화면에서 상태를 확인해 주십시오.
        </p>
        <div className="flex flex-wrap gap-3 justify-end">
          <button type="submit" className="btn-primary" disabled={busy || !pdfZip}>
            {busy ? "논문 PDF ZIP 업로드 중" : "논문 ZIP 재업로드"}
          </button>
          <button type="button" className="btn-primary" disabled={busy}
            onClick={() =>
              router.push(
                `/jobs/${encodeURIComponent(createdJobId)}${createdPrelim ? `?prelim=${encodeURIComponent(createdPrelim)}` : ""}`,
              )
            }>
            분석 결과 보기
          </button>
        </div>
      </form>
    </div>
  );
}
