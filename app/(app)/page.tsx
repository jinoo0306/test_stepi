import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";
import JobRowDeleteButton from "@/components/job-row-delete-button";
import PageHeader from "@/components/page-header";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const list = await api.listJobs({ limit: 200 }).catch(() => null);
  const jobs = list?.items ?? [];

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        eyebrow="지원자 분석"
        icon={LayoutDashboard}
        title="분석 현황"
        description="업로드된 자기소개서 배치 단위로 분석 결과를 관리합니다. 새 배치를 시작하거나 진행 상태를 확인할 수 있습니다."
        aside={
          <Link href="/jobs/new" className="btn-primary">
            + 새 분석 시작
          </Link>
        }
      />

      <section className="mt-8">
        <div className="flex items-end justify-between mb-4">
          <h2 className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-0.01em]">
            <span className="mark" />
            분석 작업
            {list && (
              <span className="text-[15px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {list.total}
              </span>
            )}
          </h2>
        </div>

        {list === null ? (
          <div className="panel py-16 text-center">
            <p className="text-[19px] font-bold mb-2">백엔드에 연결할 수 없습니다.</p>
            <p className="text-[13.5px] text-[var(--ink-muted)]">
              잠시 후 다시 시도해주세요.
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="panel py-16 text-center">
            <p className="text-[22px] font-bold mb-3">아직 분석 이력이 없습니다.</p>
            <p className="text-[14px] text-[var(--ink-muted)]">
              자기소개서 xlsx 파일을 업로드하여 첫 분석을 시작해보세요.
            </p>
            <Link href="/jobs/new" className="btn-primary inline-block mt-6">
              자기소개서 업로드
            </Link>
          </div>
        ) : (
          <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 items-center gap-6 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[12.5px] font-semibold tracking-wide text-[var(--ink-muted)]">
              <div className="col-span-5">배치</div>
              <div className="col-span-2">상태</div>
              <div className="col-span-2 text-right">진행</div>
              <div className="col-span-2 text-right">생성일</div>
              <div className="col-span-1"></div>
            </div>
            {jobs.map((j) => {
              const label = (j.request_id || "").replace(/^excel:/, "") || "이름 없는 배치";
              return (
                <Link
                  key={j.job_id}
                  href={`/jobs/${j.job_id}`}
                  className="grid grid-cols-12 items-center gap-6 px-4 py-4 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--bg-2)] transition group"
                >
                  <div className="col-span-5">
                    <div className="text-[16.5px] font-medium text-[var(--ink)] group-hover:underline underline-offset-4 decoration-[var(--secondary)] truncate">
                      {label}
                    </div>
                    <div className="mt-0.5 font-mono text-[12.5px] text-[var(--ink-soft)]">
                      {j.job_id}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <JobStatusBadge status={j.status} />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-[16.5px] font-medium text-[var(--ink)] tabular-nums">
                      {j.progress.done}
                      <span className="text-[var(--ink-muted)] font-normal"> / {j.progress.total}</span>
                    </span>
                    {j.progress.failed > 0 && (
                      <div className="text-[12.5px] text-[var(--bad)] mt-0.5">
                        실패 {j.progress.failed}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-right text-[13.5px] text-[var(--ink-muted)] tabular-nums">
                    {new Date(j.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <JobRowDeleteButton jobId={j.job_id} label={label} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
