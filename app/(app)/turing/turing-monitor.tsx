"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Braces, Clock3, RefreshCcw, ShieldCheck } from "lucide-react";
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
  const latestRows = useMemo(() => data?.jobs.slice(0, 12) ?? [], [data]);

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        eyebrow="품질 모니터링"
        icon={Activity}
        title="Turing"
        description="분석 결과의 사실성, 출력 스키마, 처리 시간을 최근 Job 기준으로 집계합니다."
        aside={
          <div className="w-[min(260px,80vw)] panel-soft flex flex-col gap-2.5 text-[13px]">
            <div className="leader"><span className="text-[var(--ink-muted)]">갱신 주기</span><span /> <b className="font-mono">10s</b></div>
            <div className="leader"><span className="text-[var(--ink-muted)]">최근 Job</span><span /> <b className="font-mono">{data?.window.jobs ?? "—"}</b></div>
            <div className="leader"><span className="text-[var(--ink-muted)]">마지막 갱신</span><span /> <b className="font-mono">{updatedAt ? updatedAt.toLocaleTimeString("ko-KR") : "—"}</b></div>
            <button onClick={load} className="btn-ghost inline-flex items-center justify-center gap-2 mt-1">
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
          value={metrics?.hallucination_prevention.rate}
          suffix="%"
          detail={`${fmt(metrics?.hallucination_prevention.numeric_consistency_rate)} 숫자 · ${fmt(metrics?.hallucination_prevention.entity_consistency_rate)} 개체 · NLI ${nliLabel(metrics?.hallucination_prevention)}`}
        />
        <MetricPanel
          icon={<Braces size={20} />}
          label="출력형식 준수율"
          value={metrics?.format_compliance.rate}
          suffix="%"
          detail={`${metrics?.format_compliance.passed ?? 0}/${metrics?.format_compliance.total ?? 0} checks`}
        />
        <MetricPanel
          icon={<Clock3 size={20} />}
          label="응답 생성 시간"
          value={metrics?.response_time.avg_seconds_per_applicant}
          suffix="초/명"
          detail={`p50 ${seconds(metrics?.response_time.p50_seconds)} · p95 ${seconds(metrics?.response_time.p95_seconds)}`}
        />
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />의심 케이스 검수</h2>
          <span className="inline-flex items-center gap-2 text-[12px] text-[var(--ink-muted)]"><AlertTriangle size={14} /> LLM 판정 모순/무근거 · 숫자·개체 불일치</span>
        </div>
        <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
          {risks.length === 0 ? (
            <div className="py-10 px-4 text-[13px] text-[var(--ink-muted)]">명백한 숫자/개체 불일치 후보가 없습니다.</div>
          ) : risks.map((item) => {
            const isHallucinationFlag =
              item.risk_type === "nli_contradiction"
              || item.risk_type === "llm_contradiction"
              || item.risk_type === "llm_unsupported";
            return (
              <Link
                key={`${item.job_id}-${item.applicant_id}`}
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
                      <div className="line-clamp-2 text-[var(--ink)]">생성: {item.nli_contradictions?.[0]?.generated || item.generated_excerpt}</div>
                      <div className="mt-1 line-clamp-2">근거: {item.nli_contradictions?.[0]?.source || "—"}</div>
                      {item.reason && <div className="mt-1 line-clamp-2 text-[var(--ink-soft)]">판정: {item.reason}</div>}
                    </div>
                  ) : (
                    <div>
                      <div className="truncate">{misses(item.entity_misses, "개체")}</div>
                      <div className="mt-1 line-clamp-2">{item.generated_excerpt}</div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />최근 분석 흐름</h2>
          {loading && <span className="text-[13px] text-[var(--ink-muted)] dots-anim">집계중</span>}
        </div>
        <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[12.5px] font-semibold tracking-wide text-[var(--ink-muted)]">
            <div className="col-span-3">Job</div>
            <div className="col-span-1 text-center">상태</div>
            <div className="col-span-2 text-right">할루시네이션</div>
            <div className="col-span-2 text-right">형식준수</div>
            <div className="col-span-2 text-right">초/명</div>
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
              <div className="col-span-1 text-center text-[12px] uppercase text-[var(--ink-muted)]">{row.status}</div>
              <div className="col-span-2 text-right tabular-nums">{percent(row.hallucination_prevention_rate)}</div>
              <div className="col-span-2 text-right tabular-nums">{percent(row.format_compliance_rate)}</div>
              <div className="col-span-2 text-right tabular-nums">{seconds(row.avg_seconds_per_applicant)}</div>
              <div className="col-span-2 text-right tabular-nums text-[var(--ink-muted)]">
                {row.applicants_done}/{row.applicants_total}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-4 panel">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]"><Activity size={15} className="text-[var(--secondary-2)]" /> NER + NLI 상태</div>
          <p className="mt-3 text-[13px] leading-6 text-[var(--ink-muted)]">
            숫자와 주요 개체는 원천 지원자 데이터/논문 메타와 대조하고, NLI 모델이 로드되면 생성 문장 단위 함의 여부를 함께 반영합니다.
          </p>
        </div>
        <div className="col-span-12 lg:col-span-8 panel">
          <div className="grid grid-cols-3 gap-4 text-[13px]">
            <StatusItem label="NLI" value={metrics?.hallucination_prevention.nli_status ?? "—"} />
            <StatusItem label="샘플" value={String(metrics?.hallucination_prevention.samples ?? 0)} />
            <StatusItem label="평균 Job 시간" value={seconds(metrics?.response_time.avg_seconds)} />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricPanel({ icon, label, value, suffix, detail }: { icon: React.ReactNode; label: string; value?: number | null; suffix: string; detail: string }) {
  return (
    <div className="col-span-12 lg:col-span-4 panel min-h-[170px] relative overflow-hidden">
      <span className="absolute left-0 top-0 h-full w-[3px] bg-[var(--secondary)]" />
      <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink-2)]">
        <span className="text-[var(--secondary-2)]">{icon}</span>{label}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="numeral text-[52px] leading-none text-[var(--ink)]">{value == null ? "—" : value.toFixed(1)}</span>
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

function seconds(value?: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}s`;
}

function fmt(value?: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function nliLabel(metric?: TuringMetricsResponse["metrics"]["hallucination_prevention"]) {
  if (!metric) return "—";
  if (metric.nli_entailment_rate == null) return metric.nli_status;
  return `${metric.nli_entailment_rate.toFixed(1)}%`;
}

function misses(items: string[], label: string) {
  if (items.length === 0) return `${label} 없음`;
  return `${label} ${items.slice(0, 4).join(", ")}`;
}

function riskLabel(item: TuringRiskItem) {
  switch (item.risk_type) {
    case "llm_contradiction": return "LLM 모순";
    case "llm_unsupported": return "LLM 무근거";
    case "nli_contradiction": return `NLI ${item.score.toFixed(1)}%`;
    default: return `위험점수 ${item.score.toFixed(1)}%`;
  }
}

function flagLabel(rt?: TuringRiskItem["risk_type"]) {
  switch (rt) {
    case "llm_contradiction": return "LLM 판정: 모순";
    case "llm_unsupported": return "LLM 판정: 무근거";
    case "nli_contradiction": return "NLI 모순 후보";
    default: return "";
  }
}
