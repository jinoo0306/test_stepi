"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import PageHeader from "@/components/page-header";
import { api, failText, JOB_MODES, JOB_TRACKS, prelim, type JobMode, type PrelimRefSummary } from "@/lib/api";
import { browseZip, rememberZip, startAttachUpload, type ZipHandle } from "../attach-upload";
import "../prelim.css";

type Slot = "essay" | "attach" | "origin";

const TOGGLE_STYLE = { display: "flex", alignItems: "center", gap: 10, fontSize: 17.5, fontWeight: 600 } as const;
const BOX_STYLE = { width: 20, height: 20, accentColor: "var(--navy)" } as const;

const EMPTY_TEXT = "파일을 끌어다 놓거나 클릭하여 선택해 주십시오.";

// 평가기준일 범위는 백엔드와 같게
const EVAL_MIN = "2000-01-01";
const EVAL_MAX = "2099-12-31";

/** 평가기준일 글자를 YYYY-MM-DD 로. 20260930, 2026.9.30, 2026-09-30, 2026/09/30 을 받고 없는 날짜·범위 밖은 null */
function toIsoDate(text: string): string | null {
  const t = text.trim();
  const m = t.match(/^(\d{4})(\d{2})(\d{2})$/) ?? t.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*\.?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const iso = dt.toISOString().slice(0, 10);
  return iso >= EVAL_MIN && iso <= EVAL_MAX ? iso : null;
}

// 암호를 건 xlsx·xlsm 은 zip 이 아니라 OLE 문서(D0 CF 11 E0)로 저장됨
async function isLockedExcel(f: File): Promise<boolean> {
  if (!/\.xls[xm]$/i.test(f.name)) return false;
  const b = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
}

// zip 끝 목록과 중앙 목록 첫 항목만 봄(잘린 파일·zip 아닌 파일). 그 밖의 손상은 첨부 검사가 알림
async function isBrokenZip(f: File): Promise<boolean> {
  const read = async (at: number, n: number) =>
    at < 0 || n < 0 || at + n > f.size ? null : new DataView(await f.slice(at, at + n).arrayBuffer());
  const tailAt = Math.max(0, f.size - 65557);
  const tail = await read(tailAt, f.size - tailAt);
  let e = -1;
  for (let i = (tail?.byteLength ?? 0) - 22; i >= 0 && e < 0; i--) if (tail!.getUint32(i, true) === 0x06054b50) e = i;
  if (!tail || e < 0) return true;
  // 중앙 목록은 끝 목록 바로 앞에서 그 크기만큼 거슬러 찾음(앞에 다른 내용이 붙은 zip 도 열림)
  let end = tailAt + e;
  let entries = tail.getUint16(e + 10, true);
  let size = tail.getUint32(e + 12, true);
  const loc = await read(end - 20, 20);
  if (loc && loc.getUint32(0, true) === 0x07064b50) {
    // 4GB 가 넘는 zip(ZIP64)은 위치 표시가 가리키는 곳, 없으면 바로 앞의 ZIP64 끝 목록을 씀
    let z: DataView | null = null;
    for (const at of [Number(loc.getBigUint64(8, true)), end - 76]) {
      const v: DataView | null = z ? null : await read(at, 56);
      if (v?.getUint32(0, true) === 0x06064b50) [z, end] = [v, at];
    }
    if (!z) return true;
    entries = Number(z.getBigUint64(32, true));
    size = Number(z.getBigUint64(40, true));
  }
  if (entries === 0) return false;
  const cd = await read(end - size, 4);
  return !cd || cd.getUint32(0, true) !== 0x02014b50;
}

function DropBox({
  accept,
  label,
  file,
  onPick,
  onClick,
  disabled,
}: {
  accept: string;
  label: string;
  file: File | null;
  onPick: (f: File | null) => Promise<boolean>;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const cls = ["drop", over && "over", file && "filled"]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cls}
      onDragEnter={() => !disabled && setOver(true)}
      onDragOver={() => !disabled && setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
    >
      <span className="fname">{file ? file.name : EMPTY_TEXT}</span>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
        onChange={async (e) => {
          const input = e.currentTarget;
          // 거절한 파일은 입력칸에서도 비워 같은 파일을 다시 골라도 반응하게 함
          if (!(await onPick(input.files?.[0] ?? null))) input.value = "";
        }}
      />
      <span className="btn tertiary">{file ? "변경" : "파일 선택"}</span>
    </div>
  );
}

export default function UploadForm() {
  const router = useRouter();
  const [files, setFiles] = useState<Record<Slot, File | null>>({
    essay: null,
    attach: null,
    origin: null,
  });
  const [evalDate, setEvalDate] = useState("");
  const pickerRef = useRef<HTMLInputElement>(null);
  const [saveName, setSaveName] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<PrelimRefSummary | null>(null);
  const [attachMaxGb, setAttachMaxGb] = useState<number | null>(null);
  // 고른 zip 을 기억해 두면 새로고침 뒤 다시 고르지 않고 이어 올림(PRELIM-002)
  const zipHandle = useRef<{ file: File; handle: ZipHandle } | null>(null);
  // 같은 파일로 지원자 분석도 만들기(PRELIM-003). 시트가 여럿이면 분석 쪽만 시트 이름이 필요함
  const [withJob, setWithJob] = useState(true);
  // 한 화면 입구(CHG-002). 검토를 끄면 분석만 만듦
  const [withPrelim, setWithPrelim] = useState(true);
  const [track, setTrack] = useState("");
  const [mode, setMode] = useState<JobMode>("full");
  const [sheets, setSheets] = useState<Record<"essay" | "origin", string[]>>({ essay: [], origin: [] });
  const [sheet, setSheet] = useState<Record<"essay" | "origin", string>>({ essay: "", origin: "" });
  // 한쪽만 만들어졌을 때 그 번호와 그때 입력. 입력이 그대로면 다시 실행할 때 없는 쪽만 보냄
  const [madeAt, setMadeAt] = useState<{ ticket?: string; jobId?: string; inputs?: unknown[] }>({});
  const [jobError, setJobError] = useState<string | null>(null);

  // 내부위원·섭외 심사위원·연구기관은 제척 기준 정보 탭에서 읽는다는 안내용 건수
  useEffect(() => {
    let alive = true;
    prelim.reference
      .summary()
      .then((r) => alive && setRef(r))
      .catch(() => {});
    // 첨부 상한은 서버 설정값(ATTACH_MAX_GB)을 그대로 보여 줌
    prelim.attach
      .status()
      .then((s) => alive && setAttachMaxGb(Math.round(s.max_bytes / 1024 ** 3)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pick = (slot: Slot, label?: string) => async (f: File | null) => {
    if (f && label && (await isLockedExcel(f))) {
      setFiles((prev) => ({ ...prev, [slot]: null }));
      window.alert(
        `${label} 파일에 암호가 설정되어 있어 업로드할 수 없습니다.\n` +
          "엑셀에서 암호를 해제한 뒤(파일 > 정보 > 통합 문서 보호 > 암호 설정) 다시 업로드해 주십시오.",
      );
      return false;
    }
    if (f && slot === "attach" && (await isBrokenZip(f).catch(() => true))) {
      setFiles((prev) => ({ ...prev, [slot]: null }));
      window.alert("zip 파일을 열지 못했습니다. zip 으로 압축한 파일인지 확인해 주세요.");
      return false;
    }
    setFiles((prev) => ({ ...prev, [slot]: f }));
    if (slot === "essay" || slot === "origin") {
      const names = f
        ? await api.listExcelSheets(f).catch(() => {
            setError("시트 목록을 읽을 수 없습니다.");
            return [];
          })
        : [];
      setSheets((prev) => ({ ...prev, [slot]: names }));
      setSheet((prev) => ({ ...prev, [slot]: names.length === 1 ? names[0] : "" }));
    }
    return true;
  };
  const jobOn = withJob && !!files.essay;
  const inputs = [files.essay, files.origin, files.attach, evalDate, saveName, track, mode, sheet.essay, sheet.origin];
  const made = madeAt.inputs?.every((v, i) => v === inputs[i]) ? madeAt : {};
  const failMsg = [error, jobError && `지원자 분석은 만들지 못했습니다. ${jobError}`].filter(Boolean).join(" ");
  const evalIso = toIsoDate(evalDate);
  const evalBad = evalDate.trim() !== "" && evalIso === null;
  // 치는 도중에는 빨간 안내를 숨김
  const [evalTyping, setEvalTyping] = useState(false);
  const evalShowBad = evalBad && !evalTyping;
  const ready = ((withPrelim && !!(files.essay || files.attach || files.origin)) || jobOn) && !(withPrelim && evalBad);

  // 올리는 중 새로고침·창 닫기는 묻고 떠남(서버에 생겨도 화면이 번호를 잃음)
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || running) return;
    setRunning(true);
    setError(null);
    setJobError(null);
    const runPrelim = async (jobId?: string) => {
      const form = new FormData();
      if (files.essay) form.append("apply_xlsx", files.essay);
      if (files.origin) form.append("raw_xlsm", files.origin);
      // zip 은 검토를 만든 뒤 따로 올림. 첨부만 올려도 검토를 만들 수 있게 알림
      if (files.attach) form.append("has_attach", "true");
      if (evalIso) form.append("eval_date", evalIso);
      if (saveName.trim()) form.append("label", saveName.trim());
      if (jobId) form.append("job_id", jobId);
      const res = await prelim.run(form);
      // 엑셀 결과를 먼저 보도록 결과 화면으로 바로 넘어가고, zip 은 뒤에서 계속 올림
      if (files.attach) {
        if (zipHandle.current?.file === files.attach) await rememberZip(res.ticket, zipHandle.current.handle);
        startAttachUpload(res.ticket, files.attach, null);
      }
      return res.ticket;
    };
    // 분석을 먼저 만들고 그 번호를 검토에 실어 첨부 실적의 논문을 넘김(CHG-003). 한쪽 실패가 다른 쪽을 막지 않음
    const [j] = await Promise.allSettled([
      jobOn
        ? (made.jobId ??
          api
            .uploadExcel(files.essay!, {
              request_id: saveName.trim() || undefined,
              mode,
              job_track: track || undefined,
              info_file: files.origin ?? undefined,
              sheet_name: sheet.essay || undefined,
              info_sheet_name: (files.origin && sheet.origin) || undefined,
            })
            .then((r) => r.job_id))
        : undefined,
    ]);
    const jobId = j.status === "fulfilled" ? j.value : undefined;
    const [p] = await Promise.allSettled([withPrelim ? (made.ticket ?? runPrelim(jobId)) : undefined]);
    const ticket = p.status === "fulfilled" ? p.value : undefined;
    if (p.status === "rejected") setError(failText(p.reason, "사전스크리닝 실행에 실패하였습니다."));
    if (j.status === "rejected") setJobError(failText(j.reason, "업로드에 실패하였습니다."));
    if (p.status === "fulfilled" && j.status === "fulfilled") {
      if (ticket) router.push(`/prelim/${encodeURIComponent(ticket)}${jobId ? `?job=${encodeURIComponent(jobId)}` : ""}`);
      else if (jobId) router.push(`/jobs/${encodeURIComponent(jobId)}`);
      return;
    }
    setMadeAt({ ticket, jobId, inputs });
    setRunning(false);
  }

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        title="신규 분석 생성"
        description="파일을 한 번 올려 사전스크리닝 검토와 지원자 분석을 함께 만듭니다."
        wideDescription
      />
      <div className="prelim mt-8">
        <div className="upload-cols">
          <form className="stack" style={{ gap: 32 }} onSubmit={submit}>
            <section className="stack">
              <div className="sec-head">
                <h2>1. 검토 파일</h2>
              </div>

              <div className="file-row">
                <div>
                  <div className="name">자기소개서</div>
                  <div className="hint">.xlsx 파일</div>
                  <div className="hint">채용 사이트에서 다운로드한 자기소개서 파일입니다. 시트 이름은 제한이 없습니다.</div>
                  <a
                    className="tpl-link"
                    href="/templates/자기소개서 양식.xlsx"
                    download="자기소개서 양식.xlsx"
                  >
                    양식 다운로드
                  </a>
                </div>
                <DropBox
                  accept=".xlsx"
                  label="자기소개서 xlsx 파일 선택"
                  file={files.essay}
                  onPick={pick("essay", "자기소개서")}
                />
              </div>

              <div className="file-row">
                <div>
                  <div className="name">지원정보</div>
                  <div className="hint">.xlsx 또는 .xlsm 파일</div>
                  <div className="hint">지원자 학력·경력을 확인합니다. 업로드하지 않으면 제척 검토를 수행하지 않습니다.</div>
                  <a
                    className="tpl-link"
                    href="/templates/지원정보 양식.xlsx"
                    download="지원정보 양식.xlsx"
                  >
                    양식 다운로드
                  </a>
                </div>
                <DropBox
                  accept=".xlsx,.xlsm"
                  label="지원정보 파일 선택"
                  file={files.origin}
                  onPick={pick("origin", "지원정보")}
                />
              </div>

              <div className="file-row">
                <div>
                  <div className="name">첨부 실적</div>
                  <div className="hint">.zip 파일 (pdf·docx·이미지)</div>
                  <div className="hint">지원자 분석도 만들면 논문첨부·학술지 게재 폴더의 PDF를 분석 논문으로 넘깁니다.</div>
                  {attachMaxGb !== null && (
                    <div className="hint">
                      첨부 실적은 최대 {attachMaxGb}GB까지 업로드할 수 있습니다.
                    </div>
                  )}
                  <a
                    className="tpl-link"
                    href="/templates/첨부 실적 예시.zip"
                    download="첨부 실적 예시.zip"
                  >
                    예시 zip 다운로드
                  </a>
                </div>
                <DropBox
                  accept=".zip"
                  label="첨부 실적 zip 파일 선택"
                  file={withPrelim ? files.attach : null}
                  onPick={pick("attach")}
                  disabled={!withPrelim}
                  onClick={(e) =>
                    browseZip(e, (file, handle) => {
                      zipHandle.current = { file, handle };
                      void pick("attach")(file);
                    })
                  }
                />
              </div>

              <div className="file-row">
                <div>
                  <div className="name">
                    제척 기준 정보 <span className="tag opt">자동</span>
                  </div>
                  <div className="hint">별도로 파일을 업로드하지 않아도 됩니다.</div>
                </div>
                <div className="refbox">
                  <span>
                    제척 기준 정보에서 불러옵니다
                    {ref && (
                      <>
                        {" "}
                        · 내부위원 <b>{ref.staff.count}명</b> · 섭외 심사위원 <b>{ref.reviewers.count}명</b> · 연구기관{" "}
                        <b>{ref.orgs.count}곳</b>
                      </>
                    )}
                  </span>
                  <Link href="/prelim/reference" className="btn link">
                    제척 기준 정보로 이동
                  </Link>
                </div>
              </div>
            </section>

            <section className="stack">
              <h2>2. 검토 설정</h2>
              <label style={TOGGLE_STYLE}>
                <input type="checkbox" style={BOX_STYLE} checked={withPrelim} onChange={(e) => setWithPrelim(e.target.checked)} />
                사전스크리닝 검토도 만들기
              </label>
              <div className="two">
                {withPrelim && (
                <div className="field">
                  <label htmlFor="prelim-evaldate">평가기준일</label>
                  <div className="datebox">
                    <input
                      className="input"
                      id="prelim-evaldate"
                      type="text"
                      inputMode="numeric"
                      placeholder="예: 2026-09-30"
                      value={evalDate}
                      onChange={(e) => setEvalDate(e.target.value)}
                      onFocus={() => setEvalTyping(true)}
                      onBlur={() => {
                        setEvalTyping(false);
                        if (evalIso) setEvalDate(evalIso);
                      }}
                      aria-invalid={evalShowBad}
                    />
                    <button
                      type="button"
                      className="cal"
                      aria-label="달력"
                      title="달력"
                      onClick={() => {
                        const p = pickerRef.current;
                        if (!p) return;
                        p.value = evalIso ?? "";
                        p.showPicker?.();
                      }}
                    >
                      <CalendarDays size={20} aria-hidden />
                    </button>
                    {/* 달력 버튼이 여는 날짜 선택 창. 칸 자체는 글자 칸이라 지우고 고치기 쉬움 */}
                    <input
                      ref={pickerRef}
                      type="date"
                      min={EVAL_MIN}
                      max={EVAL_MAX}
                      tabIndex={-1}
                      aria-hidden
                      className="picker"
                      onChange={(e) => setEvalDate(e.target.value)}
                    />
                  </div>
                  <span className="hint" style={evalShowBad ? { color: "var(--red-text)" } : undefined}>
                    {evalShowBad
                      ? "날짜를 2026-09-30 형식으로 입력해 주십시오."
                      : "입력하지 않으면 오늘 날짜를 기준으로 검토합니다."}
                  </span>
                </div>
                )}
                <div className="field">
                  <label htmlFor="prelim-savename">저장명</label>
                  <input
                    className="input"
                    id="prelim-savename"
                    type="text"
                    placeholder="예: 2026년 1차"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                  />
                  <span className="hint">검토 결과를 구분하는 이름입니다.</span>
                </div>
              </div>
            </section>

            <section className="stack">
              <h2>
                3. 지원자 분석 <span className="tag opt">선택</span>
              </h2>
              <label style={TOGGLE_STYLE}>
                <input
                  type="checkbox"
                  style={BOX_STYLE}
                  checked={jobOn}
                  disabled={!files.essay}
                  onChange={(e) => setWithJob(e.target.checked)}
                />
                같은 파일로 지원자 분석도 만들기
              </label>
              <span className="hint" style={{ marginTop: -8 }}>
                {files.essay
                  ? "위 자기소개서·지원정보로 지원자 분석을 함께 만듭니다. 분석명은 저장명과 같습니다."
                  : "지원자 분석은 자기소개서가 있어야 만들 수 있습니다. 자기소개서를 올리면 켤 수 있습니다."}
              </span>
              {jobOn && (
                <div className="two">
                  <div className="field">
                    <label htmlFor="prelim-track">직군 지정</label>
                    <select className="input" id="prelim-track" value={track} onChange={(e) => setTrack(e.target.value)}>
                      {JOB_TRACKS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label id="prelim-mode">분석 수준 선택</label>
                    <div className="stageseg" role="group" aria-labelledby="prelim-mode">
                      {JOB_MODES.map((m) => (
                        <button key={m.v} type="button" aria-pressed={mode === m.v} onClick={() => setMode(m.v)}>
                          {m.t}
                        </button>
                      ))}
                    </div>
                    <span className="hint">{JOB_MODES.find((m) => m.v === mode)?.d}</span>
                  </div>
                  {(["essay", "origin"] as const).map(
                    (s) =>
                      files[s] &&
                      sheets[s].length > 1 && (
                        <div className="field" key={s}>
                          <label htmlFor={`prelim-sheet-${s}`}>
                            {s === "essay" ? "분석할 시트" : "지원정보 시트"} ({sheets[s].length}개 감지)
                          </label>
                          <select
                            className="input"
                            id={`prelim-sheet-${s}`}
                            required
                            value={sheet[s]}
                            onChange={(e) => setSheet((prev) => ({ ...prev, [s]: e.target.value }))}
                          >
                            <option value="">시트 선택</option>
                            {sheets[s].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      ),
                  )}
                </div>
              )}
            </section>

            <div className="run">
              <button
                className="btn primary"
                type="submit"
                disabled={!ready || running}
                style={{ minWidth: 200, justifyContent: "space-between" }}
              >
                {running
                  ? withPrelim ? "검토 중" : "업로드 중"
                  : made.ticket && !made.jobId && jobOn
                    ? "지원자 분석 다시 시도"
                    : made.jobId && !made.ticket && withPrelim
                      ? "사전스크리닝 검토 다시 시도"
                      : withPrelim ? "검토 실행" : "분석 시작"}{" "}
                <span aria-hidden="true">→</span>
              </button>
              <span role={failMsg ? "alert" : undefined} style={failMsg ? { color: "var(--red-text)" } : undefined}>
                {failMsg ||
                  (!withPrelim && !withJob
                    ? "사전스크리닝 검토나 지원자 분석 중 하나 이상을 켜 주십시오."
                    : ready
                      ? "검토할 파일이 준비되었습니다."
                      : withPrelim
                        ? "자기소개서·지원정보·첨부 실적 중 하나 이상을 업로드하면 검토를 실행할 수 있습니다."
                        : "자기소개서를 업로드하면 분석을 시작할 수 있습니다.")}
              </span>
            </div>
            {(made.ticket || made.jobId) && (
              <div className="refbox">
                <span>
                  {made.ticket ? "검토는 만들었습니다." : "지원자 분석은 만들었습니다."}
                  {made.ticket && !made.jobId && files.attach && jobOn && " 첨부 실적의 논문 PDF는 다시 만드는 지원자 분석으로 넘기지 않습니다."}
                </span>
                <Link
                  className="btn link"
                  href={made.ticket ? `/prelim/${encodeURIComponent(made.ticket)}` : `/jobs/${encodeURIComponent(made.jobId!)}`}
                >
                  {made.ticket ? "검토 결과 보기" : "분석 결과 보기"}
                </Link>
              </div>
            )}
          </form>

          <aside className="info">
            <h2>이 검토에서 확인하는 항목</h2>
            <div>
              <b>자기소개서 위배</b>
              <p>
                자기소개서 항목별로 블라인드 기준을 벗어난 표현이 있는지
                확인합니다.
              </p>
            </div>
            <div>
              <b>제척(내부·외부)</b>
              <p>
                평가기준일 기준 최근 2년 내 내부 과제 참여·외부기관 재직 경력을
                확인합니다.
              </p>
            </div>
            <div>
              <b>첨부 실적 내 위배</b>
              <p>
                제출한 실적 파일의 본문·파일명에 지원자 성명이 남아 있는지
                확인합니다.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
