import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api, asError, isNotFound, type PaperDetail } from "@/lib/api";
import RadarCard from "@/components/radar-card";
import PapersPrintList from "@/components/papers-print-list";
import TimelineSection from "@/components/timeline-section";
import TimelineBar from "@/components/timeline-bar";
import DeptFitList from "@/components/dept-fit-list";
import PrintAuto from "@/components/print-auto";
import PrintButton from "@/components/print-button";
import TalentTypesSection from "@/components/talent-types-section";
import { aiUsageHeadline } from "@/lib/ai-usage";
import { cleanReason } from "@/lib/clean-reason";
import { PRINT_LIMIT, fitList, fitText } from "@/lib/print-frame";

export const dynamic = "force-dynamic";

// 브라우저가 문서 제목을 PDF 파일명으로 씀. 일괄 다운로드와 같이 지원자 번호로 맞춤
export async function generateMetadata({
  params,
}: {
  params: Promise<{ applicantId: string }>;
}): Promise<Metadata> {
  const { applicantId } = await params;
  return { title: { absolute: decodeURIComponent(applicantId) } };
}



// 화면 기본(320)대로 그리면 레이더 카드가 첫 장 남은 자리에 안 들어가 통째로 다음 장으로 밀림
const PRINT_RADAR_HEIGHT = 230;

/**
 * 지원자 1명 인쇄(PDF) 화면.
 *
 * 지원자 상세 대시보드와 같은 카드·색·차트를 그대로 쓰되, 탭을 없애 한 장으로 펼치고
 * 버튼류(피드백·재계산·업로드)를 뺌. 브라우저 인쇄로 저장하므로 화면과 결과가 같음.
 * 항목마다 줄 수와 개수를 못박아(lib/print-frame.ts) 긴 글은 말줄임표로 자름. 지원자마다
 * 글 길이가 달라도 한 항목이 차지하는 자리는 같음. 섹션끼리는 빈틈 없이 이어 붙이고,
 * 내용이 없는 섹션은 한 줄 안내로 접음.
 *
 * AI 사용 의심도는 점수만 싣고 근거는 뺌. 목업인 인재상 유형은 화면과 같은 배지를 붙임
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

  const [resultRes, papersRes, sourceInputRes, coreBaselineRes, deptFitRes] = await Promise.all([
    api.getResult(id).catch(asError),
    api.listPapers(id, decodedAppId).catch(asError),
    api.getSourceInput(id).catch(asError),
    api.getCorePassedBaseline().catch(asError),
    api.getDeptFit(id, decodedAppId).catch(asError),
  ]);
  const papersFailed = papersRes instanceof Error;
  const papers = papersFailed ? [] : papersRes;
  const sourceFailed = sourceInputRes instanceof Error;
  const baselineFailed = coreBaselineRes instanceof Error;
  const deptFit = deptFitRes instanceof Error ? null : deptFitRes;
  const resultFailed = resultRes instanceof Error && !isNotFound(resultRes);

  const applicant =
    resultRes instanceof Error ? undefined : resultRes.results?.find((r) => r.applicant_id === decodedAppId);

  if (!applicant) {
    return (
      <div className="px-8 py-9 max-w-3xl mx-auto">
        <div className="panel text-center py-16">
          <h2 className="text-[22px] font-bold mb-2">
            {resultFailed ? "지원자 정보를 불러오지 못하였습니다." : "지원자를 찾을 수 없습니다."}
          </h2>
          <p className="text-[14px] text-[var(--ink-muted)]">{decodedAppId}</p>
        </div>
      </div>
    );
  }

  // 논문 상세는 인쇄 시점에 서버에서 한 번에 가져옴 (화면처럼 열어봐야 채워지면 안 됨)
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

  const coreBaseline = baselineFailed ? null : coreBaselineRes.core_passed_baseline;
  const hasBaseline = coreBaseline != null && Object.keys(coreBaseline).length > 0;
  const sourceApplicant = sourceFailed
    ? undefined
    : sourceInputRes.applicants.find((a) => a.applicant_id === decodedAppId);

  const aiUsageHead = aiUsageHeadline(applicant.ai_detection);
  const fitVals = Object.values(applicant.scores?.job_fit ?? {});
  const fitAvg100 =
    fitVals.length > 0 ? (fitVals.reduce((s, v) => s + v.score, 0) / fitVals.length) * 10 : null;
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
  const deptStat = topDeptV2
    ? { value: topDeptV2.dept_name, sub: `${topDeptV2.score.toFixed(0)}점` }
    : !deptFit
      ? { value: "불러오지 못하였습니다", muted: true }
      : deptFit.skipped
        ? { value: "미산출", sub: "행정직 미산출", muted: true }
        : { value: "미산출", sub: "채점 결과가 없습니다", muted: true };

  const timelineTotal =
    (sourceApplicant?.education?.length ?? 0) + (sourceApplicant?.career?.length ?? 0);
  const paperList = fitList(papers, PRINT_LIMIT.papers);
  const interviewList = fitList(applicant.interview_questions ?? [], PRINT_LIMIT.interviewQuestions);
  // 근거를 미리 잘라 넘김. 목록 부품은 화면과 같이 쓰므로 건드리지 않음
  const deptFitItems = fitList(deptFit?.items ?? [], PRINT_LIMIT.deptFitItems).shown.map((d) => ({
    ...d,
    reason: d.reason ? fitText(cleanReason(d.reason), PRINT_LIMIT.deptFitReason) : d.reason,
  }));

  const printedAt = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    // 본문 폭을 A4 인쇄 폭(186mm)과 같게 둬야 레이더가 종이 폭으로 그려짐
    <div className="print-page px-6 lg:px-10 py-8 box-content max-w-[186mm] mx-auto">
      {auto === "1" && <PrintAuto />}

      {/* 화면에서만 보이는 안내 줄: 인쇄물에는 나오지 않음 */}
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

      <div className="print-flow print-sections mt-5 flex flex-col gap-5">
        {/* 종합 요약 */}
        <Card title="종합 요약">
          {!applicant.summary?.overall && !applicant.summary?.overall_lines?.length && (
            <p className="text-[14px] text-[var(--ink-muted)]">산출된 결과가 없습니다.</p>
          )}
          {applicant.summary?.overall && (
            <p className="serif text-[20px] leading-[1.55] tracking-[-0.005em] text-[var(--ink)] line-clamp-2">
              {applicant.summary.overall}
            </p>
          )}
          {applicant.summary?.overall_lines && (
            <ul className="mt-6 space-y-3">
              {applicant.summary.overall_lines.slice(0, PRINT_LIMIT.summaryLines).map((line, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-3.5 items-baseline">
                  <span className="text-[13px] text-[var(--secondary-2)] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15.5px] leading-[1.8] text-[var(--ink)] line-clamp-2">{line}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 학력, 이력 */}
        {sourceFailed ? (
          <EmptyRow title="학력 · 이력">불러오지 못하였습니다.</EmptyRow>
        ) : timelineTotal === 0 ? (
          <EmptyRow title="학력 · 이력">기재된 내용이 없습니다.</EmptyRow>
        ) : (
          <Card
            title="학력 · 이력"
            note={omitted(timelineTotal - PRINT_LIMIT.timelineRows, "건")}
            split
          >
            <div className="print-figure">
              <TimelineBar education={sourceApplicant?.education} career={sourceApplicant?.career} />
            </div>
            <div className="print-timeline">
              <TimelineSection
                education={sourceApplicant?.education}
                career={sourceApplicant?.career}
                limit={PRINT_LIMIT.timelineRows}
              />
            </div>
          </Card>
        )}

        {/* 역량 진단 */}
        <div className="print-flow grid grid-cols-2 gap-5">
          {coreData.length > 0 && (
            <Card
              figure
              title="핵심인재 유사도"
              desc={`합격자 자기소개서와 비슷한 정도를 나타냅니다. ${baselineNote(hasBaseline, baselineFailed)}`}
            >
              <RadarCard data={coreData} color="#33307A" baseline={coreBaseline} height={PRINT_RADAR_HEIGHT} />
            </Card>
          )}
          {fitData.length > 0 && (
            <Card figure title="직무 적합도" desc="직무에서 요구하는 5개 역량을 기준으로 평가한 적합도입니다.">
              <RadarCard data={fitData} color="#F39200" max={100} height={PRINT_RADAR_HEIGHT} />
            </Card>
          )}
        </div>

        {coreData.length === 0 && <EmptyRow title="핵심인재 유사도">산출된 결과가 없습니다.</EmptyRow>}
        {fitData.length === 0 && <EmptyRow title="직무 적합도">산출된 결과가 없습니다.</EmptyRow>}

        {/* 직무적합 역량별 근거 */}
        {fitData.length > 0 && (
          <Card title="직무적합 역량별 근거" split>
            <div>
              {Object.entries(applicant.scores?.job_fit ?? {}).map(([axis, v], idx) => (
                <div
                  key={axis}
                  className={`print-row grid grid-cols-12 gap-x-6 gap-y-2 py-4 items-baseline ${idx > 0 ? "border-t border-[var(--line)]" : ""}`}
                >
                  <div className="col-span-2 serif text-[18px]">{axis}</div>
                  <div className="col-span-1 serif text-[24px] text-[var(--secondary-2)] tabular-nums">
                    {(v.score * 10).toFixed(0)}
                  </div>
                  <p className="col-span-9 text-[14.5px] leading-[1.75] text-[var(--ink-muted)] line-clamp-3">
                    {cleanReason(v.reason)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 직군 적합도 */}
        {!deptFit ? (
          <EmptyRow title="직군 적합도">불러오지 못하였습니다.</EmptyRow>
        ) : deptFit.skipped ? (
          <EmptyRow title="직군 적합도">
            {deptFit.skipped_reason ?? "행정직은 직군 적합도 산출 대상이 아닙니다."}
          </EmptyRow>
        ) : deptFitItems.length > 0 ? (
          <Card title="직군 적합도">
            <div className="print-dept">
              <DeptFitList items={deptFitItems} computedAt={deptFit?.computed_at} />
            </div>
          </Card>
        ) : (
          <EmptyRow title="직군 적합도">산출된 결과가 없습니다.</EmptyRow>
        )}

        {/* 자기소개서 핵심 */}
        {applicant.summary?.by_question && applicant.summary.by_question.length > 0 && (
          <Card title="자기소개서 핵심" split>
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
                    <div className="print-head flex items-baseline gap-2.5 mb-3.5">
                      <span className="inline-flex items-center justify-center shrink-0 h-[22px] px-2 rounded-md bg-[var(--p-50)] text-[var(--p-700)] text-[12px] font-bold tabular-nums">
                        Q{String(g.qNum).padStart(2, "0")}
                      </span>
                      <p className="text-[14px] font-medium text-[var(--ink-muted)] leading-[1.5] line-clamp-1">
                        {g.question}
                      </p>
                    </div>
                    <div className="space-y-4 pl-3.5 border-l-2 border-[var(--line)]">
                      {g.items.slice(0, PRINT_LIMIT.essayItemsPerQuestion).map((item) => (
                        <div
                          key={`${item.question_id}-${item.item_index ?? 0}`}
                          className="print-row flex gap-3 items-start"
                        >
                          <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-[var(--secondary)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="serif text-[18px] leading-[1.4] text-[var(--ink)] line-clamp-1">
                              {item.title || item.question_id}
                            </h3>
                            <p className="mt-1 text-[15.5px] leading-[1.75] text-[var(--ink)] line-clamp-2">
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

        {/* 추천 면접 질문: 화면에서는 표시 설정에 따라 접히지만 인쇄물에는 항상 넣음 */}
        {interviewList.shown.length > 0 && (
          <Card title="추천 면접 질문" split>
            {/* 두 열로 깔면 칸마다 높이가 달라 빈칸이 생김. 한 열로 깖 */}
            <div>
              {interviewList.shown.map((q, idx) => (
                <article
                  key={q.id}
                  className="print-row grid grid-cols-[auto_1fr] gap-5 py-3.5 border-b border-[var(--line)] last:border-b-0"
                >
                  <div className="serif text-[26px] leading-none text-[var(--ink-muted)] tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <p className="text-[16px] leading-[1.6] text-[var(--ink)] line-clamp-3">{q.question}</p>
                    {(q.intent || q.topic_tag) && (
                      <div className="mt-1.5 text-[12.5px] text-[var(--ink-muted)] leading-[1.6] flex items-center gap-2">
                        {q.topic_tag && (
                          <span className="shrink-0 inline-block px-2 py-0.5 rounded-full border border-[var(--line-strong)] text-[11px]">
                            {q.topic_tag}
                          </span>
                        )}
                        {q.intent && <span className="line-clamp-1">{q.intent}</span>}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Card>
        )}

        {/* 학술지 게재 이력: 화면에서는 별도 탭 */}
        {papersFailed ? (
          <EmptyRow title="학술지 게재 이력">불러오지 못하였습니다.</EmptyRow>
        ) : papers.length === 0 ? (
          <EmptyRow title="학술지 게재 이력">기재된 내용이 없습니다.</EmptyRow>
        ) : (
          <Card title="학술지 게재 이력" note={omitted(paperList.hidden, "편")} split>
            <PapersPrintList
              files={paperList.shown}
              details={paperDetails}
              jobId={id}
              applicantId={decodedAppId}
            />
          </Card>
        )}

        {/* 인재상 유형: 화면에서는 별도 탭. 인쇄에서는 34개를 처음부터 펼침 */}
        <div className="print-talent">
          <TalentTypesSection jobId={id} applicantId={decodedAppId} printMode />
        </div>
      </div>
    </div>
  );
}

/** 상세 화면의 Card 와 같은 모양. 인쇄에서는 페이지 경계에서 이어 쓰고, 도형만 print-figure 로 자르지 않음 */
function Card({
  title,
  badge,
  desc,
  note,
  split,
  figure,
  children,
}: {
  title: string;
  /** 제목 옆 표식 */
  badge?: React.ReactNode;
  desc?: string;
  /** 개수 상한에 걸려 빠진 것을 알리는 한 줄 */
  note?: string;
  /** 길이가 지원자마다 달라지는 카드. 페이지를 넘겨 이어 씀 */
  split?: boolean;
  /** 제목과 도형만 있는 카드. 쪽 끝에 제목만 남지 않게 통째로 자르지 않음 */
  figure?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel print-block${split ? " print-split" : ""}${figure ? " print-figure" : ""}`}>
      <div className="print-head flex items-start justify-between gap-4 pb-3.5 mb-4 border-b border-[var(--line)]">
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
        {note && (
          <span className="shrink-0 text-[12px] text-[var(--ink-muted)] whitespace-nowrap">{note}</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** 내용이 없는 섹션. 제목과 안내를 한 줄에 두고 접음. 다음 섹션이 바로 이어짐 */
function EmptyRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel print-block print-figure flex items-center gap-2.5">
      <span className="mark" />
      <h2 className="text-[18px] font-bold tracking-[-0.012em] text-[var(--ink)]">{title}</h2>
      <p className="ml-3 text-[13px] text-[var(--ink-muted)] line-clamp-1">{children}</p>
    </section>
  );
}

function omitted(hidden: number, unit: string): string | undefined {
  return hidden > 0 ? `외 ${hidden}${unit} 생략` : undefined;
}

/** 핵심인재 레이더의 연한 음영 설명. 기준선이 없으면 있는 것처럼 적지 않음 */
function baselineNote(hasBaseline: boolean, failed: boolean): string {
  if (hasBaseline) return "연한 음영은 역대 합격자 평균입니다.";
  return failed ? "역대 합격자 평균을 불러오지 못해 음영 없이 표시합니다." : "비교할 역대 합격자 평균이 없어 음영 없이 표시합니다.";
}

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
