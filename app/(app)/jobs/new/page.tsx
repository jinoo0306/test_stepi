"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileSpreadsheet, FilePlus2, FileArchive } from "lucide-react";
import { api } from "@/lib/api";
import PageHeader from "@/components/page-header";

const TRACKS = [
  { value: "", label: "자동 추정 (시트 이름 기반)" },
  { value: "연구직", label: "연구직" },
  { value: "전문연구직", label: "전문연구직" },
  { value: "행정직", label: "행정직" },
];

export default function NewJobPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [infoFile, setInfoFile] = useState<File | null>(null);
  const [pdfZip, setPdfZip] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [track, setTrack] = useState("");
  const [mode, setMode] = useState<"full" | "score_only" | "questions_only">("full");
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState<string>("업로드 중…");
  const [err, setErr] = useState<string | null>(null);
  const [zipSummary, setZipSummary] = useState<string | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState<string>("");
  const [infoSheets, setInfoSheets] = useState<string[]>([]);
  const [infoSheetName, setInfoSheetName] = useState<string>("");

  const loadSheets = async (f: File, target: "essay" | "info") => {
    try {
      const names = await api.listExcelSheets(f);
      if (target === "essay") {
        setSheets(names);
        setSheetName(names.length === 1 ? names[0] : "");
      } else {
        setInfoSheets(names);
        setInfoSheetName(names.length === 1 ? names[0] : "");
      }
    } catch (e) {
      setErr(
        `시트 목록을 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setBusyMsg("자소서 업로드 중…");
    setErr(null);
    setZipSummary(null);
    try {
      const r = await api.uploadExcel(file, {
        request_id: label || undefined,
        mode,
        job_track: track || undefined,
        info_file: infoFile ?? undefined,
        sheet_name: sheetName || undefined,
        info_sheet_name: infoSheetName || undefined,
      });
      if (pdfZip) {
        setBusyMsg("논문 PDF zip 업로드 중…");
        try {
          const bulk = await api.bulkUploadPapers(r.job_id, pdfZip);
          setZipSummary(
            `논문 PDF ${bulk.queued}건 분석을 시작했습니다 · 중복 제외 ${bulk.duplicate_skipped}건 · 연결 안 된 지원자 ${bulk.unmatched_applicants.length}명`,
          );
        } catch (zerr) {
          // zip 업로드 실패해도 job 자체는 진행 — 사용자가 상세 페이지에서 재시도 가능
          setErr(
            `자소서 분석은 시작됐으나 PDF zip 업로드 실패: ${
              zerr instanceof Error ? zerr.message : String(zerr)
            }`,
          );
        }
      }

      router.push(`/jobs/${r.job_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
      setBusy(false);
    }
  };

  return (
    <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto fade-up">
      <PageHeader
        back={{ href: "/", label: "분석 목록" }}
        eyebrow="지원자 분석"
        icon={FilePlus2}
        title="새 분석"
        description="엑셀 파일에 담긴 지원자 자기소개서를 일괄 분석합니다. 분석은 비동기로 진행되며, 진행 상태는 다음 화면에서 실시간으로 확인할 수 있습니다."
      />

      <form onSubmit={submit} className="space-y-10 mt-6 panel">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-2">
            자기소개서 (.xlsx)
          </span>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-2)]/40 hover:bg-[var(--bg-2)] transition cursor-pointer py-10 px-6">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setSheets([]);
                setSheetName("");
                if (f) loadSheets(f, "essay");
              }}
              required
            />
            {file ? (
              <>
                <FileSpreadsheet size={28} strokeWidth={1.4} className="text-[var(--gold-2)]" />
                <div className="text-center">
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    {(file.size / 1024).toFixed(0)} KB · 클릭하여 변경
                  </div>
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={28} strokeWidth={1.4} className="text-[var(--ink-muted)]" />
                <div className="text-center">
                  <div className="text-sm font-medium">자기소개서 엑셀을 끌어놓거나 클릭해서 선택하세요</div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    지원자들의 자기소개서가 담긴 엑셀(.xlsx) 파일
                  </div>
                </div>
              </>
            )}
          </label>
          {sheets.length > 0 && (
            <div className="mt-3">
              <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-1.5">
                분석할 시트 ({sheets.length}개 감지)
              </span>
              <select
                className="input appearance-none"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                required={sheets.length > 1}
              >
                {sheets.length > 1 && <option value="">시트 선택…</option>}
                {sheets.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </label>

        <label className="block">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-2">
            지원정보 (선택 · 논문·학술지 게재 내역)
          </span>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-2)]/30 hover:bg-[var(--bg-2)] transition cursor-pointer py-7 px-6">
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setInfoFile(f);
                setInfoSheets([]);
                setInfoSheetName("");
                if (f) loadSheets(f, "info");
              }}
            />
            {infoFile ? (
              <>
                <FileSpreadsheet size={22} strokeWidth={1.4} className="text-[var(--gold-2)]" />
                <div className="text-center">
                  <div className="text-sm font-medium">{infoFile.name}</div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    {(infoFile.size / 1024).toFixed(0)} KB · 클릭하여 변경
                  </div>
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={22} strokeWidth={1.4} className="text-[var(--ink-muted)]" />
                <div className="text-center">
                  <div className="text-sm font-medium">지원정보 엑셀을 끌어놓거나 클릭해서 선택하세요</div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    지원자별 논문·학술지 게재 내역이 담긴 엑셀입니다. 같은 지원자 번호로 자기소개서와 자동 연결됩니다. 없으면 이 정보 없이 분석합니다.
                  </div>
                </div>
              </>
            )}
          </label>
          {infoSheets.length > 0 && (
            <div className="mt-3">
              <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-1.5">
                지원정보 시트 ({infoSheets.length}개 감지)
              </span>
              <select
                className="input appearance-none"
                value={infoSheetName}
                onChange={(e) => setInfoSheetName(e.target.value)}
                required={infoSheets.length > 1}
              >
                {infoSheets.length > 1 && <option value="">시트 선택…</option>}
                {infoSheets.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </label>

        <label className="block">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-2">
            논문 PDF (선택 · 압축파일)
          </span>
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-2)]/30 hover:bg-[var(--bg-2)] transition cursor-pointer py-7 px-6">
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="sr-only"
              onChange={(e) => setPdfZip(e.target.files?.[0] ?? null)}
            />
            {pdfZip ? (
              <>
                <FileArchive size={22} strokeWidth={1.4} className="text-[var(--gold-2)]" />
                <div className="text-center">
                  <div className="text-sm font-medium">{pdfZip.name}</div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    {(pdfZip.size / 1024 / 1024).toFixed(1)} MB · 클릭하여 변경
                  </div>
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={22} strokeWidth={1.4} className="text-[var(--ink-muted)]" />
                <div className="text-center">
                  <div className="text-sm font-medium">논문 PDF 압축파일(zip)을 끌어놓거나 클릭해서 선택하세요</div>
                  <div className="text-xs text-[var(--ink-muted)] mt-1">
                    지원자 번호로 된 폴더를 만들어 그 안에 해당 지원자의 논문 PDF를 넣고, 전체를 zip으로 압축해 올려주세요. 폴더 이름이 지원자 번호와 같아야 자동 연결됩니다.
                  </div>
                </div>
              </>
            )}
          </label>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-2">
              배치 라벨 (선택)
            </span>
            <input
              className="input"
              placeholder="예) 2026 상반기 연구직 1차"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-2">
              직군 지정
            </span>
            <select
              className="input appearance-none"
              value={track}
              onChange={(e) => setTrack(e.target.value)}
            >
              {TRACKS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] mb-3">
            분석 깊이
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { v: "full", t: "전체", d: "요약 + 점수 + 면접질문 모두" },
              { v: "score_only", t: "채점만", d: "직무적합도 점수만 (빠름)" },
              { v: "questions_only", t: "면접질문만", d: "추천 면접질문 6~8개만" },
            ].map((opt) => (
              <label
                key={opt.v}
                className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                  mode === opt.v
                    ? "border-[var(--gold)] bg-[var(--gold)]/8"
                    : "border-[var(--line-strong)] hover:bg-[var(--bg-2)]"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.v}
                  checked={mode === opt.v}
                  onChange={() => setMode(opt.v as typeof mode)}
                  className="sr-only"
                />
                <div className="font-medium text-sm">{opt.t}</div>
                <div className="text-xs text-[var(--ink-muted)] mt-1">{opt.d}</div>
              </label>
            ))}
          </div>
        </fieldset>

        {err && (
          <div className="text-sm text-[var(--bad)] bg-[var(--bad)]/8 border border-[var(--bad)]/30 rounded-lg px-3.5 py-2.5">
            {err}
          </div>
        )}
        {zipSummary && (
          <div className="text-sm text-[var(--ink-muted)] bg-[var(--bg-2)] border border-[var(--line)] rounded-lg px-3.5 py-2.5">
            {zipSummary}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary" disabled={!file || busy}>
            {busy ? busyMsg : "분석 시작"}
          </button>
        </div>
      </form>
    </div>
  );
}
