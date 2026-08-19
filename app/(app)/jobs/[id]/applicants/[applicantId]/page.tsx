import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api, feedbackKey } from "@/lib/api";
import RadarCard from "@/components/radar-card";
import FeedbackButtons from "@/components/feedback-buttons";
import RegenerateSummaryButton from "@/components/regenerate-summary-button";
import PapersSection from "@/components/papers-section";
import TimelineSection from "@/components/timeline-section";
import TimelineBar from "@/components/timeline-bar";
import DeptFitV2Section from "@/components/dept-fit-v2-section";
import DetailTabs from "@/components/detail-tabs";
import TalentTypesSection from "@/components/talent-types-section";
import AiUsageSection from "@/components/ai-usage-section";
import { AI_USAGE_MOCK } from "@/lib/ai-usage";
import InterviewQuestionsToggle from "@/components/interview-questions-toggle";
import { cleanReason } from "@/lib/clean-reason";

export const dynamic = "force-dynamic";

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string; applicantId: string }>;
}) {
  const { id, applicantId } = await params;
  const decodedAppId = decodeURIComponent(applicantId);

  const [result, fb, papers, sourceInput, coreBaselineRes] = await Promise.all([
    api.getResult(id).catch(() => null),
    api.listFeedback(id, decodedAppId).catch(() => ({ items: [] as never[] })),
    api.listPapers(id, decodedAppId).catch(() => []),
    api.getSourceInput(id).catch(() => null),
    api.getCorePassedBaseline().catch(() => null),
  ]);
  const coreBaseline = coreBaselineRes?.core_passed_baseline ?? null;
  const sourceApplicant = sourceInput?.applicants.find(
    (a) => a.applicant_id === decodedAppId,
  );

  const applicant = result?.results?.find((r) => r.applicant_id === decodedAppId);

  if (!applicant) {
    return (
      <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto">
        <Link
          href={`/jobs/${id}`}
          className="inline-flex items-center gap-1 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] mb-6 transition"
        >
          <ChevronLeft size={15} /> 분석 보고로 돌아가기
        </Link>
        <div className="panel text-center py-16">
          <h2 className="text-[22px] font-bold mb-2">지원자를 찾을 수 없습니다.</h2>
          <p className="text-[14px] text-[var(--ink-muted)]">{decodedAppId}</p>
        </div>
      </div>
    );
  }

  const fbMap = new Map<string, boolean>();
  for (const f of fb.items) fbMap.set(feedbackKey(f.component, f.item_key), f.rating);
  const fbOf = (component: string, itemKey = ""): boolean | null => {
    const k = feedbackKey(component, itemKey);
    return fbMap.has(k) ? (fbMap.get(k) as boolean) : null;
  };

  const fitVals = Object.values(applicant.scores?.job_fit ?? {});
  // LLM 채점은 1-10 scale 로 들어오지만 UI 는 /100 로 표시 (직군적합도 v2 와 통일).
  const fitAvg100 =
    fitVals.length > 0
      ? (fitVals.reduce((s, v) => s + v.score, 0) / fitVals.length) * 10
      : 0;
  const coreData = Object.entries(applicant.scores?.core_similarity ?? {}).map(([axis, value]) => ({
    axis,
    value: Number(value),
  }));
  const fitData = Object.entries(applicant.scores?.job_fit ?? {}).map(([axis, v]) => ({
    axis,
    value: v.score * 10,
  }));
  // v2 dept-fit (행정직 skip / PDF 미첨부 시 빈 응답)
  const deptFit = await api.getDeptFit(id, decodedAppId).catch(() => null);
  const topDeptV2 = deptFit?.items?.[0];

  // 학술지 게재 요약 — meta_only(PDF 없음) 도 게재 건수에 포함 (상세는 연구실적 탭)
  const analyzedPapers = papers.filter((p) => p.status === "analyzed");

  const deptSub = topDeptV2
    ? `${topDeptV2.score.toFixed(0)}점`
    : deptFit?.skipped
      ? "행정직 미산출"
      : "논문 미첨부";


  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1480px] mx-auto fade-up">
      <Link
        href={`/jobs/${id}`}
        className="inline-flex items-center gap-1 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] mb-5 transition"
      >
        <ChevronLeft size={15} /> 분석 보고로 돌아가기
      </Link>

      {/* ── Highlights 헤더 카드 (Salesforce record highlights: 식별정보 + 핵심 지표 상시 노출) ── */}
      <header className="panel">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="mark" />
              <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                {applicant.job_track}
                {applicant.job_field ? ` · ${applicant.job_field}` : ""}
              </span>
            </div>
            <h1 className="text-[clamp(28px,3.4vw,40px)] font-bold leading-[1.05] tracking-[-0.025em] text-[var(--ink)]">
              {applicant.applicant_id}
            </h1>
          </div>
          <div className="flex items-stretch">
            <HeaderStat label="직무적합 평균" value={fitAvg100.toFixed(0)} unit="/ 100" accent />
            <HeaderStat
              label="AI 문체 유사도"
              value={String(AI_USAGE_MOCK.overall)}
              unit="%"
              sub="시범 표시 (미연동)"
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

      <div className="mt-6">
        <DetailTabs
          essayContent={
            <>
              <div className="mt-6">
                {/* ── 단일 컬럼 — 학력·이력이 가운데로 들어오며 우측 레일 폐지 ── */}
                <div className="min-w-0 flex flex-col gap-5">
                {/* 종합 요약 */}
                <Card
                  title="종합 요약"
                  action={
                    <>
                      <RegenerateSummaryButton jobId={id} applicantId={decodedAppId} />
                      <FeedbackButtons
                        jobId={id}
                        applicantId={decodedAppId}
                        component="summary_overall"
                        initialRating={fbOf("summary_overall")}
                        size="sm"
                      />
                    </>
                  }
                >
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

                {/* 학력 · 이력 — 연혁 바 + 상세 목록 (우측 레일에서 이동) */}
                <Card title="학력 · 이력">
                  <TimelineBar
                    education={sourceApplicant?.education}
                    career={sourceApplicant?.career}
                  />
                  <TimelineSection
                    education={sourceApplicant?.education}
                    career={sourceApplicant?.career}
                  />
                </Card>

                {/* 역량 진단 — radar 2개 나란히 (동일 높이) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 핵심인재 유사도 */}
                {coreData.length > 0 && (
                  <Card
                    title="핵심인재 유사도"
                    desc="합격자들의 자기소개서와 얼마나 닮았는지를 나타냅니다. 연한 음영은 역대 합격자 평균입니다."
                    action={
                      <FeedbackButtons
                        jobId={id}
                        applicantId={decodedAppId}
                        component="core_similarity"
                        initialRating={fbOf("core_similarity")}
                        size="sm"
                      />
                    }
                  >
                    <RadarCard data={coreData} color="#33307A" baseline={coreBaseline} />
                  </Card>
                )}

                {/* 직무 적합도 */}
                {fitData.length > 0 && (
                  <Card
                    title="직무 적합도"
                    desc="직무에서 요구하는 5개 역량을 기준으로 평가한 적합도입니다."
                    action={
                      <FeedbackButtons
                        jobId={id}
                        applicantId={decodedAppId}
                        component="job_fit"
                        initialRating={fbOf("job_fit")}
                        size="sm"
                      />
                    }
                  >
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
                          <div className="col-span-6 lg:col-span-2 serif text-[18px]">{axis}</div>
                          <div className="col-span-6 lg:col-span-1 serif text-[24px] text-[var(--secondary-2)] tabular-nums">
                            {(v.score * 10).toFixed(0)}
                          </div>
                          <p className="col-span-12 lg:col-span-8 text-[14.5px] leading-[1.75] text-[var(--ink-muted)]">
                            {cleanReason(v.reason)}
                          </p>
                          <div className="col-span-12 lg:col-span-1 flex lg:justify-end">
                            <FeedbackButtons
                              jobId={id}
                              applicantId={decodedAppId}
                              component="job_fit"
                              itemKey={axis}
                              initialRating={fbOf("job_fit", axis)}
                              size="sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* 직군 적합도 */}
                <Card
                  title="직군 적합도"
                  action={
                    <FeedbackButtons
                      jobId={id}
                      applicantId={decodedAppId}
                      component="department_fit"
                      initialRating={fbOf("department_fit")}
                      size="sm"
                    />
                  }
                >
                  <DeptFitV2Section jobId={id} applicantId={decodedAppId} />
                </Card>

                {/* AI 문체 유사도 근거 — 헤더 통계줄의 숫자를 풀어서 설명한다.
                    「자기소개서 핵심」 **바로 위**에 둔다. 이건 자소서를 얼마나 믿고 읽을지
                    알려주는 정보라 대상보다 먼저 와야 한다. 문항별 점수를 먼저 보고
                    바로 아래에서 그 문항 내용을 확인하는 동선이 이어진다. */}
                <Card
                  title="AI 문체 유사도 근거"
                  desc="자기소개서 문체가 AI가 쓴 글과 얼마나 닮았는지입니다. 아직 백엔드 미연동 — 점수는 화면 확인용 예시값입니다."
                >
                  <AiUsageSection />
                </Card>

                {/* 자기소개서 핵심 — 문항별로 묶어 정리 */}
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
                          <div
                            key={g.qid}
                            className={gi > 0 ? "pt-7 border-t border-[var(--line)]" : ""}
                          >
                            {/* 문항 헤더 */}
                            <div className="flex items-baseline gap-2.5 mb-3.5">
                              <span className="inline-flex items-center justify-center shrink-0 h-[22px] px-2 rounded-md bg-[var(--p-50)] text-[var(--p-700)] text-[12px] font-bold tabular-nums">
                                Q{String(g.qNum).padStart(2, "0")}
                              </span>
                              <p className="text-[14px] font-medium text-[var(--ink-muted)] leading-[1.5]">
                                {g.question}
                              </p>
                            </div>
                            {/* 항목 — 문항 아래 들여쓰기 + 좌측 라인으로 그룹화 */}
                            <div className="space-y-4 pl-3.5 border-l-2 border-[var(--line)]">
                              {g.items.map((item) => {
                                const itemKey = `${item.question_id}-${item.item_index ?? 0}`;
                                return (
                                  <div key={itemKey} className="flex gap-3 items-start">
                                    <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-[var(--secondary)] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-3">
                                        <h3 className="serif text-[18px] leading-[1.4] text-[var(--ink)]">
                                          {item.title || item.question_id}
                                        </h3>
                                        <FeedbackButtons
                                          jobId={id}
                                          applicantId={decodedAppId}
                                          component="summary_by_question"
                                          itemKey={itemKey}
                                          initialRating={fbOf("summary_by_question", itemKey)}
                                          size="sm"
                                        />
                                      </div>
                                      <p className="mt-1 text-[15.5px] leading-[1.75] text-[var(--ink)]">
                                        {item.content}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </Card>
                )}

                {/* 추천 면접 질문 — 표시 설정에 따라 토글 (메인 컬럼 하단) */}
                {applicant.interview_questions && applicant.interview_questions.length > 0 && (
                  <InterviewQuestionsToggle>
                    <Card title="추천 면접 질문">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        {applicant.interview_questions.map((q, idx) => (
                          <article
                            key={q.id}
                            className="grid grid-cols-[auto_1fr] gap-5 py-5 border-b border-[var(--line)] last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
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
                              <div className="mt-4">
                                <FeedbackButtons
                                  jobId={id}
                                  applicantId={decodedAppId}
                                  component="interview_question"
                                  itemKey={String(q.id)}
                                  initialRating={fbOf("interview_question", String(q.id))}
                                  size="sm"
                                />
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </Card>
                  </InterviewQuestionsToggle>
                )}
                </div>
                {/* /메인 컬럼 */}
              </div>
            </>
          }
          paperContent={
            <Card
              title="학술지 게재 이력"
              className="mt-6"
              action={
                <FeedbackButtons
                  jobId={id}
                  applicantId={decodedAppId}
                  component="research_summary"
                  initialRating={fbOf("research_summary")}
                  size="sm"
                />
              }
            >
              <PapersSection jobId={id} applicantId={decodedAppId} />
            </Card>
          }
          talentContent={
            <Card
              title="인재상 유형 도달도"
              desc="34개 인재상 유형에 대한 지원자의 도달 정도입니다. 아직 백엔드 미연동 — 점수는 화면 확인용 예시값입니다."
              className="mt-6"
            >
              <TalentTypesSection jobId={id} />
            </Card>
          }
        />
      </div>
    </div>
  );
}

/** 카드 — 흰 surface + 액센트 바 마커 헤더 (번호 없이 섹션 구분) */
function Card({
  title,
  desc,
  action,
  className,
  children,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4 pb-3.5 mb-4 border-b border-[var(--line)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="mark" />
            <h2 className="text-[18px] font-bold tracking-[-0.012em] text-[var(--ink)]">{title}</h2>
          </div>
          {desc && (
            <p className="mt-1.5 pl-[14px] text-[13px] text-[var(--ink-muted)] leading-[1.6] max-w-[52ch]">
              {desc}
            </p>
          )}
        </div>
        {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Highlights 헤더의 핵심 지표 셀 (첫 셀은 강조) */
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
