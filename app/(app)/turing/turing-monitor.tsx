"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock3, RefreshCcw, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/page-header";
import { api, type TuringMetricsResponse, type TuringRiskItem } from "@/lib/api";

const REFRESH_MS = 10000;

export default function TuringMonitor() {
  const [data, setData] = useState<TuringMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [risks, setRisks] = useState<TuringRiskItem[]>([]);

  const load = async () => {
    try {
      setError(null);
      const [next, riskNext] = await Promise.all([
        api.getTuringMetrics(50),
        api.getTuringRisks(5, 8),
      ]);
      setData(next);
      setRisks(riskNext.items);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Turing 지표를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

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
  }, []);

  const metrics = data?.metrics;
  const perApplicantMinutes =
    metrics?.response_time.avg_seconds_per_applicant == null
      ? null
      : metrics.response_time.avg_seconds_per_applicant / 60;
  const perAppTimes = (data?.jobs ?? [])
    .map((j) => j.avg_seconds_per_applicant)
    .filter((v): v is number => v != null);
  const tMin = perAppTimes.length ? Math.min(...perAppTimes) : null;
  const tMax = perAppTimes.length ? Math.max(...perAppTimes) : null;
  const latestRows = useMemo(() => data?.jobs.slice(0, 12) ?? [], [data]);

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        eyebrow="AI 품질 점검"
        icon={Activity}
        title="Turing"
        description="AI가 생성한 분석 결과의 신뢰성을 자동으로 점검합니다. ① 제출 자료에 없는 내용을 생성하지 않았는지, ② 모든 항목이 빠짐없이 완성됐는지, ③ 지원자 1명당 처리 시간을 최근 작업 기준으로 보여줍니다."
        aside={
          <div className="flex items-center gap-3 text-[13px] text-[var(--ink-muted)]">
            {updatedAt && (
              <span className="tabular-nums">
                {updatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
              </span>
            )}
            <button onClick={load} className="btn-ghost inline-flex items-center gap-2">
              <RefreshCcw size={14} /> 새로고침
            </button>
          </div>
        }
      />

      {error && (
        <div className="mt-8 border-l-2 border-[var(--bad)] pl-4 py-2 text-[13px] text-[var(--bad)]">
          {error}
        </div>
      )}

      <section className="grid grid-cols-12 gap-5 mt-10">
        <MetricPanel
          icon={<ShieldCheck size={20} />}
          label="할루시네이션 방지"
          hint="분석이 제출 자료에 충실하게 작성된 정도"
          value={metrics?.hallucination_prevention.rate}
          suffix="%"
          detail={`숫자 일치 ${fmt(metrics?.hallucination_prevention.numeric_consistency_rate)} · 이름·기관 일치 ${fmt(metrics?.hallucination_prevention.entity_consistency_rate)}`}
        />
        <MetricPanel
          icon={<ShieldCheck size={20} />}
          label="결과 완성도"
          hint="모든 분석 항목이 빠짐없이 작성된 정도"
          value={metrics?.format_compliance.rate}
          suffix="%"
          detail={`전체 ${(metrics?.format_compliance.total ?? 0).toLocaleString()}개 항목 중 ${(metrics?.format_compliance.passed ?? 0).toLocaleString()}개 충족`}
        />
        <MetricPanel
          icon={<Clock3 size={20} />}
          label="1명당 분석 시간"
          hint="지원자 한 명당 평균 소요 시간"
          value={perApplicantMinutes}
          suffix="분/명"
          decimals={2}
          detail={tMin != null && tMax != null && tMax - tMin > 1 ? `최단 ${minutes(tMin)} · 최장 ${minutes(tMax)}` : "최근 분석 작업 기준"}
        />
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />검수 권장 분석</h2>
          <span className="inline-flex items-center gap-2 text-[12px] text-[var(--ink-muted)]"><AlertTriangle size={14} /> 제출 자료와 일치하지 않을 가능성이 있는 항목</span>
        </div>
        <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
          {risks.length === 0 ? (
            <div className="py-10 px-4 text-[13px] text-[var(--ink-muted)]">검수가 필요한 항목이 없습니다. 모든 분석이 제출 자료와 일치합니다.</div>
          ) : (
          <>
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[12.5px] font-semibold tracking-wide text-[var(--ink-muted)]">
            <div className="col-span-3">지원자</div>
            <div className="col-span-2">유형</div>
            <div className="col-span-3">지적 사항</div>
            <div className="col-span-4">상세</div>
          </div>
          {risks.map((item, idx) => {
            const isHallucinationFlag =
              item.risk_type === "nli_contradiction"
              || item.risk_type === "llm_contradiction"
              || item.risk_type === "llm_unsupported";
            return (
              <Link
                key={`${item.job_id}-${item.applicant_id}-${item.risk_type ?? "x"}-${idx}`}
                href={`/jobs/${item.job_id}`}
                className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg-2)] transition"
              >
                <div className="col-span-12 lg:col-span-3 min-w-0">
                  <div className="font-mono text-[13px] text-[var(--ink)] truncate">{item.applicant_id}</div>
                  <div className="font-mono text-[11px] text-[var(--ink-soft)] truncate">{item.request_id || item.job_id}</div>
                </div>
                <div className="col-span-4 lg:col-span-2 tabular-nums text-[13px]">{riskLabel(item)}</div>
                <div className="col-span-8 lg:col-span-3 text-[12px] text-[var(--bad)] min-w-0">
                  {isHallucinationFlag ? flagLabel(item.risk_type) : misses(item.numeric_misses, "숫자")}
                </div>
                <div className="col-span-12 lg:col-span-4 text-[12px] text-[var(--ink-muted)] min-w-0">
                  {isHallucinationFlag ? (
                    <div>
                      <div className="line-clamp-2 text-[var(--ink)]">AI 분석: {item.nli_contradictions?.[0]?.generated || item.generated_excerpt}</div>
                      <div className="mt-1 line-clamp-2">실제 자료: {item.nli_contradictions?.[0]?.source || "—"}</div>
                      {item.reason && <div className="mt-1 line-clamp-2 text-[var(--ink-soft)]">확인 사유: {item.reason}</div>}
                    </div>
                  ) : (
                    <div>
                      <div className="truncate">{misses(item.entity_misses, "이름·기관")}</div>
                      <div className="mt-1 line-clamp-2">{item.generated_excerpt}</div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          </>
          )}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />최근 분석 점검 내역</h2>
          {loading && <span className="text-[13px] text-[var(--ink-muted)] dots-anim">집계 중</span>}
        </div>
        <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[12.5px] font-semibold tracking-wide text-[var(--ink-muted)]">
            <div className="col-span-3">분석 작업</div>
            <div className="col-span-1 text-center">상태</div>
            <div className="col-span-2 text-right">할루시네이션 방지</div>
            <div className="col-span-2 text-right">완성도</div>
            <div className="col-span-2 text-right">1명당 시간</div>
            <div className="col-span-2 text-right">지원자</div>
          </div>
          {latestRows.length === 0 ? (
            <div className="py-16 text-center text-[14px] text-[var(--ink-muted)]">
              아직 집계할 분석 결과가 없습니다.
            </div>
          ) : latestRows.map((row) => (
            <Link
              key={row.job_id}
              href={`/jobs/${row.job_id}`}
              className="grid grid-cols-12 gap-4 items-center px-4 py-4 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg-2)] transition"
            >
              <div className="col-span-3 min-w-0">
                <div className="font-mono text-[13px] truncate text-[var(--ink)]">{row.request_id || row.job_id}</div>
                <div className="font-mono text-[11px] truncate text-[var(--ink-soft)]">{row.job_id}</div>
              </div>
              <div className="col-span-1 text-center text-[12px] text-[var(--ink-muted)]">{statusLabel(row.status)}</div>
              <div className="col-span-2 text-right tabular-nums">{percent(row.hallucination_prevention_rate)}</div>
              <div className="col-span-2 text-right tabular-nums">{percent(row.format_compliance_rate)}</div>
              <div className="col-span-2 text-right tabular-nums">{minutes(row.avg_seconds_per_applicant)}</div>
              <div className="col-span-2 text-right tabular-nums text-[var(--ink-muted)]">
                {row.applicants_done}/{row.applicants_total}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-4 panel">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]"><Activity size={15} className="text-[var(--secondary-2)]" /> 점검 방식</div>
          <p className="mt-3 text-[13px] leading-6 text-[var(--ink-muted)]">
            AI가 작성한 문장 속 숫자와 이름·기관을, 지원자가 제출한 자료·논문과 하나씩 대조합니다. 자료에 없거나 다른 값이 발견되면 위 &lsquo;검수 권장 분석&rsquo;에 모아 표시합니다.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-8 panel">
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <StatusItem label="분석 대상 지원자" value={`${metrics?.hallucination_prevention.samples ?? 0}명`} />
            <StatusItem label="1명당 평균 처리 시간" value={minutes(metrics?.response_time.p50_seconds)} />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricPanel({ icon, label, hint, value, suffix, detail, decimals = 1 }: { icon: React.ReactNode; label: string; hint: string; value?: number | null; suffix: string; detail: string; decimals?: number }) {
  return (
    <div className="col-span-12 lg:col-span-4 panel min-h-[170px] relative overflow-hidden">
      <span className="absolute left-0 top-0 h-full w-[3px] bg-[var(--secondary)]" />
      <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink-2)]">
        <span className="text-[var(--secondary-2)]">{icon}</span>{label}
      </div>
      <div className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{hint}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="numeral text-[52px] leading-none text-[var(--ink)]">{value == null ? "—" : value.toFixed(decimals)}</span>
        <span className="text-[14px] font-medium text-[var(--ink-muted)]">{suffix}</span>
      </div>
      <div className="mt-4 pt-3 border-t border-[var(--line)] text-[12.5px] text-[var(--ink-muted)]">{detail}</div>
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="leader"><span className="text-[var(--ink-muted)]">{label}</span><span /><b className="font-mono text-[var(--ink)] truncate">{value}</b></div>
  );
}

function percent(value?: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function minutes(value?: number | null) {
  return value == null ? "—" : `${(value / 60).toFixed(2)}분`;
}

function fmt(value?: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function statusLabel(status: string) {
  switch (status) {
    case "completed": return "완료";
    case "running": return "분석 중";
    case "pending": return "대기";
    case "failed": return "실패";
    case "canceled":
    case "cancelled": return "취소";
    default: return status;
  }
}

function misses(items: string[], label: string) {
  if (items.length === 0) return `${label} 모두 일치`;
  return `자료에 없는 ${label} ${items.slice(0, 4).join(", ")}`;
}

function riskLabel(item: TuringRiskItem) {
  switch (item.risk_type) {
    case "llm_contradiction": return "내용 모순";
    case "llm_unsupported": return "근거 없음";
    case "nli_contradiction": return "자료와 불일치";
    default: return "숫자·이름 불일치";
  }
}

function flagLabel(rt?: TuringRiskItem["risk_type"]) {
  switch (rt) {
    case "llm_contradiction": return "분석 내용 간 상호 모순";
    case "llm_unsupported": return "제출 자료에 근거 없음";
    case "nli_contradiction": return "제출 자료와 불일치 가능성";
    default: return "";
  }
}
