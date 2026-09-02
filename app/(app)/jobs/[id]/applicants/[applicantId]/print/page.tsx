import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api, type PaperDetail } from "@/lib/api";
import RadarCard from "@/components/radar-card";
import PapersPrintList from "@/components/papers-print-list";
import TimelineSection from "@/components/timeline-section";
import TimelineBar from "@/components/timeline-bar";
import DeptFitList from "@/components/dept-fit-list";
import PrintAuto from "@/components/print-auto";
import PrintButton from "@/components/print-button";
import AiUsageSection from "@/components/ai-usage-section";
import { MockBadge } from "@/components/mock-mark";
import TalentTypesSection from "@/components/talent-types-section";
import { aiUsageHeadline } from "@/lib/ai-usage";
import { cleanReason } from "@/lib/clean-reason";

export const dynamic = "force-dynamic";

const aiUsageHead = aiUsageHeadline();

/**
 * 지원자 1명 인쇄(PDF) 화면.
 *
 * 지원자 상세 대시보드와 같은 카드·색·차트를 그대로 쓰되, 탭을 없애 한 장으로 펼치고
 * 버튼류(피드백·재계산·업로드)를 뺐다. 브라우저 인쇄로 저장하므로 화면과 결과가 같다.
 * 아직 목업인 AI 사용 의심도와 인재상 유형도 함께 싣되, 화면과 같은 미개발 배지를 붙인다.
 */
export default async function ApplicantPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; applicantId: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id, applicantId } = await params;
  const { auto } = await searchParams;
  const decodedAppId = decodeURIComponent(applicantId);

  const [result, papers, sourceInput, coreBaselineRes, deptFit] = await Promise.all([
    api.getResult(id).catch(() => null),
    api.listPapers(id, decodedAppId).catch(() => []),
    api.getSourceInput(id).catch(() => null),
    api.getCorePassedBaseline().catch(() => null),
    api.getDeptFit(id, decodedAppId).catch(() => null),
  ]);

  const applicant = result?.results?.find((r) => r.applicant_id === decodedAppId);

  if (!applicant) {
    return (
      <div className="px-8 py-9 max-w-3xl mx-auto">
        <div className="panel text-center py-16">
          <h2 className="text-[22px] font-bold mb-2">지원자를 찾을 수 없습니다.</h2>
          <p className="text-[14px] text-[var(--ink-muted)]">{decodedAppId}</p>
        </div>
      </div>
    );
  }

  // 논문 상세는 인쇄 시점에 서버에서 한 번에 가져온다 (화면처럼 열어봐야 채워지면 안 된다)
  const paperDetails: Record<number, PaperDetail | null> = {};
  const analyzedFileIds = papers
    .filter((p) => p.status === "analyzed" && p.file_id != null)
    .map((p) => p.file_id as number);
  const fetched = await Promise.all(
    analyzedFileIds.map((fileId) =>
      api.getPaperDetail(id, decodedAppId, fileId).catch(() => null),
    ),
  );
  analyzedFileIds.forEach((fileId, i) => {
    paperDetails[fileId] = fetched[i];
  });

  const coreBaseline = coreBaselineRes?.core_passed_baseline ?? null;
  const sourceApplicant = sourceInput?.applicants.find((a) => a.applicant_id === decodedAppId);

  const fitVals = Object.values(applicant.scores?.job_fit ?? {});
  const fitAvg100 =
    fitVals.length > 0 ? (fitVals.reduce((s, v) => s + v.score, 0) / fitVals.length) * 10 : 0;
  const coreData = Object.entries(applicant.scores?.core_similarity ?? {}).map(([axis, value]) => ({
    axis,
    value: Number(value),
  }));
  const fitData = Object.entries(applicant.scores?.job_fit ?? {}).map(([axis, v]) => ({
    axis,
    value: v.score * 10,
  }));

  const topDeptV2 = deptFit?.items?.[0];
  const analyzedPapers = papers.filter((p) => p.status === "analyzed");
  const deptSub = topDeptV2
    ? `${topDeptV2.score.toFixed(0)}점`
    : deptFit?.skipped
      ? "행정직 미산출"
      : "논문 미첨부";

  const printedAt = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-page px-6 lg:px-10 py-8 max-w-[1480px] mx-auto">
      {auto === "1" && <PrintAuto />}

      {/* 화면에서만 보이는 안내 줄 — 인쇄물에는 나오지 않는다 */}
      <div data-print-hide className="flex items-center justify-between gap-4 mb-5">
        <Link
          href={`/jobs/${id}/applicants/${encodeURIComponent(decodedAppId)}`}
          className="inline-flex items-center gap-1 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
        >
          <ChevronLeft size={15} /> 지원자 화면으로 돌아가기
        </Link>
        <PrintButton />
      </div>

      <header className="panel print-block">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="mark" />
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                {applicant.job_track}
                {applicant.job_field ? ` · ${applicant.job_field}` : ""}
              </span>
            </div>
            <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.025em] text-[var(--ink)]">
              {applicant.applicant_id}
            </h1>
            <p className="mt-2 text-[12px] text-[var(--ink-soft)]">
              출력 {printedAt} · 분석 {id}
            </p>
          </div>
          <div className="flex items-stretch">
            <HeaderStat label="직무적합 평균" value={fitAvg100.toFixed(0)} unit="/ 100" accent />
            <HeaderStat
              label="AI 사용 의심도"
              value={aiUsageHead.value}
              unit={aiUsageHead.unit}
              sub={aiUsageHead.sub}
            />
            <HeaderStat label="상위 부서" value={topDeptV2?.dept_name ?? "—"} sub={deptSub} text />
            <HeaderStat
              label="학술지 게재"
              value={String(papers.length)}
              unit="건"
              sub={papers.length > 0 ? `PDF ${analyzedPapers.length}/${papers.length}` : "이력 없음"}
            />
          </div>
        </div>
      </header>

      <div className="mt-5 flex flex-col gap-5">
        {/* 종합 요약 */}
        <Card title="종합 요약">
          {applicant.summary?.overall && (
            <p className="serif text-[20px] leading-[1.55] tracking-[-0.005em] text-[var(--ink)]">
              {applicant.summary.overall}
            </p>
          )}
          {applicant.summary?.overall_lines && (
            <ul className="mt-6 space-y-3">
              {applicant.summary.overall_lines.map((line, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-3.5 items-baseline">
                  <span className="text-[13px] text-[var(--secondary-2)] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15.5px] leading-[1.8] text-[var(--ink)]">{line}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 학력 · 이력 */}
        <Card title="학력 · 이력">
          <TimelineBar education={sourceApplicant?.education} career={sourceApplicant?.career} />
          <TimelineSection education={sourceApplicant?.education} career={sourceApplicant?.career} />
        </Card>

        {/* 역량 진단 */}
        <div className="grid grid-cols-2 gap-5">
          {coreData.length > 0 && (
            <Card
              title="핵심인재 유사도"
              desc="합격자들의 자기소개서와 얼마나 닮았는지를 나타냅니다. 연한 음영은 역대 합격자 평균입니다."
            >
              <RadarCard data={coreData} color="#33307A" baseline={coreBaseline} />
            </Card>
          )}
          {fitData.length > 0 && (
            <Card title="직무 적합도" desc="직무에서 요구하는 5개 역량을 기준으로 평가한 적합도입니다.">
              <RadarCard data={fitData} color="#F39200" max={100} />
            </Card>
          )}
        </div>

        {/* 직무적합 역량별 근거 */}
        {fitData.length > 0 && (
          <Card title="직무적합 역량별 근거">
            <div>
              {Object.entries(applicant.scores?.job_fit ?? {}).map(([axis, v], idx) => (
                <div
                  key={axis}
                  className={`grid grid-cols-12 gap-x-6 gap-y-2 py-4 items-baseline ${idx > 0 ? "border-t border-[var(--line)]" : ""}`}
                >
                  <div className="col-span-2 serif text-[18px]">{axis}</div>
                  <div className="col-span-1 serif text-[24px] text-[var(--secondary-2)] tabular-nums">
                    {(v.score * 10).toFixed(0)}
                  </div>
                  <p className="col-span-9 text-[14.5px] leading-[1.75] text-[var(--ink-muted)]">
                    {cleanReason(v.reason)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 직군 적합도 */}
        <Card title="직군 적합도">
          {deptFit?.skipped ? (
            <p className="text-[13px] text-[var(--ink-muted)] italic">
              {deptFit.skipped_reason ?? "행정직은 직군 적합도 산출 대상이 아닙니다."}
            </p>
          ) : deptFit && deptFit.items.length > 0 ? (
            <DeptFitList items={deptFit.items} computedAt={deptFit.computed_at} />
          ) : (
            <p className="text-[13px] text-[var(--ink-muted)]">
              아직 채점 결과가 없습니다. 자기소개서와 분석된 논문이 모두 준비되면 자동 산출됩니다.
            </p>
          )}
        </Card>

        {/* AI 사용 의심도 근거 — 대시보드와 같은 자리(자기소개서 핵심 바로 위) */}
        <Card
          title="AI 사용 의심도 근거"
          badge={<MockBadge />}
          desc="자기소개서 문체와 문장 흐름을 보고 AI가 썼는지 가늠합니다. 만들 지표 목록입니다."
        >
          <AiUsageSection />
        </Card>

        {/* 자기소개서 핵심 */}
        {applicant.summary?.by_question && applicant.summary.by_question.length > 0 && (
          <Card title="자기소개서 핵심">
            <div className="space-y-7">
              {(() => {
                const rows = applicant.summary.by_question;
                const order: {
                  qid: string;
                  qNum: number;
                  question: string;
                  items: typeof rows;
                }[] = [];
                const map = new Map<string, (typeof order)[number]>();
                rows.forEach((q) => {
                  let g = map.get(q.question_id);
                  if (!g) {
                    g = { qid: q.question_id, qNum: order.length + 1, question: q.question, items: [] };
                    map.set(q.question_id, g);
                    order.push(g);
                  }
                  g.items.push(q);
                });
                return order.map((g, gi) => (
                  <div key={g.qid} className={gi > 0 ? "pt-7 border-t border-[var(--line)]" : ""}>
                    <div className="flex items-baseline gap-2.5 mb-3.5">
                      <span className="inline-flex items-center justify-center shrink-0 h-[22px] px-2 rounded-md bg-[var(--p-50)] text-[var(--p-700)] text-[12px] font-bold tabular-nums">
                        Q{String(g.qNum).padStart(2, "0")}
                      </span>
                      <p className="text-[14px] font-medium text-[var(--ink-muted)] leading-[1.5]">
                        {g.question}
                      </p>
                    </div>
                    <div className="space-y-4 pl-3.5 border-l-2 border-[var(--line)]">
                      {g.items.map((item) => (
                        <div
                          key={`${item.question_id}-${item.item_index ?? 0}`}
                          className="flex gap-3 items-start"
                        >
                          <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-[var(--secondary)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="serif text-[18px] leading-[1.4] text-[var(--ink)]">
                              {item.title || item.question_id}
                            </h3>
                            <p className="mt-1 text-[15.5px] leading-[1.75] text-[var(--ink)]">
                              {item.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Card>
        )}

        {/* 추천 면접 질문 — 화면에서는 표시 설정에 따라 접히지만 인쇄물에는 항상 넣는다 */}
        {applicant.interview_questions && applicant.interview_questions.length > 0 && (
          <Card title="추천 면접 질문">
            <div className="grid grid-cols-2 gap-x-8">
              {applicant.interview_questions.map((q, idx) => (
                <article
                  key={q.id}
                  className="grid grid-cols-[auto_1fr] gap-5 py-5 border-b border-[var(--line)] last:border-b-0"
                >
                  <div className="serif text-[26px] leading-none text-[var(--ink-muted)] tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <p className="text-[16px] leading-[1.6] text-[var(--ink)]">{q.question}</p>
                    {(q.intent || q.topic_tag) && (
                      <div className="mt-3 text-[12.5px] text-[var(--ink-muted)] leading-[1.6] flex flex-wrap items-center gap-2">
                        {q.topic_tag && (
                          <span className="inline-block px-2 py-0.5 rounded-full border border-[var(--line-strong)] text-[11px]">
                            {q.topic_tag}
                          </span>
                        )}
                        {q.intent && <span>{q.intent}</span>}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Card>
        )}

        {/* 학술지 게재 이력 — 화면에서는 별도 탭 */}
        {papers.length > 0 && (
          <Card title="학술지 게재 이력">
            <PapersPrintList
              files={papers}
              details={paperDetails}
              jobId={id}
              applicantId={decodedAppId}
            />
          </Card>
        )}

        {/* 인재상 유형 — 화면에서는 별도 탭. 인쇄에서는 34개를 처음부터 펼친다 */}
        <TalentTypesSection jobId={id} applicantId={decodedAppId} printMode />
      </div>
    </div>
  );
}

/** 상세 화면의 Card 와 같은 모양. 인쇄에서 카드가 페이지 경계에 걸리지 않게 print-block 을 붙인다 */
function Card({
  title,
  badge,
  desc,
  children,
}: {
  title: string;
  /** 제목 옆 표식 */
  badge?: React.ReactNode;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel print-block">
      <div className="flex items-start justify-between gap-4 pb-3.5 mb-4 border-b border-[var(--line)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mark" />
            <h2 className="text-[18px] font-bold tracking-[-0.012em] text-[var(--ink)]">{title}</h2>
            {badge}
          </div>
          {desc && (
            <p className="mt-1.5 text-[14px] text-[var(--ink-muted)] leading-[1.6] break-keep">
              {desc}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function HeaderStat({
  label,
  value,
  unit,
  sub,
  accent,
  text,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
  text?: boolean;
}) {
  return (
    <div className="px-5 first:pl-0 last:pr-0 border-l border-[var(--line)] first:border-l-0 min-w-0">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-muted)] mb-1.5">
        {label}
      </div>
      <div
        className={`leading-none truncate max-w-[180px] ${
          accent
            ? "text-[30px] font-extrabold text-[var(--secondary-2)] tabular-nums"
            : text
              ? "text-[18px] font-bold text-[var(--ink)]"
              : "text-[26px] font-extrabold text-[var(--ink)] tabular-nums"
        }`}
        title={value}
      >
        {value}
        {unit && <span className="text-[13px] font-semibold text-[var(--ink-muted)] ml-1">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-[var(--ink-muted)] truncate max-w-[180px]">{sub}</div>}
    </div>
  );
}
