"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TuringCard, TuringMetricsResponse, TuringRiskItem } from "@/lib/api";

// 영역 묶음과 배치(한 줄에 놓을 영역). 영역 이름은 백엔드 area 값과 같음
const ROWS: { area: string; span: string; cols: string }[][] = [
  [{ area: "운영", span: "lg:col-span-12", cols: "lg:grid-cols-4" }],
  [{ area: "근거성·안전", span: "lg:col-span-9", cols: "lg:grid-cols-3" }, { area: "공정성", span: "lg:col-span-3", cols: "lg:grid-cols-1" }],
  [{ area: "사전스크리닝", span: "lg:col-span-6", cols: "lg:grid-cols-3" }, { area: "정기 성능평가", span: "lg:col-span-6", cols: "lg:grid-cols-3" }],
];
// 분석 건 단위로 잴 수 있어 추이 그래프·평가 내역에 쓰는 지표(FR-008, FR-010)
export const JOB_CARD_IDS = ["O01", "O03", "O04", "O12", "G01", "G02", "S01", "G03", "G08", "F03"];
const QUOTE_PLACE = { summary: "요약", axis_reason: "5축 사유", dept_reason: "직군 적합도 사유" };
const DENOMINATOR: Record<string, string> = {
  O01: "요청 {n}명", O03: "분석 {n}건", O04: "분석 {n}건", O12: "문항 {n}개", G01: "숫자 {n}개", G02: "기관 이름 {n}개",
  S01: "지원자 {n}명", G03: "인용 {n}개", G08: "항목 {n}개", F03: "지원자 {n}명", A01: "확정·기각 {n}건", A06: "확정·기각 {n}건", U02: "판정 {n}건",
};

export function fmtValue(card: Pick<TuringCard, "value" | "unit">) {
  const v = card.value;
  if (v == null) return "미측정";
  switch (card.unit) {
    case "%": return `${v.toFixed(1)}%`;
    case "초": return `${v.toFixed(1)}초`;
    case "건": return `${v.toLocaleString()}건`;
    case "상관": return v.toFixed(2);
    default: return v.toFixed(2);
  }
}

function denominator(card: TuringCard, n: number | null) {
  if (n == null) return null;
  return (DENOMINATOR[card.id] ?? "{n}").replace("{n}", n.toLocaleString());
}

function detailLine(card: TuringCard) {
  const d = card.detail;
  if (!d) return null;
  if (card.id === "O01") {
    const failed = Object.values(d.failed_by_cause ?? {}).reduce((a, b) => a + b, 0);
    return `원인 기록 실패 ${failed}명 · 원인 미기록 ${d.unknown ?? 0}명`;
  }
  if ((card.id === "O03" || card.id === "O04") && d.excluded_jobs) return `시간 기록이 없거나 믿을 수 없어 뺀 분석 ${d.excluded_jobs}건`;
  if (card.id === "S01" && d.not_in_source != null) return `제출 자료에 없는 것 ${d.not_in_source}건`;
  if (card.id === "G03" && card.value != null) return `원문에 없음 ${d.invalid ?? 0}개`;
  if ((card.id === "A01" || card.id === "A06") && d.candidates != null) {
    const rate = d.candidates ? ` (${((100 * (d.judged ?? 0)) / d.candidates).toFixed(1)}%)` : "";
    return `판정률 ${d.judged ?? 0}/${d.candidates}${rate}`;
  }
  return null;
}

export default function Overview({ data, state, risks, risksError }: {
  data: TuringMetricsResponse | null;
  state: string | null;
  risks: TuringRiskItem[] | null;
  risksError: string | null;
}) {
  const [metric, setMetric] = useState("G01");
  const cards = data?.cards ?? [];
  const byArea = (area: string) => cards.filter((c) => c.area === area);
  const selected = cards.find((c) => c.id === metric);

  return (
    <>
      {state ? (
        <div className="py-16 text-center text-[15px] text-[var(--ink-muted)]">{state}</div>
      ) : (
        <section data-cards className="mt-8 space-y-6">
          {ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-5">
              {row.map(({ area, span, cols }) => (
                <div key={area} data-area={area} className={`col-span-12 ${span}`}>
                  <h3 className="flex items-center gap-2.5 mb-3 text-[16px] font-bold tracking-[-0.01em]"><span className="mark" />{area}</h3>
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-4`}>
                    {byArea(area).map((card) => (
                      <MetricCard
                        key={card.id}
                        card={card}
                        active={card.id === metric}
                        onPick={JOB_CARD_IDS.includes(card.id) ? () => setMetric(card.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {data && selected && <Trend data={data} card={selected} />}

      <section className="mt-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />검수 권장 분석</h2>
          <span className="inline-flex items-center gap-2 text-[13px] text-[var(--ink-muted)]"><AlertTriangle size={14} /> 제출 자료와 일치하지 않을 가능성이 있는 항목</span>
        </div>
        <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
          {risks === null ? (
            <div className="py-10 px-4 text-[14px] text-[var(--ink-muted)]">
              {risksError ? "검수 권장 목록을 불러오지 못하였습니다." : "불러오는 중"}
            </div>
          ) : risks.length === 0 ? (
            <div className="py-10 px-4 text-[14px] text-[var(--ink-muted)]">검수가 필요한 항목이 없습니다.</div>
          ) : (
            <>
              <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[13.5px] font-semibold tracking-wide text-[var(--ink-muted)]">
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
                      <div className="tabular-nums text-[14px] text-[var(--ink)] truncate">{item.applicant_id}</div>
                      <div className="tabular-nums text-[12px] text-[var(--ink-soft)] truncate">{item.request_id || item.job_id}</div>
                    </div>
                    <div className="col-span-4 lg:col-span-2 tabular-nums text-[14px]">{riskLabel(item)}</div>
                    <div className="col-span-8 lg:col-span-3 text-[13px] text-[var(--bad)] min-w-0">
                      {isHallucinationFlag ? flagLabel(item.risk_type) : misses(item.numeric_misses, "숫자")}
                    </div>
                    <div className="col-span-12 lg:col-span-4 text-[13px] text-[var(--ink-muted)] min-w-0">
                      {isHallucinationFlag ? (
                        <div>
                          <div className="line-clamp-2 text-[var(--ink)]">AI 분석: {item.nli_contradictions?.[0]?.generated || item.generated_excerpt}</div>
                          <div className="mt-1 line-clamp-2">실제 자료: {item.nli_contradictions?.[0]?.source || "-"}</div>
                          {item.reason && <div className="mt-1 line-clamp-2 text-[var(--ink-soft)]">확인 사유: {item.reason}</div>}
                        </div>
                      ) : (
                        <div>
                          <div className="truncate">{misses(item.entity_misses, "이름·기관")}</div>
                          {item.invalid_quotes?.map((q, i) => (
                            <div key={i} className="mt-1 truncate">원문에 없음 · {QUOTE_PLACE[q.where]}: {q.text}</div>
                          ))}
                          {!!item.empty_summaries?.length && (
                            <div className="mt-1 line-clamp-2">요약이 빈 문항: {item.empty_summaries.map((e) => e.question || e.question_id).join(", ")}</div>
                          )}
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
    </>
  );
}

function MetricCard({ card, active, onPick }: { card: TuringCard; active: boolean; onPick?: () => void }) {
  const den = denominator(card, card.denominator);
  const detail = detailLine(card);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14.5px] font-semibold text-[var(--ink-2)] leading-snug">{card.name}</div>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold tabular-nums bg-[var(--bg-2)] text-[var(--ink-muted)]">{card.id}</span>
      </div>
      <div className="mt-3 min-h-[44px] flex items-end">
        {card.value == null ? (
          <span className="text-[20px] font-semibold text-[var(--ink-muted)]">미측정</span>
        ) : (
          <span className="numeral text-[40px] leading-none text-[var(--ink)]">{fmtValue(card)}</span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--line)] space-y-1 text-[13px] text-[var(--ink-muted)] tabular-nums">
        {card.value == null && card.unmeasured_reason && <div>{card.unmeasured_reason}</div>}
        {card.value != null && den && <div>{den}</div>}
        {card.delta != null && <Delta card={card} />}
        {detail && <div>{detail}</div>}
      </div>
    </>
  );
  const cls = `panel !p-4 text-left h-full ${active ? "!border-[var(--ink)] ring-1 ring-[var(--ink)]" : ""}`;
  return onPick ? (
    <button type="button" data-card={card.id} aria-pressed={active} onClick={onPick} className={`${cls} hover:bg-[var(--bg-2)] transition w-full`}>
      {body}
    </button>
  ) : (
    <div data-card={card.id} className={cls}>{body}</div>
  );
}

function Delta({ card }: { card: TuringCard }) {
  const d = card.delta ?? 0;
  const dir = d > 0 ? "up" : d < 0 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const prev = denominator(card, card.prev_denominator);
  return (
    <div data-delta={dir} className="inline-flex items-center gap-1">
      <Icon size={14} aria-label={dir === "up" ? "오름" : dir === "down" ? "내림" : "같음"} />
      <span>{fmtValue({ value: Math.abs(d), unit: card.unit })}{card.unit === "%" && "p"}</span>
      {prev && <span>· 앞 기간 {prev}</span>}
    </div>
  );
}

function Trend({ data, card }: { data: TuringMetricsResponse; card: TuringCard }) {
  const points = data.jobs.map((j) => ({
    name: j.request_id || j.job_id,
    value: j.job_cards?.find((c) => c.id === card.id)?.value ?? null,
  }));
  const missing = points.filter((p) => p.value == null).length;
  return (
    <section data-trend data-metric={card.id} className="mt-12">
      <div className="flex items-center justify-between mb-5">
        <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />분석 건별 추이 · {card.name} ({card.id})</h2>
        <span className="text-[13px] text-[var(--ink-muted)]">분석 건 카드를 누르면 바뀝니다{missing > 0 && ` · 값이 없는 분석 ${missing}건은 선이 끊깁니다`}</span>
      </div>
      <div className="panel">
        {points.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-[var(--ink-muted)]">고른 기간에 분석이 없습니다.</div>
        ) : (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#E5E5EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5A5A66" }} interval={0} tickLine={false} padding={{ left: 48, right: 48 }} />
                <YAxis tick={{ fontSize: 12, fill: "#5A5A66" }} width={48} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [fmtValue({ value: typeof v === "number" ? v : null, unit: card.unit }), card.name]} />
                <Line type="monotone" dataKey="value" stroke="#4F4A9D" strokeWidth={2} dot={{ r: 4, fill: "#4F4A9D" }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
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
    default: return (
      <>
        <div>충실성 점수 {item.score?.toFixed(1)}</div>
        <div className="text-[12.5px] text-[var(--ink-muted)]">검사 {item.checked} · 확인 {item.confirmed}</div>
      </>
    );
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
