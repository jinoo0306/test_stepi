import Link from "next/link";
import { ArrowUpRight, Download, LayoutDashboard } from "lucide-react";
import { api, asError, failedLabel, isNotFound, type JobFailuresResponse } from "@/lib/api";
import ApplicantDeleteButton from "@/components/applicant-delete-button";
import ApplicantPdfButton from "@/components/applicant-pdf-button";
import BulkPdfButton from "@/components/bulk-pdf-button";
import JobStatusBadge from "@/components/job-status-badge";
import PageHeader from "@/components/page-header";
import JobAutoRefresh from "./auto-refresh";
import AnalyzingIndicator from "@/components/analyzing-indicator";
import JobControlButtons from "@/components/job-control-buttons";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prelim?: string }>;
}) {
  const { id } = await params;
  // 신규 분석 생성에서 사전스크리닝 검토도 함께 만들었으면 그 검토 번호가 주소에 옴(PRELIM-003)
  const { prelim: prelimTicket } = await searchParams;
  const statusRes = await api.getStatus(id).catch(asError);
  const status = statusRes instanceof Error ? null : statusRes;
  // 진행 중(running/pending)이어도 그때까지 끝난 지원자 부분 결과를 같이 가져옴
  const resultRes =
    status && (status.progress.done > 0 || status.status === "done" || status.status === "failed")
      ? await api.getResult(id).catch(asError)
      : null;
  const resultFailed = resultRes instanceof Error;
  const result = resultFailed ? null : resultRes;

  // 첫 지원자 전에 크래시하거나 등록에 실패하면 failed_count 는 0 이지만 error 는 있음
  const showFailure =
    !!status &&
    (status.progress.failed > 0 || status.status === "failed" || !!status.error);
  const failures = showFailure ? await api.getFailures(id).catch(() => null) : null;

  // v2 dept-fit + 논문 분석 상태를 단일 배치 endpoint 로 한 번에 fetch (N+1 회피)
  const summaryRes = await api.applicantsSummary(id).catch(asError);
  const summaryFailed = summaryRes instanceof Error;
  const summary = summaryFailed ? [] : summaryRes;
  const perApplicantById = new Map(
    summary.map((s) => [
      s.applicant_id,
      {
        applicantId: s.applicant_id,
        analyzed: s.papers_analyzed,
        totalPapers: s.papers_total,
        topDept: s.top_dept,
        deptSkipped: s.dept_skipped,
      },
    ]),
  );

  if (!status) {
    return (
      <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto">
        <PageHeader back={{ href: "/jobs", label: "분석 목록" }} eyebrow="지원자 분석" title="분석 보고" />
        <div className="mt-10 panel text-center py-16">
          <h2 className="text-[22px] font-bold mb-2">
            {isNotFound(statusRes) ? "분석을 찾을 수 없습니다." : "분석 정보를 불러오지 못하였습니다."}
          </h2>
          <p className="text-[14px] text-[var(--ink-muted)] tabular-nums">
            {isNotFound(statusRes) ? id : `잠시 후 새로고침해 주십시오. 분석 번호: ${id}`}
          </p>
        </div>
      </div>
    );
  }

  const isRunning = status.status === "running" || status.status === "pending";
  const pct = status.progress.total ? (status.progress.done / status.progress.total) * 100 : 5;

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      {isRunning && <JobAutoRefresh />}

      <PageHeader
        back={{ href: "/jobs", label: "분석 목록" }}
        eyebrow="지원자 분석"
        icon={LayoutDashboard}
        title="분석 보고"
        description={(status.request_id || "").replace(/^excel:/, "") || undefined}
        aside={
          <div className="w-[min(280px,80vw)] panel-soft flex flex-col gap-3.5">
            <Stat label="상태" valueNode={<JobStatusBadge status={status.status} />} />
            <Stat
              label="진행"
              valueNode={
                <span className="text-[20px] font-semibold text-[var(--ink)] tabular-nums">
                  {status.progress.done}
                  <span className="text-[var(--ink-muted)] font-normal"> / {status.progress.total}</span>
                </span>
              }
              sub={failedLabel(status.progress) ?? undefined}
            />
            <Stat
              label="생성 일시"
              valueNode={
                <span className="text-[14px] tabular-nums text-[var(--ink)]">
                  {new Date(status.created_at).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              }
            />
            <div className="pt-1 border-t border-[var(--line)]">
              <JobControlButtons jobId={id} status={status.status} />
            </div>
          </div>
        }
      />

      {prelimTicket && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-[15px] text-[var(--ink-muted)] bg-[var(--bg-2)] border border-[var(--line)] rounded-lg px-3.5 py-2.5">
          <span>사전스크리닝 검토도 만들었습니다.</span>
          <Link className="underline text-[var(--ink)]" href={`/prelim/${encodeURIComponent(prelimTicket)}`}>
            검토 결과 보기
          </Link>
        </div>
      )}

      {!!status.warnings?.length && (
        <div role="note" className="mt-8 border-l-2 border-[var(--gold)] pl-4 py-2">
          <div className="text-[15px] text-[var(--ink)] font-bold mb-1">입력 안내</div>
          <ul className="text-[16px] text-[var(--ink-muted)] space-y-1 break-words">
            {status.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {showFailure && (
        <div className="mt-8 border-l-2 border-[var(--bad)] pl-4 py-2 flex items-start justify-between gap-4">
          <div>
            <div className="text-[15px] text-[var(--bad)] font-bold mb-1">
              {status.status === "failed" ? "분석 실패" : "일부 지원자 분석 실패"}
            </div>
            <div className="text-[16px] text-[var(--ink-muted)]">
              {failureSummaryLine(failures)}
            </div>
          </div>
          <Link
            href={`/jobs/${id}/failures`}
            className="shrink-0 text-[15px] font-medium text-[var(--secondary-2)] hover:underline underline-offset-4 whitespace-nowrap"
          >
            실패 원인 보기
          </Link>
        </div>
      )}

      {isRunning && (
        <section className="mt-10 grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 lg:col-span-3 text-[14px] text-[var(--ink)]">
            <AnalyzingIndicator text="분석 중" />
          </div>
          <div className="col-span-12 lg:col-span-9">
            <div className="flex items-baseline justify-between mb-2 text-[13px] text-[var(--ink-muted)]">
              <span>진행률</span>
              <span className="text-[var(--ink)] tabular-nums">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-px w-full bg-[var(--line)]">
              <div
                className="h-px bg-[var(--ink)] transition-[width] duration-700"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {resultFailed && (
        <div className="mt-10 panel text-center py-12">
          <p className="text-[17px] font-bold mb-2">지원자 명부를 불러오지 못하였습니다.</p>
          <p className="text-[13.5px] text-[var(--ink-muted)]">잠시 후 새로고침해 주십시오.</p>
        </div>
      )}

      {result?.results && (
        <>
          <div className="flex items-end justify-between mt-10 mb-4">
            <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]">
              <span className="mark" />
              지원자 명부
              <span className="text-[15px] font-semibold text-[var(--ink-muted)]">
                {result.results.length}명
                {isRunning && status.progress.total > result.results.length && (
                  <span className="ml-2 text-[var(--secondary-2)]">
                    · 분석 중 (전체 {status.progress.total}명, 잠시 후 자동 갱신)
                  </span>
                )}
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <a href={api.resultCsvUrl(id)} className="btn-ghost inline-flex items-center gap-2" target="_blank" rel="noreferrer">
                <Download size={13} /> CSV
              </a>
              <BulkPdfButton jobId={id} />
            </div>
          </div>

          <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--line-strong)] text-[12.5px] font-semibold tracking-wide text-[var(--ink-muted)] bg-[var(--bg-2)]">
              <div className="col-span-1">No.</div>
              <div className="col-span-3">지원자</div>
              <div className="col-span-2 text-right">직무적합 평균</div>
              <div className="col-span-1 text-center">게재</div>
              <div className="col-span-4">종합 요약</div>
              <div className="col-span-1"></div>
            </div>
            {result.results.map((a, i) => {
              const fitVals = Object.values(a.scores?.job_fit ?? {});
              const fitAvg100 =
                fitVals.length > 0
                  ? (fitVals.reduce((s, v) => s + v.score, 0) / fitVals.length) * 10
                  : null;
              const meta = perApplicantById.get(a.applicant_id);
              return (
                <Link
                  key={a.applicant_id}
                  href={`/jobs/${id}/applicants/${encodeURIComponent(a.applicant_id)}`}
                  className="grid grid-cols-12 gap-4 items-center px-4 py-4 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg-2)] group transition"
                >
                  <div className="col-span-1 text-[13.5px] tabular-nums text-[var(--ink-muted)]">
                    {String(i + 1).padStart(3, "0")}
                  </div>
                  <div className="col-span-3">
                    <div className="text-[16.5px] font-medium text-[var(--ink)] group-hover:underline underline-offset-4 decoration-[var(--secondary)]">
                      {a.applicant_id}
                    </div>
                    {a.job_field && (
                      <div className="text-[16.5px] text-[var(--ink-soft)] mt-0.5">
                        {a.job_field}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    {fitAvg100 == null ? (
                      <span className="text-[14px] text-[var(--ink-soft)]">미산출</span>
                    ) : (
                      <>
                        <span className="serif text-[22px] text-[var(--ink)] tabular-nums">
                          {fitAvg100.toFixed(0)}
                        </span>
                        <span className="text-[12.5px] text-[var(--ink-muted)] ml-1">/ 100</span>
                      </>
                    )}
                  </div>
                  <div className="col-span-1 text-center text-[13.5px] tabular-nums">
                    {summaryFailed ? (
                      <span className="text-[var(--ink-soft)]" title="게재 현황을 불러오지 못하였습니다">확인 불가</span>
                    ) : meta && meta.totalPapers > 0 ? (
                      <span className="text-[var(--ink)]">
                        {meta.analyzed}/{meta.totalPapers}
                      </span>
                    ) : (
                      <span className="text-[var(--ink-soft)]">없음</span>
                    )}
                  </div>
                  <div className="col-span-4 text-[16px] leading-[1.55] text-[var(--ink-muted)] line-clamp-2">
                    {a.summary?.overall || (
                      <span className="text-[var(--ink-soft)]">미산출</span>
                    )}
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <ApplicantPdfButton jobId={id} applicantId={a.applicant_id} />
                    <ApplicantDeleteButton jobId={id} applicantId={a.applicant_id} />
                    <ArrowUpRight
                      size={14}
                      strokeWidth={1.6}
                      className="text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 transition"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function failureSummaryLine(failures: JobFailuresResponse | null): string {
  if (!failures) return "분석 중 오류가 발생하였습니다.";
  if (failures.job_cause) {
    return `${failures.job_cause.title}. ${failures.job_cause.description}`;
  }
  if (failures.groups.length > 0) {
    const top = failures.groups.reduce((a, b) => (b.count > a.count ? b : a));
    return `실패 ${failures.failed_applicants}명, 가장 많은 원인은 ${top.title}입니다.`;
  }
  if (failures.legacy) {
    return `상세 원인이 기록되지 않은 지원자 ${failures.legacy_count}명`;
  }
  return "분석 중 오류가 발생하였습니다.";
}

function Stat({
  label,
  valueNode,
  sub,
}: {
  label: string;
  valueNode: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="border-b border-[var(--line)] pb-3 flex items-baseline justify-between gap-3">
      <div className="text-[13px] text-[var(--ink-muted)]">{label}</div>
      <div className="text-right">
        {valueNode}
        {sub && <div className="text-[12px] text-[var(--bad)] mt-1">{sub}</div>}
      </div>
    </div>
  );
}


