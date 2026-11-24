"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCcw } from "lucide-react";
import PageHeader from "@/components/page-header";
import { failReason, api, type TuringMetricsResponse, type TuringPeriod, type TuringRiskResponse } from "@/lib/api";
import Overview from "./overview";
import JobHistory from "./job-history";

// 기간 전체를 다시 세므로(90일 약 1초) 예전 10초보다 길게 둠
const REFRESH_MS = 60000;

type Tab = "overview" | "history";
type Slot<T> = { data: T | null; error: string | null; at: Date | null };
const EMPTY_SLOT = { data: null, error: null, at: null };

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "history", label: "평가 내역" },
];
const PERIODS: { key: TuringPeriod; label: string }[] = [
  { key: "30d", label: "최근 30일" },
  { key: "90d", label: "최근 90일" },
  { key: "all", label: "전체" },
];

const clock = (d: Date) => d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function TuringMonitor({ initialTab, initialPeriod }: { initialTab: Tab; initialPeriod: TuringPeriod }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [period, setPeriod] = useState<TuringPeriod>(initialPeriod);
  // 두 요청을 따로 들고 있어야 한쪽만 실패해도 다른 쪽 결과를 정상처럼 섞어 보이지 않음
  const [m, setM] = useState<Slot<TuringMetricsResponse>>(EMPTY_SLOT);
  const [r, setR] = useState<Slot<TuringRiskResponse>>(EMPTY_SLOT);

  // 기간을 빨리 바꾸면 늦게 온 앞 요청이 새 기간 화면을 덮지 않게 가장 최근 요청만 받음
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    const [metricsRes, risksRes] = await Promise.allSettled([
      api.getTuringMetrics(period),
      api.getTuringRisks(period, 8),
    ]);
    if (mine !== seq.current) return;
    const at = new Date();
    setM((prev) =>
      metricsRes.status === "fulfilled"
        ? { data: metricsRes.value, error: null, at }
        : { ...prev, error: failReason(metricsRes.reason) },
    );
    setR((prev) =>
      risksRes.status === "fulfilled"
        ? { data: risksRes.value, error: null, at }
        : { ...prev, error: failReason(risksRes.reason) },
    );
  }, [period]);

  useEffect(() => {
    const tick = () => {
      void load();
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, REFRESH_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  // 새로고침해도 같은 탭·기간이 열리게 주소에 남김(기본값은 뺌)
  function remember(nextTab: Tab, nextPeriod: TuringPeriod) {
    const q = new URLSearchParams();
    if (nextTab !== "overview") q.set("tab", nextTab);
    if (nextPeriod !== "90d") q.set("period", nextPeriod);
    window.history.replaceState(null, "", q.size ? `?${q}` : window.location.pathname);
  }
  function pickTab(t: Tab) {
    setTab(t);
    remember(t, period);
  }
  function pickPeriod(p: TuringPeriod) {
    // 앞 기간 응답이 새 기간 카드·목록처럼 보이지 않게 비움
    setM(EMPTY_SLOT);
    setR(EMPTY_SLOT);
    setPeriod(p);
    remember(tab, p);
  }

  const data = m.data && m.data.window.period === period ? m.data : null;
  const risks = r.data && r.data.window.period === period ? r.data.items : null;
  const state = data ? null : m.error ? "불러오지 못하였습니다" : "불러오는 중";
  const failures = [
    { label: "turing. 지표를", slot: m },
    { label: "검수 권장 목록을", slot: r },
  ].filter((f) => f.slot.error);
  const w = data?.window;

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        eyebrow="AI 품질 점검"
        icon={Activity}
        title={<>turing<span className="text-[#40E0D0]">.</span></>}
        description={"AI 분석 결과와 사전스크리닝 검토의 품질 지표를 고른 기간으로 묶어 보여 줍니다.\n시험용 분석과 검토(이름이 QA_ 로 시작하거나 시연이 들어간 것)는 빼고 셉니다."}
        aside={
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-[var(--ink-muted)]">
            <div data-period-picker className="inline-flex rounded-lg border border-[var(--line-strong)] overflow-hidden" role="group" aria-label="기간">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={p.key === period}
                  onClick={() => pickPeriod(p.key)}
                  className={`px-3.5 h-9 text-[14px] border-l border-[var(--line)] first:border-l-0 transition ${p.key === period ? "bg-[var(--ink)] text-white font-semibold" : "bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--bg-2)]"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {m.at && <span className="tabular-nums">{m.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준</span>}
            <button onClick={() => void load()} className="btn-ghost inline-flex items-center gap-2">
              <RefreshCcw size={14} /> 새로고침
            </button>
          </div>
        }
      />

      <div data-window className="text-[14px] text-[var(--ink-muted)] tabular-nums">
        {w ? (
          <>
            {PERIODS.find((p) => p.key === w.period)?.label} · 분석 {w.jobs}건 · 판정 {w.verdicts}건
            {(w.excluded_jobs > 0 || w.excluded_tickets > 0) && ` · 시험용 분석 ${w.excluded_jobs}건·검토 ${w.excluded_tickets}건 제외`}
          </>
        ) : (
          state
        )}
      </div>

      <div className="mt-6 flex border-b border-[var(--line)]" role="tablist" aria-label="turing. 화면">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => pickTab(t.key)}
            className={`h-12 px-5 -mb-px text-[16px] border-b-[3px] transition ${t.key === tab ? "border-[var(--ink)] text-[var(--ink)] font-semibold" : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {failures.length > 0 && (
        <div className="mt-6 text-[14px] text-[var(--bad)] space-y-1.5">
          {failures.map(({ label, slot }) => (
            <div key={label}>
              {label} 불러오지 못하였습니다.
              {slot.data != null && slot.at && ` ${clock(slot.at)}에 조회한 이전 결과를 표시합니다.`}
              <div className="text-[12.5px] text-[var(--ink-muted)] break-all">{slot.error}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "overview" ? (
        <Overview data={data} state={state} risks={risks} risksError={r.error} />
      ) : (
        <JobHistory data={data} state={state} />
      )}
    </div>
  );
}
