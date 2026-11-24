import { AlertTriangle } from "lucide-react";
import { api, asError, isNotFound, type FailedApplicant, type FailureGroup } from "@/lib/api";
import PageHeader from "@/components/page-header";
import JobAutoRefresh from "../auto-refresh";

export const dynamic = "force-dynamic";

export default async function FailuresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const failuresRes = await api.getFailures(id).catch(asError);

  if (failuresRes instanceof Error) {
    return (
      <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto">
        <PageHeader back={{ href: `/jobs/${id}`, label: "분석 보고" }} eyebrow="지원자 분석" title="실패 원인" />
        <div className="mt-10 panel text-center py-16">
          <h2 className="text-[22px] font-bold mb-2">
            {isNotFound(failuresRes) ? "분석을 찾을 수 없습니다." : "실패 원인을 불러오지 못하였습니다."}
          </h2>
          <p className="text-[16px] text-[var(--ink-muted)] tabular-nums">
            {isNotFound(failuresRes) ? id : `잠시 후 새로고침해 주십시오. 분석 번호: ${id}`}
          </p>
        </div>
      </div>
    );
  }

  const { running, total, failed_applicants, failed_attempts, legacy, legacy_count, job_cause, groups } = failuresRes;
  const headline =
    failed_attempts > failed_applicants
      ? `실패 ${failed_applicants}명, 오류 ${failed_attempts}회(전체 ${total}명 중)`
      : `실패 ${failed_applicants}명 (전체 ${total}명 중)`;
  const isEmpty = failed_applicants === 0 && !job_cause;

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      {running && <JobAutoRefresh />}

      <PageHeader
        back={{ href: `/jobs/${id}`, label: "분석 보고" }}
        eyebrow="지원자 분석"
        title="실패 원인"
        description={headline}
      />

      {running && (
        <div className="mt-8 text-[15px] text-[var(--secondary-2)]">
          분석이 진행 중입니다. 현재까지 기록된 실패 내역만 표시합니다.
        </div>
      )}

      {isEmpty ? (
        <div className="mt-10 panel text-center py-16">
          <p className="text-[15px] text-[var(--ink-muted)]">실패한 지원자가 없습니다.</p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-5">
          {job_cause && (
            <div className="panel">
              <div className="panel-head">
                <h2 className="flex items-center gap-2 text-[16px] font-bold">
                  <AlertTriangle size={15} className="text-[var(--bad)]" />
                  {job_cause.title}
                </h2>
              </div>
              <p className="text-[16px] text-[var(--ink-muted)] leading-[1.7]">{job_cause.description}</p>
              <p className="mt-2 text-[13.5px] text-[var(--ink)]">{job_cause.guidance}</p>
              {job_cause.unprocessed_count > 0 && (
                <p className="mt-2 text-[15px] text-[var(--ink-muted)]">
                  분석이 중단되어 {job_cause.unprocessed_count}명을 처리하지 못하였습니다.
                </p>
              )}
              {job_cause.code === "unknown" && job_cause.raw_summary && (
                <details className="mt-3">
                  <summary className="text-[15px] text-[var(--secondary-2)] cursor-pointer">오류 원문 보기</summary>
                  <div className="mt-2 text-[12.5px] tabular-nums text-[var(--ink-muted)] break-all">
                    {job_cause.raw_summary}
                  </div>
                </details>
              )}
            </div>
          )}

          {legacy && (
            <div className="panel">
              <h2 className="text-[16px] font-bold mb-1.5">상세 원인이 기록되지 않은 지원자 {legacy_count}명</h2>
              <p className="text-[16px] text-[var(--ink-muted)]">
                실패 원인 기록 기능 도입 이전에 실행된 분석이거나 기록 저장에 실패한 경우입니다.
              </p>
            </div>
          )}

          {groups.map((group) => (
            <FailureGroupPanel key={group.code} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function FailureGroupPanel({ group }: { group: FailureGroup }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2 className="text-[16px] font-bold">
          {group.title} <span className="text-[var(--ink-muted)] font-normal">{group.count}명</span>
        </h2>
      </div>
      <p className="text-[16px] text-[var(--ink-muted)] leading-[1.7]">{group.description}</p>
      <p className="mt-2 text-[13.5px] text-[var(--ink)]">{group.guidance}</p>

      <div className="mt-4 border-t border-[var(--line)] pt-3">
        <div className="grid grid-cols-12 gap-4 px-1 pb-2 text-[14px] font-semibold tracking-wide text-[var(--ink-muted)]">
          <div className="col-span-3">지원자 번호</div>
          <div className="col-span-3">지원분야</div>
          <div className="col-span-4">마지막 실패 시각</div>
          <div className="col-span-2 text-right">오류 횟수</div>
        </div>
        {group.applicants.map((a) => (
          <ApplicantRow key={a.applicant_id} applicant={a} />
        ))}
      </div>

      {(group.code === "unknown" || group.applicants.some((a) => a.raw_summary)) && (
        <details className="mt-4">
          <summary className="text-[15px] text-[var(--secondary-2)] cursor-pointer">오류 원문 보기</summary>
          <div className="mt-2 flex flex-col gap-1">
            {group.applicants.map((a) => (
              <div key={a.applicant_id} className="text-[12.5px] tabular-nums text-[var(--ink-muted)] break-all">
                {a.applicant_id}: {a.raw_summary ?? "없음"}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const timeText = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ApplicantRow({ applicant }: { applicant: FailedApplicant }) {
  const repeated = applicant.attempt_count > 1;
  return (
    <div className="px-1 py-2 border-b border-[var(--line)] last:border-b-0 text-[13.5px]">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 text-[var(--ink)]">{applicant.applicant_id}</div>
        <div className="col-span-3 text-[var(--ink-muted)]">{applicant.job_field ?? "없음"}</div>
        <div className="col-span-4 tabular-nums text-[var(--ink-muted)]">{timeText(applicant.failed_at)}</div>
        <div className={`col-span-2 text-right tabular-nums ${repeated ? "text-[var(--bad)]" : "text-[var(--ink-muted)]"}`}>
          {applicant.attempt_count}회
        </div>
      </div>
      {repeated && (
        <details className="mt-1.5">
          <summary className="text-[13px] text-[var(--secondary-2)] cursor-pointer">오류 이력 보기</summary>
          <div className="mt-1.5 flex flex-col gap-1">
            {applicant.attempts.map((a, i) => (
              <div key={`${a.failed_at}-${i}`} className="flex gap-3 text-[13px] text-[var(--ink-muted)]">
                <span className="tabular-nums">{timeText(a.failed_at)}</span>
                <span className="text-[var(--ink)]">{a.title}</span>
                {a.raw_summary && <span className="tabular-nums break-all">{a.raw_summary}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
