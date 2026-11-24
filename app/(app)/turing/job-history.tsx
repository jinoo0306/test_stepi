"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import type { TuringMetricsResponse } from "@/lib/api";
import { fmtValue, JOB_CARD_IDS } from "./overview";

const COLS = "grid-cols-[minmax(140px,2fr)_48px_64px_64px_92px_repeat(8,minmax(60px,1fr))]";

export default function JobHistory({ data, state }: { data: TuringMetricsResponse | null; state: string | null }) {
  const [q, setQ] = useState("");
  const jobs = data?.jobs ?? [];
  const names = new Map((data?.cards ?? []).map((c) => [c.id, c.name]));
  const needle = q.trim().toLowerCase();
  const rows = [...jobs]
    .reverse()
    .filter((j) => !needle || `${j.request_id ?? ""} ${j.job_id}`.toLowerCase().includes(needle));

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]"><span className="mark" />분석 건별 평가 내역</h2>
        <label className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="공고 이름 또는 요청 번호"
            className="h-10 w-[260px] pl-9 pr-3 text-[14px] border border-[var(--line-strong)] rounded-lg bg-[var(--paper)]"
          />
        </label>
      </div>
      <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-x-auto">
        <div className="min-w-[1000px]">
          <div data-history-head className={`grid ${COLS} gap-2 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[13px] font-semibold text-[var(--ink-muted)]`}>
            <div>요청 번호</div>
            <div className="text-center">상태</div>
            <div className="text-right">처리 인원</div>
            <div className="text-right">처리 시간</div>
            <div>요청 시각</div>
            {JOB_CARD_IDS.map((id) => (
              <div key={id} className="text-right" title={names.get(id)}>
                {id}
                <div className="text-[11.5px] font-normal truncate">{names.get(id)}</div>
              </div>
            ))}
          </div>
          {state ? (
            <div className="py-16 text-center text-[15px] text-[var(--ink-muted)]">{state}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-[15px] text-[var(--ink-muted)]">{needle ? "찾는 분석이 없습니다." : "고른 기간에 분석이 없습니다."}</div>
          ) : rows.map((row) => {
            const cards = new Map(row.job_cards.map((c) => [c.id, c]));
            return (
              <Link
                key={row.job_id}
                data-job-row
                href={`/jobs/${row.job_id}`}
                className={`grid ${COLS} gap-2 items-center px-4 py-3.5 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg-2)] transition text-[14px] tabular-nums`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[var(--ink)]">{row.request_id || row.job_id}</div>
                  <div className="truncate text-[12px] text-[var(--ink-soft)]">{row.job_id}</div>
                </div>
                <div className="text-center text-[13px] text-[var(--ink-muted)]">{statusLabel(row.status)}</div>
                <div className="text-right">{row.applicants_done}/{row.applicants_total}</div>
                <div className="text-right">{row.duration_seconds == null ? "미측정" : `${(row.duration_seconds / 60).toFixed(1)}분`}</div>
                <div className="text-[13px] text-[var(--ink-muted)]">{row.created_at.slice(0, 16).replace("T", " ")}</div>
                {JOB_CARD_IDS.map((id) => {
                  const c = cards.get(id);
                  return (
                    <div key={id} className={`text-right ${c?.value == null ? "text-[var(--ink-muted)]" : ""}`} title={c?.unmeasured_reason ?? undefined}>
                      {c ? fmtValue(c) : "미측정"}
                    </div>
                  );
                })}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "done":
    case "completed": return "완료";
    case "running": return "분석 중";
    case "pending": return "대기";
    case "failed": return "실패";
    case "canceled":
    case "cancelled": return "중단";
    default: return status;
  }
}
