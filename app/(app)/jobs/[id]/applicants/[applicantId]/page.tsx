import AiDetectionButton from "@/components/ai-detection-button";
import Link from "next/link";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { api, asError, feedbackKey, isNotFound } from "@/lib/api";
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
import { ExperimentalBadge } from "@/components/mock-mark";
import { aiUsageHeadline } from "@/lib/ai-usage";
import InterviewQuestionsToggle from "@/components/interview-questions-toggle";
import { cleanReason } from "@/lib/clean-reason";
import ApplicantPdfButton from "@/components/applicant-pdf-button";

export const dynamic = "force-dynamic";



export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string; applicantId: string }>;
}) {
  const { id, applicantId } = await params;
  const decodedAppId = decodeURIComponent(applicantId);

  const [resultRes, fb, papersRes, sourceInputRes, coreBaselineRes, jobStatus] = await Promise.all([
    api.getResult(id).catch(asError),
    api.listFeedback(id, decodedAppId).catch(() => ({ items: [] as never[] })),
    api.listPapers(id, decodedAppId).catch(asError),
    api.getSourceInput(id).catch(asError),
    api.getCorePassedBaseline().catch(asError),
    api.getStatus(id).catch(() => null),
  ]);
  const papersFailed = papersRes instanceof Error;
  const papers = papersFailed ? [] : papersRes;
  const sourceFailed = sourceInputRes instanceof Error;
  const baselineFailed = coreBaselineRes instanceof Error;
  const coreBaseline = baselineFailed ? null : coreBaselineRes.core_passed_baseline;
  const hasBaseline = coreBaseline != null && Object.keys(coreBaseline).length > 0;
  const sourceApplicant = sourceFailed
    ? undefined
    : sourceInputRes.applicants.find((a) => a.applicant_id === decodedAppId);

  // 404 가 아닌 조회 실패를 "찾을 수 없습니다"로 보이면 담당자가 지원자가 지워졌다고 오해함
  if (resultRes instanceof Error && !isNotFound(resultRes)) {
    return (
      <div className="px-8 lg:px-12 py-9 max-w-3xl mx-auto">
        <Link
          href={`/jobs/${id}`}
          className="inline-flex items-center gap-1 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] mb-6 transition"
        >
          <ChevronLeft size={15} /> 분석 보고로 돌아가기
        </Link>
        <div className="panel text-center py-16">
          <h2 className="text-[22px] font-bold mb-2">지원자 정보를 불러오지 못하였습니다.</h2>
          <p className="text-[14px] text-[var(--ink-muted)]">잠시 후 새로고침해 주십시오. 지원자 번호: {decodedAppId}</p>
        </div>
      </div>
    );
  }
  const applicant =
    resultRes instanceof Error ? undefined : resultRes.results?.find((r) => r.applicant_id === decodedAppId);

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

  const aiUsageHead = aiUsageHeadline(applicant.ai_detection);
  const fitVals = Object.values(applicant.scores?.job_fit ?? {});
  // LLM 채점은 1-10 scale 로 들어오지만 UI 는 /100 로 표시 (직군적합도 v2 와 통일)
  const fitAvg100 =
    fitVals.length > 0
      ? (fitVals.reduce((s, v) => s + v.score, 0) / fitVals.length) * 10
      : null;
  const coreData = Object.entries(applicant.scores?.core_similarity ?? {}).map(([axis, value]) => ({
    axis,
    value: Number(value),
  }));
  const fitData = Object.entries(applicant.scores?.job_fit ?? {}).map(([axis, v]) => ({
    axis,
    value: v.score * 10,
  }));
  // v2 dept-fit (행정직 skip / PDF 미첨부 시 빈 응답)
  const deptFitRes = await api.getDeptFit(id, decodedAppId).catch(asError);
  const deptFit = deptFitRes instanceof Error ? null : deptFitRes;
  const topDeptV2 = deptFit?.items?.[0];

  // 학술지 게재 요약: meta_only(PDF 없음) 도 게재 건수에 포함 (상세는 연구실적 탭)
  const analyzedPapers = papers.filter((p) => p.status === "analyzed");

  // 채점 전·조회 실패를 "논문 미첨부"로 단정하지 않음
  const deptStat = topDeptV2
    ? { value: topDeptV2.dept_name, sub: `${topDeptV2.score.toFixed(0)}점` }
    : !deptFit
      ? { value: "불러오지 못하였습니다", muted: true }
      : deptFit.skipped
        ? { value: "미산출", sub: "행정직 미산출", muted: true }
        : { value: "미산출", sub: "채점 결과가 없습니다", muted: true };


  return (
    <div className="px-6 lg:px-10 py-8 max-w-[1480px] mx-auto fade-up">
      <div className="flex items-center justify-between gap-4 mb-5">
        <Link
          href={`/jobs/${id}`}
          className="inline-flex items-center gap-1 text-[13.5px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
        >
          <ChevronLeft size={15} /> 분석 보고로 돌아가기
        </Link>
        <ApplicantPdfButton jobId={id} applicantId={decodedAppId} variant="button" />
      </div>

      {/* --- Highlights 헤더 카드 (Salesforce record highlights: 식별정보 + 핵심 지표 상시 노출) --- */}
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
            {fitAvg100 == null ? (
              <HeaderStat label="직무적합 평균" value="미산출" muted />
            ) : (
              <HeaderStat label="직무적합 평균" value={fitAvg100.toFixed(0)} unit="/ 100" accent />
            )}
            <HeaderStat
              label="AI 사용 의심도"
              value={aiUsageHead.value}
              unit={aiUsageHead.unit}
              sub={aiUsageHead.sub}
              muted
            />
            <HeaderStat label="상위 부서" text {...deptStat} />
            {papersFailed ? (
              <HeaderStat label="학술지 게재" value="불러오지 못하였습니다" muted />
            ) : (
              <HeaderStat
                label="학술지 게재"
                value={String(papers.length)}
                unit="건"
                sub={papers.length > 0 ? `PDF ${analyzedPapers.length}/${papers.length}` : "이력 없음"}
              />
            )}
          </div>
        </div>
      </header>

      <div className="mt-6">
        <DetailTabs
          essayContent={
            <>
              <div className="mt-6">
                {/* --- 단일 컬럼: 학력·이력이 가운데로 들어오며 우측 레일 폐지 --- */}
                <div className="min-w-0 flex flex-col gap-5">
                <SuspectCard items={(applicant as { input_suspects?: Suspect[] }).input_suspects} />
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
                  {!applicant.summary?.overall && !applicant.summary?.overall_lines?.length && (
                    <p className="text-[15px] text-[var(--ink-muted)]">산출된 결과가 없습니다.</p>
                  )}
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

                {/* 학력 · 이력: 연혁 바 + 상세 목록 (우측 레일에서 이동) */}
                <Card title="학력 · 이력">
                  {sourceFailed ? (
                    <p className="text-[15px] text-[var(--ink-muted)]">학력·이력을 불러오지 못하였습니다. 잠시 후 새로고침해 주십시오.</p>
                  ) : (
                    <>
                      <TimelineBar
                        education={sourceApplicant?.education}
                        career={sourceApplicant?.career}
                      />
                      <TimelineSection
                        education={sourceApplicant?.education}
                        career={sourceApplicant?.career}
                      />
                    </>
                  )}
                </Card>

                {/* 역량 진단: radar 2개 나란히 (동일 높이) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 핵심인재 유사도. 점수가 없어도 카드를 남겨 빠진 이유를 적음 */}
                {coreData.length > 0 ? (
                  <Card
                    title="핵심인재 유사도"
                    desc={`합격자 자기소개서와 비슷한 정도를 나타냅니다.\n${baselineNote(hasBaseline, baselineFailed)}`}
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
                ) : (
                  <Card title="핵심인재 유사도" desc="합격자 자기소개서와 비슷한 정도를 나타냅니다.">
                    <p className="text-[15px] text-[var(--ink-muted)]">산출된 결과가 없습니다.</p>
                  </Card>
                )}

                {/* 직무 적합도 */}
                {fitData.length === 0 ? (
                  <Card title="직무 적합도" desc="직무에서 요구하는 5개 역량을 기준으로 평가한 적합도입니다.">
                    <p className="text-[15px] text-[var(--ink-muted)]">산출된 결과가 없습니다.</p>
                  </Card>
                ) : (
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
                          className={`grid grid-cols-12 lg:grid-cols-[minmax(6rem,2fr)_minmax(3.5rem,1fr)_minmax(0,8fr)_auto] gap-x-6 gap-y-2 py-4 items-baseline ${idx > 0 ? "border-t border-[var(--line)]" : ""}`}
                        >
                          <div className="col-span-6 lg:col-span-1 serif text-[18px]">{axis}</div>
                          <div className="col-span-6 lg:col-span-1 serif text-[24px] text-[var(--secondary-2)] tabular-nums whitespace-nowrap">
                            {(v.score * 10).toFixed(0)}
                          </div>
                          <p className="col-span-12 lg:col-span-1 text-[16.5px] leading-[1.75] text-[var(--ink-muted)]">
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
                  <DeptFitV2Section jobId={id} applicantId={decodedAppId} scoreOnly={jobStatus?.mode === "score_only"} />
                </Card>

                {/* AI 사용 의심도 근거: 헤더 통계줄의 숫자를 풀어서 설명함.
                    「자기소개서 핵심」 바로 위에 둠. 이건 자소서를 얼마나 믿고 읽을지
                    알려주는 정보라 대상보다 먼저 와야 함. 문항별 점수를 먼저 보고
                    바로 아래에서 그 문항 내용을 확인하는 동선이 이어짐 */}
                <Card
                  title="AI 사용 의심도 근거"
                  badge={<ExperimentalBadge />}
                  desc="자기소개서의 문체 비율(문장 길이, 문장부호, 띄어쓰기 등)을 비교한 실험 점수입니다. AI 사용 비율이나 작성 확률이 아닙니다."
                >
                  <AiDetectionButton jobId={id} applicantId={decodedAppId} running={applicant.ai_detection?.status === "running"} />
                  <AiUsageSection detection={applicant.ai_detection} />
                </Card>

                {/* 자기소개서 핵심: 문항별로 묶어 정리 */}
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
                            // 빈 답변 문항이 빠져도 원본 문항 번호(essay_N)를 씀. 의심 문장 카드와 같은 번호
                            const n = Number(/^essay_(\d+)$/.exec(q.question_id)?.[1]);
                            g = { qid: q.question_id, qNum: n || order.length + 1, question: q.question, items: [] };
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
                            {/* 항목: 문항 아래 들여쓰기 + 좌측 라인으로 그룹화 */}
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

                {/* 추천 면접 질문: 표시 설정에 따라 토글 (메인 컬럼 하단) */}
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
            // 자기소개서 탭처럼 카드를 나란히 쌓음. 카드는 TalentTypesSection 안에 있음
            <div className="mt-6">
              <TalentTypesSection jobId={id} applicantId={decodedAppId} />
            </div>
          }
        />
      </div>
    </div>
  );
}

/** 카드: 흰 surface + 액센트 바 마커 헤더 (번호 없이 섹션 구분) */
function Card({
  title,
  badge,
  desc,
  action,
  className,
  children,
}: {
  title: string;
  /** 제목 옆 표식 */
  badge?: React.ReactNode;
  desc?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4 pb-3.5 mb-4 border-b border-[var(--line)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mark" />
            <h2 className="text-[18px] font-bold tracking-[-0.012em] text-[var(--ink)]">{title}</h2>
            {badge}
          </div>
          {desc && (
            <p className="mt-1.5 text-[17px] text-[var(--ink-muted)] leading-[1.6] break-keep whitespace-pre-line">
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

type Suspect = { source: string; location: string; excerpt: string; phrase: string; match?: "문구" | "유사" };

/** 지시문 의심 문장(INGUARD-001). 표시만 하고 점수는 그대로임 */
function SuspectCard({ items }: { items?: Suspect[] }) {
  if (!items?.length) return null;
  return (
    <section className="panel" style={{ borderColor: "var(--bad)" }}>
      <div className="pb-3.5 mb-4 border-b border-[var(--line)]">
        <div className="flex flex-wrap items-center gap-2 text-[var(--bad)]">
          <AlertTriangle size={20} strokeWidth={2.2} />
          <h2 className="text-[18px] font-bold tracking-[-0.012em]">지시문 의심 문장 {items.length}건</h2>
        </div>
        <p className="mt-1.5 text-[17px] text-[var(--ink-muted)] leading-[1.6] break-keep">
          모델에게 점수나 판정을 바꾸라고 요구하는 문장입니다. 모델에는 평가 자료로만 전달했고, 점수 계산은 다른 지원자와 같습니다.
        </p>
      </div>
      <div className="space-y-4">
        {items.map((s, i) => {
          // 유사 항목은 문장 전체가 맞은 문구라 강조하지 않음
          const at = s.match === "유사" ? -1 : s.excerpt.indexOf(s.phrase);
          return (
            <div key={i} className="flex items-baseline gap-2.5">
              <span className="inline-flex items-center justify-center shrink-0 h-[22px] px-2 rounded-md bg-[var(--p-50)] text-[var(--p-700)] text-[12px] font-bold tabular-nums">
                {s.location.replace(/^문항 (\d+)$/, (_, n) => `Q${n.padStart(2, "0")}`)}
              </span>
              {s.match === "유사" && (
                <span className="shrink-0 inline-block px-2 py-0.5 rounded-full border border-[var(--line-strong)] text-[11px]">유사</span>
              )}
              <p className="text-[15.5px] leading-[1.75] text-[var(--ink)]">
                {at < 0 ? s.excerpt : (
                  <>
                    {s.excerpt.slice(0, at)}
                    <b className="font-bold text-[var(--bad)]">{s.phrase}</b>
                    {s.excerpt.slice(at + s.phrase.length)}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 핵심인재 레이더의 연한 음영 설명. 기준선이 없으면 있는 것처럼 적지 않음 */
function baselineNote(hasBaseline: boolean, failed: boolean): string {
  if (hasBaseline) return "연한 음영은 역대 합격자 평균입니다.";
  return failed ? "역대 합격자 평균을 불러오지 못해 음영 없이 표시합니다." : "비교할 역대 합격자 평균이 없어 음영 없이 표시합니다.";
}

/** Highlights 헤더의 핵심 지표 셀 (첫 셀은 강조, muted 는 값 대신 상태를 적을 때) */
function HeaderStat({
  label,
  value,
  unit,
  sub,
  accent,
  text,
  muted,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: boolean;
  text?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="px-5 first:pl-0 last:pr-0 border-l border-[var(--line)] first:border-l-0 min-w-0">
      <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-muted)] mb-1.5">
        {label}
      </div>
      <div
        className={`h-[31px] leading-none truncate max-w-[180px] ${
          muted
            ? "text-[18px] font-bold text-[var(--ink-muted)]"
            : accent
              ? "text-[30px] font-extrabold text-[var(--secondary-2)] tabular-nums"
              : text
                ? "text-[18px] font-bold text-[var(--ink)]"
                : "text-[26px] font-extrabold text-[var(--ink)] tabular-nums"
        }`}
        title={value}
      >
        {/* 빈 받침이 칸마다 기준선을 위에서 26px 에 묶어, 글자 크기가 달라도 값과 보조 문구 줄이 맞음 */}
        <span aria-hidden className="inline-block h-[26px] w-0" />
        {value}
        {unit && <span className="text-[13px] font-semibold text-[var(--ink-muted)] ml-1">{unit}</span>}
      </div>
      <div className="mt-1.5 min-h-[18px] text-[12px] text-[var(--ink-muted)] truncate max-w-[180px]">{sub}</div>
    </div>
  );
}
