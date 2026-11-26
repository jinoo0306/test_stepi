"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/page-header";
import { Bar } from "@/components/page-skeleton";
import {
  ApiError,
  failText,
  isNotFound,
  prelim,
  type PrelimDerived,
  type PrelimResult,
  type PrelimStage,
  type PrelimUploadKind,
  type PrelimVerdicts,
} from "@/lib/api";
import "../prelim.css";
import { isPaused, useAttachUpload } from "../attach-upload";
import { STAGES } from "./parts";
import SummaryTab from "./tab-summary";
import EssayTab from "./tab-essay";
import AttachTab, { AttachResume } from "./tab-attach";
import PrefTab from "./tab-preference";
import InternalTab from "./tab-internal";
import ExternalTab from "./tab-external";
import FinalTab from "./tab-final";
import NotUploaded, { notUploadedKind } from "./not-uploaded";
import PersonView from "./person-view";

export type TabKey = "summary" | "essay" | "attach" | "pref" | "inx" | "exx" | "final" | "person";

const TABS: [Exclude<TabKey, "person">, string][] = [
  ["summary", "요약"],
  ["essay", "자기소개서 위배"],
  ["attach", "첨부 실적 내 위배"],
  ["pref", "가산점 증빙 검토"],
  ["inx", "제척(내부)"],
  ["exx", "제척(외부)"],
  ["final", "블라인드 최종 결과"],
];
const BADGE_CLS: Record<string, string> = {
  essay: "navy",
  attach: "navy",
  pref: "navy",
  inx: "red",
  exx: "red",
  final: "red",
};
// 전체 엑셀은 담당자 HTML 과 같은 순서로 따로 내려받음. 전공명 AI 비교는 학위별 동일학력 다음
const ALL_KEYS = [
  "essay",
  "attach",
  "pref",
  "inx-staff",
  "inx",
  "work",
  "degree",
  "degree-ai",
  "exx-org",
  "exx-com",
  "exx",
  "final",
];
const FILE_LABELS: [string, string][] = [
  ["apply_xlsx", "자기소개서"],
  ["attach", "첨부 실적"],
  ["raw_xlsm", "지원정보"],
  ["reference", "제척 기준 정보"],
];

/** 경고문을 문장 단위로 나눔. 괄호 안이나 파일 이름 안의 마침표는 문장 끝으로 보지 않음 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "." && depth === 0 && !/\S/.test(text[i + 1] ?? "")) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.length ? out : [text];
}

/** 경고문의 굵게 표시를 반영함 */
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

export interface Ctx {
  ticket: string;
  data: PrelimResult;
  derived: PrelimDerived;
  verdicts: PrelimVerdicts;
  uploads: PrelimResult["uploads"];
  stage: PrelimStage;
  focusNo: string | null;
  busy: string | null;
  go: (tab: TabKey, opts?: { focus?: string; person?: string }) => void;
  setStage: (s: PrelimStage) => void;
  judge: (
    kind: "essay" | "attach" | "out" | "deg_ai" | "pref",
    itemId: string,
    value: string | null,
    reason?: string | null,
  ) => Promise<boolean>;
  upload: (kind: PrelimUploadKind, file: File) => void;
  exportUrl: (key: string) => string;
}

export default function ResultView({ ticket }: { ticket: string }) {
  const sp = useSearchParams();
  const tab = ((sp.get("tab") as TabKey) || "summary") as TabKey;
  const person = sp.get("person");
  const focusNo = sp.get("focus");
  const stage = (STAGES as readonly string[]).includes(sp.get("stage") ?? "")
    ? (sp.get("stage") as PrelimStage)
    : "서류";

  const [data, setData] = useState<PrelimResult | null>(null);
  const [derived, setDerived] = useState<PrelimDerived | null>(null);
  const [verdicts, setVerdicts] = useState<PrelimVerdicts | null>(null);
  const [uploads, setUploads] = useState<PrelimResult["uploads"]>({});
  const [error, setError] = useState<unknown>(null);
  const up = useAttachUpload(ticket);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  // 판정·업로드 저장은 한 줄로 차례대로 보내고, 그사이 끝난 조회 결과는 버림
  const writeChain = useRef<Promise<void>>(Promise.resolve());
  const writeSeq = useRef(0);
  const writesPending = useRef(0);

  const load = useCallback(async () => {
    const seq = writeSeq.current;
    try {
      const r = await prelim.result(ticket);
      if (writesPending.current > 0 || writeSeq.current !== seq) return;
      setData(r);
      setDerived(r.derived);
      setVerdicts(r.verdicts);
      setUploads(r.uploads ?? {});
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [ticket]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 조회
    void load();
  }, [load]);

  // 엑셀 검토 중에는 3초, 첨부 검사 중에는 5초마다 다시 읽음
  const reviewing = data?.run_status === "running";
  const scanning =
    data && ["uploading", "queued", "scanning"].includes(data.attach_status);
  useEffect(() => {
    if (!reviewing && !scanning) return;
    const t = setInterval(() => void load(), reviewing ? 3000 : 5000);
    return () => clearInterval(t);
  }, [reviewing, scanning, load]);

  const setQuery = useCallback(
    (next: Record<string, string | null>, scrollTop: boolean) => {
      const q = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") q.delete(k);
        else q.set(k, v);
      }
      const qs = q.toString();
      window.history.pushState(
        null,
        "",
        qs ? `?${qs}` : window.location.pathname,
      );
      if (scrollTop) window.scrollTo(0, 0);
    },
    [],
  );

  const go = useCallback<Ctx["go"]>(
    (t, opts) => {
      setQuery(
        {
          tab: t === "summary" ? null : t,
          person: opts?.person ?? null,
          focus: opts?.focus ?? null,
        },
        !opts?.focus,
      );
    },
    [setQuery],
  );

  // 이동해 온 지원자 줄로 한 번만 스크롤. 판정 저장으로 derived 가 바뀔 때마다 다시 끌어오지 않게 함
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNo) {
      scrolledTo.current = null;
      return;
    }
    const key = `${tab}:${focusNo}`;
    if (!derived || scrolledTo.current === key) return;
    const el = paneRef.current?.querySelector(
      `[data-no="${CSS.escape(focusNo)}"]`,
    );
    if (!el) return;
    scrolledTo.current = key;
    setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
  }, [focusNo, tab, derived]);

  const enqueueWrite = useCallback((busyKey: string, run: () => Promise<void>) => {
    writeSeq.current += 1;
    writesPending.current += 1;
    const job = writeChain.current.then(async () => {
      setBusy(busyKey);
      try {
        await run();
        setNotice(null);
        return true;
      } catch (e) {
        setNotice(
          e instanceof Error && e.name === "TimeoutError"
            ? "응답이 지연되어 저장에 실패하였습니다. 새로고침한 후 다시 시도해 주십시오."
            : failText(e, "저장에 실패하였습니다."),
        );
        return false;
      } finally {
        // 저장 중에 출발한 조회도 옛 판정을 읽었을 수 있으니 끝날 때 한 번 더 올림
        writeSeq.current += 1;
        writesPending.current -= 1;
        setBusy(null);
      }
    });
    writeChain.current = job.then(() => undefined);
    return job;
  }, []);

  const judge = useCallback<Ctx["judge"]>(
    (kind, itemId, value, reason) =>
      enqueueWrite(`${kind}:${itemId}`, async () => {
        const r = await prelim.verdict.put(ticket, {
          kind,
          item_id: itemId,
          value,
          reason,
        });
        setVerdicts(r.verdicts);
        setDerived(r.derived);
      }),
    [ticket, enqueueWrite],
  );

  const upload = useCallback<Ctx["upload"]>(
    (kind, file) =>
      enqueueWrite(`up:${kind}`, async () => {
        const r = await prelim.upload.put(ticket, kind, file);
        setUploads(r.uploads);
        setDerived(r.derived);
      }),
    [ticket, enqueueWrite],
  );

  const exportUrl = useCallback(
    (key: string) =>
      prelim.exportKeyUrl(
        ticket,
        key,
        key.startsWith("exx-com") ? stage : undefined,
      ),
    [ticket, stage],
  );

  async function downloadAll() {
    setDownloading(true);
    // api 재시작 전 응답에는 최종 결과가 없음
    for (const key of ALL_KEYS.filter((k) => (k !== "final" || derived?.final) && (k !== "degree-ai" || derived?.inx.degree_ai))) {
      const a = document.createElement("a");
      a.href = exportUrl(key);
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 300));
    }
    setDownloading(false);
  }

  // 신규 검토 생성에서 지원자 분석도 함께 만들었으면 그 분석 번호가 주소에 옴(PRELIM-003)
  const job = sp.get("job");
  const head = (description?: ReactNode, aside?: ReactNode) => (
    <>
      <PageHeader
        back={{ href: "/prelim", label: "분석 현황" }}
        eyebrow="사전스크리닝 검토"
        icon={ShieldAlert}
        title="사전스크리닝 검토 결과"
        description={description}
        wideDescription
        aside={aside}
      />
      {job && (
        <div className="prelim mt-6">
          <div className="refbox">
            <span>지원자 분석도 만들었습니다.</span>
            <Link className="btn link" href={`/jobs/${encodeURIComponent(job)}`}>
              분석 결과 보기
            </Link>
          </div>
        </div>
      )}
    </>
  );

  if (error) {
    // 삭제 항목에 있는 검토는 410 과 한글 안내(detail)로 옴. 원문 대신 안내와 삭제 항목 링크를 보여 줌
    const gone = error instanceof ApiError && error.status === 410 ? error.reason : null;
    return (
      <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
        {head()}
        <div className="prelim result">
          <div className="empty" role="alert">
            {gone ? (
              <>
                {gone}{" "}
                <Link href="/prelim/trash" className="underline underline-offset-4">
                  삭제 항목으로 이동
                </Link>
              </>
            ) : isNotFound(error) ? "검토를 찾을 수 없습니다." : "검토 결과를 불러오지 못하였습니다. 잠시 후 새로고침해 주십시오."}
          </div>
        </div>
      </div>
    );
  }
  const paused = isPaused(data?.attach_status, up);
  const upLine =
    paused && data ? (
      <>
        {up?.error && <div style={{ color: "var(--red-text)" }}>{up.error}</div>}
        <AttachResume ticket={ticket} data={data} />
      </>
    ) : up ? (
      `첨부 실적 zip 파일을 업로드하고 있습니다(${Math.round(up.ratio * 100)}%). 업로드가 끝날 때까지 이 창을 닫거나 새로고침하지 마십시오.`
    ) : null;
  if (data && (data.run_status === "running" || data.run_status === "failed")) {
    const failedRun = data.run_status === "failed";
    const line = data.attach_status === "uploading" ? upLine : null;
    return (
      <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
        {head(
          <>
            저장명 <b className="font-semibold text-[var(--ink)]">{data.label || "-"}</b>
          </>,
          <Link href="/prelim/new" className="btn-primary">
            + 신규 검토 생성
          </Link>,
        )}
        <div className="prelim result mt-8 grid gap-4">
          {failedRun ? (
            <div className="empty" role="alert">
              사전스크리닝 실행에 실패하였습니다.{data.run_error ? ` ${data.run_error}` : ""}
            </div>
          ) : (
            <div className="empty flex items-center justify-center gap-2" role="status" aria-live="polite">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              검토 중입니다. 이 창을 닫거나 새로고침해도 검토는 계속됩니다.
            </div>
          )}
          {!failedRun && line && (
            <div className="rulebox" role="status" aria-live="polite">
              {line}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!data || !derived || !verdicts) {
    return (
      <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
        {head(<Bar className="h-5 w-[min(520px,80%)] animate-pulse" />)}
        <div className="prelim result mt-8" role="status" aria-live="polite">
          <span className="sr-only">검토 결과를 불러오는 중입니다</span>
          <div className="tabs" aria-hidden="true">
            {TABS.map(([k, label], i) => (
              <button key={k} type="button" role="tab" disabled tabIndex={-1} aria-selected={i === 0}>
                {label}
              </button>
            ))}
          </div>
          <div className="animate-pulse grid gap-4" aria-hidden="true">
            <Bar className="h-5 w-40" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-6 py-3 border-b border-[var(--line)]">
                <Bar className="h-4 w-32" />
                <Bar className="h-4 flex-1 max-w-[460px]" />
                <Bar className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const counts = derived.summary_fixed.tab_counts as Record<string, number>;
  const tabs = derived.final ? TABS : TABS.filter(([k]) => k !== "final");
  const missing = notUploadedKind(data, tab);
  const files = FILE_LABELS.filter(([k]) =>
    k === "attach" ? data.attach_status !== "none" : !!data.files_used?.[k],
  ).map(([, label]) => label);
  const warnings = [...(data.counts.skipped ?? []), ...derived.warnings];
  const ctx: Ctx = {
    ticket,
    data,
    derived,
    verdicts,
    uploads,
    stage,
    focusNo,
    busy,
    go,
    judge,
    upload,
    exportUrl,
    setStage: (s) =>
      setQuery({ stage: s === "서류" ? null : s, focus: null }, false),
  };

  const meta = (
    <>
      저장명 <b className="font-semibold text-[var(--ink)]">{data.label || "-"}</b>
      <span className="mx-3 text-[var(--line)]">|</span>
      검토 공고명{" "}
      <b className="font-semibold text-[var(--ink)]">{data.notice || "-"}</b>
      <span className="mx-3 text-[var(--line)]">|</span>
      평가기준일{" "}
      <b className="font-semibold text-[var(--ink)] tabular-nums">
        {derived.end || "-"}
      </b>
      <br />
      검토 파일{" "}
      <b className="font-semibold text-[var(--ink)]">
        {files.length ? files.join(" · ") : "자기소개서"}
      </b>
    </>
  );
  const actions = (
    <div className="res-actions flex items-center gap-2">
      {!scanning && (
        <div className="relative">
          <button
            className="btn-ghost"
            type="button"
            onClick={downloadAll}
            disabled={downloading}
          >
            전체 엑셀 다운로드
          </button>
          <span className="absolute right-0 top-full mt-1 whitespace-nowrap text-[12px] text-[var(--ink-muted)]">
            여러 파일 다운로드를 허용해 주십시오.
          </span>
        </div>
      )}
      <Link href="/prelim/new" className="btn-primary">
        + 신규 검토 생성
      </Link>
    </div>
  );

  // 첨부 zip 만 진행 중으로 두고 엑셀 결과 탭은 먼저 보여 줌(기관검토 2)
  // 멈춘 업로드는 첨부 탭이 이어 올리기를 직접 보여 줌
  const attachLine: ReactNode =
    data.attach_status === "uploading"
      ? upLine
      : (up?.error ??
        (!scanning
          ? null
          : `첨부 실적을 검사하고 있습니다${data.attach_total ? `(${data.attach_done ?? 0} / ${data.attach_total}개)` : ""}. 검사가 끝나면 첨부 실적 내 위배, 요약, 블라인드 최종 결과의 숫자가 바뀝니다.`));

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      {head(meta, actions)}
      <div className="prelim result mt-8">
        <div className="tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => go(k)}
            >
              {label}
              {counts[k] != null && (
                <span className={`badge ${BADGE_CLS[k]}`}>{counts[k]}</span>
              )}
            </button>
          ))}
        </div>

        {attachLine && ((tab !== "attach" && tab !== "pref") || (up?.error && !paused)) && (
          <div
            className="rulebox"
            role="status"
            aria-live="polite"
            style={up?.error && !paused ? { borderLeftColor: "var(--red)", color: "var(--red-text)" } : undefined}
          >
            {attachLine}
          </div>
        )}

        {notice && (
          <div
            className="rulebox"
            role="alert"
            style={{ borderLeftColor: "var(--red)", color: "var(--red-text)" }}
          >
            {notice}
          </div>
        )}
        {warnings.length > 0 && tab === "summary" && (
          <div className="rulebox warn-list">
            {warnings.map((w, i) => {
              const [first, ...rest] = splitSentences(w);
              return (
                <div key={i} className="warn">
                  <div>{withBold(first)}</div>
                  {rest.map((t, j) => (
                    <div key={j} className="cont">
                      {withBold(t)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div ref={paneRef} style={{ display: "grid", gap: 24 }}>
          {(tab === "summary" || (tab === "final" && !derived.final)) && <SummaryTab ctx={ctx} />}
          {missing ? (
            <NotUploaded kind={missing} />
          ) : (
            <>
              {tab === "essay" && <EssayTab ctx={ctx} />}
              {tab === "attach" && <AttachTab ctx={ctx} />}
              {tab === "pref" && <PrefTab ctx={ctx} />}
              {tab === "inx" && <InternalTab ctx={ctx} />}
              {tab === "exx" && <ExternalTab ctx={ctx} />}
              {tab === "final" && derived.final && <FinalTab ctx={ctx} final={derived.final} />}
            </>
          )}
          {tab === "person" && <PersonView ctx={ctx} no={person ?? ""} />}
        </div>
      </div>
    </div>
  );
}
