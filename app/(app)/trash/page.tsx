import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import JobStatusBadge from "@/components/job-status-badge";
import TrashRowActions from "@/components/trash-row-actions";
import PageHeader from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const list = await api.listJobs({ limit: 200, trashed: true }).catch(() => null);
  const jobs = list?.items ?? [];

  return (
    <div className="px-8 lg:px-12 py-9 max-w-[1400px] mx-auto fade-up">
      <PageHeader
        eyebrow="지원자 분석"
        icon={Trash2}
        title="휴지통"
        description="삭제된 분석 작업이 보관됩니다. 복구하거나 영구 삭제할 수 있습니다. 영구 삭제 시 원본 자기소개서·분석 결과·논문·평가가 모두 함께 사라집니다."
      />

      <section className="mt-8">
        {list === null ? (
          <div className="panel py-16 text-center">
            <p className="text-[15px] text-[var(--ink-muted)]">백엔드에 연결할 수 없습니다.</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="panel py-16 text-center">
            <p className="text-[19px] font-bold mb-2">휴지통이 비어있습니다.</p>
            <p className="text-[13.5px] text-[var(--ink-muted)]">삭제된 작업이 여기로 옵니다.</p>
          </div>
        ) : (
          <div className="bg-[var(--paper)] border border-[var(--line-strong)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[var(--bg-2)] border-b border-[var(--line-strong)] text-[12.5px] font-semibold tracking-wide text-[var(--ink-muted)]">
              <div className="col-span-5">작업</div>
              <div className="col-span-2">상태</div>
              <div className="col-span-2 text-right">진행</div>
              <div className="col-span-3 text-right">삭제일 / 작업</div>
            </div>
            {jobs.map((j) => {
              const label = (j.request_id || "").replace(/^excel:/, "") || "이름 없는 배치";
              return (
                <div
                  key={j.job_id}
                  className="grid grid-cols-12 items-center gap-4 px-4 py-4 border-b border-[var(--line)] last:border-b-0"
                >
                  <div className="col-span-5">
                    <div className="text-[15px] font-medium text-[var(--ink-muted)] truncate">{label}</div>
                    <div className="mt-0.5 font-mono text-[12px] text-[var(--ink-soft)]">
                      {j.job_id}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <JobStatusBadge status={j.status} />
                  </div>
                  <div className="col-span-2 text-right text-[14px] tabular-nums text-[var(--ink-muted)]">
                    {j.progress.done} / {j.progress.total}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-3">
                    <span className="text-[12px] text-[var(--ink-soft)] tabular-nums">
                      {j.deleted_at
                        ? new Date(j.deleted_at).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                        : "—"}
                    </span>
                    <TrashRowActions jobId={j.job_id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
