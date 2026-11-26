import type { AiDetection } from "@/lib/api";
import type { AiDetectionCharExplanation, AiDetectionStyleExplanation } from "@/lib/ai-detection";
import { aiAnalysisTime, aiDetectionStatus, aiUsageHeadline } from "@/lib/ai-usage";

function PatternExcerpt({ item }: { item: AiDetectionCharExplanation["items"][number] }) {
  const chars = Array.from(item.excerpt);
  return <blockquote className="mt-3 break-words rounded-md bg-[var(--bg-2)] p-4 leading-7">
    {chars.slice(0, item.match_start).join("")}
    <mark className="rounded-sm bg-amber-100 px-0.5 font-semibold text-slate-900">{chars.slice(item.match_start, item.match_end).join("")}</mark>
    {chars.slice(item.match_end).join("")}
  </blockquote>;
}

/** 특징 종류에 맞춘 값 표시. 비율은 %, 문장 길이는 글자 수 */
function styleValue(feature: string, v: number | null): string {
  if (v === null) return "해당 자리 없음";
  if (feature.startsWith("sent_mean") || feature.startsWith("sent_std")) return `${v.toFixed(1)}자`;
  if (feature.startsWith("sent_cv") || feature.startsWith("mattr50")) return v.toFixed(2);
  return `${(v * 100).toFixed(2)}%`;
}

function StyleItems({ explanation }: { explanation: AiDetectionStyleExplanation }) {
  return <>
    <p>아래 항목은 사람 작성 자료와 AI 작성 예시로 학습한 문체 비율 모델에서 점수를 높이거나 낮추었습니다. AI 작성을 입증하는 근거는 아닙니다.</p>
    {explanation.items.length ? <ul className="grid gap-4 xl:grid-cols-2">
      {explanation.items.map((item) => <li key={item.feature} className="break-inside-avoid rounded-lg border border-[var(--line-strong)] p-4">
        <span className="font-semibold">{item.direction === "raises" ? "점수를 높인 항목" : "점수를 낮춘 항목"}</span>
        <p className="mt-1 font-bold">{item.label}</p>
        <p className="mt-2 tabular-nums">이 지원자 {styleValue(item.feature, item.value)} · 학습 자료 평균 {styleValue(item.feature, item.reference)}</p>
      </li>)}
    </ul> : <p>표시할 수 있는 항목이 없습니다. 이를 사람 작성 또는 AI 미사용의 근거로 해석하지 않습니다.</p>}
    <p className="text-[var(--ink-muted)]">점수를 높이는 방향과 낮추는 방향에서 영향이 큰 항목을 각각 최대 3개 표시합니다. 표시되지 않은 항목도 계산에 포함되므로, 이 목록만으로 전체 점수를 재계산할 수는 없습니다. 학습 자료 평균은 사람 작성 자료와 AI 작성 예시를 합친 평균입니다.</p>
  </>;
}

/** Rendering and printing only read stored results. */
export default function AiUsageSection({ detection }: { detection?: AiDetection }) {
  const result = detection?.last_success;
  const explanation = result?.explanation;
  const headline = aiUsageHeadline(detection);
  // 문자 패턴 모델(10/22)로 저장된 옛 결과는 옛 설명 그대로 보여 줌
  const isChar = !!result?.model_version.startsWith("common-char");
  return (
    <div className="space-y-7 text-base leading-7">
      <section aria-label="AI 검토 결과 요약" className="rounded-lg border border-[var(--line-strong)] bg-[var(--bg-2)] p-5">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-[var(--ink-muted)]">실험 의심 점수</dt>
            <dd className="mt-2 text-3xl font-bold leading-tight tabular-nums">{result ? headline.value : "-"}<span className="text-base font-medium">{headline.unit}</span></dd>
          </div>
          <div className="space-y-3">
            <div><dt className="font-medium text-[var(--ink-muted)]">검토 상태</dt><dd className="font-semibold">{aiDetectionStatus(detection)}</dd></div>
            {result && <div><dt className="font-medium text-[var(--ink-muted)]">마지막 성공 분석 시각</dt><dd>{aiAnalysisTime(result.analyzed_at)}</dd></div>}
          </div>
        </dl>
        {!result && <p className="mt-4">저장된 분석 점수가 없습니다. 미분석 또는 실패는 0점을 의미하지 않습니다.</p>}
        {detection?.stale && <p role="status" className="mt-4 font-semibold">이전 자기소개서의 결과입니다. 현재 자기소개서로 다시 검토해 주십시오.</p>}
        {result && detection?.status !== "succeeded" && <p className="mt-4">표시된 점수와 근거는 마지막으로 성공한 검토 결과입니다. 최근 검토 상태와 구분하여 확인해 주십시오.</p>}
      </section>

      <section aria-label={isChar ? "점수에 영향을 준 표현" : "점수에 영향을 준 문체 항목"} className="space-y-3">
        <h3 className="text-lg font-bold">{isChar ? "점수에 영향을 준 표현" : "점수에 영향을 준 문체 항목"}</h3>
        {explanation?.version === "style-contribution-v1" ? <StyleItems explanation={explanation} /> : explanation ? <>
          <p>아래 표현은 비교 자료에서 학습한 문자 패턴과 연결되어 점수를 높이거나 낮추었습니다. AI 작성을 입증하는 문장이나 오류를 확인한 것은 아닙니다.</p>
          <p className="text-[var(--ink-muted)]">분석에 사용한 정규화된 발췌입니다. 영문 대소문자와 공백 등이 원문과 다를 수 있습니다. 표시된 위치는 대표 예시이며, 영향은 답변 전체의 패턴을 기준으로 계산합니다.</p>
          {explanation.items.length ? <ul className="grid gap-4 xl:grid-cols-2">
            {explanation.items.map((item, index) => <li key={`${item.question_index}-${item.pattern}-${index}`} className="break-inside-avoid rounded-lg border border-[var(--line-strong)] p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-bold">문항 {item.question_index + 1}</span>
                <span className="font-semibold">{item.direction === "raises" ? "점수를 높인 표현" : "점수를 낮춘 표현"}</span>
              </div>
              <p className="mt-1">비교된 패턴: <strong className="break-all">“{item.pattern}”</strong></p>
              <PatternExcerpt item={item} />
              <p className="mt-2 text-[var(--ink-2)]">이 패턴은 학습된 비교 기준에서 {item.direction === "raises" ? "AI 작성 예시 쪽으로" : "사람 작성 예시 쪽으로"} 점수에 영향을 주었습니다. 이 표현만으로 작성 주체를 판단할 수는 없습니다.</p>
            </li>)}
          </ul> : <p>표시할 수 있는 대표 표현이 없습니다. 이를 사람 작성 또는 AI 미사용의 근거로 해석하지 않습니다.</p>}
          <p className="text-[var(--ink-muted)]">공백 없는 패턴 중 점수를 높이는 방향과 낮추는 방향에서 영향이 큰 패턴을 각각 최대 3개 표시합니다. 겹치는 패턴과 표시되지 않은 패턴도 계산에 포함되므로, 이 목록만으로 전체 점수를 재계산할 수는 없습니다.</p>
        </> : <p className="rounded-md border border-[var(--line-strong)] p-4">{result ? "이전 분석 결과에는 표현별 근거가 저장되어 있지 않습니다. ‘AI 검토 실행’을 다시 누르면 점수와 근거가 함께 저장됩니다." : "AI 검토를 실행하면 점수에 영향을 준 문체 항목을 함께 확인할 수 있습니다."}</p>}
      </section>

      <section aria-label="사용한 분석 방법" className="space-y-3">
        <h3 className="text-lg font-bold">분석 방법</h3>
        {isChar ? <>
        <p>한 가지 문자 패턴 모델이 아래 순서로 계산합니다.</p>
        <ol className="list-decimal space-y-3 pl-6">
          <li><strong>짧은 문자 패턴 비교</strong><br />자기소개서를 2~4글자 단위로 나누고, 각 패턴이 얼마나 나타나는지 비교합니다. 뜻을 이해하거나 사실 여부를 확인하는 방식은 아닙니다.</li>
          <li><strong>각 패턴의 영향 합산</strong><br />사람 작성 자료와 AI 작성 예시로 미리 학습한 비교 모델이 패턴별로 점수를 높이거나 낮추는 영향을 계산하여 합산합니다. 여러 검출기를 함께 실행하는 방식은 아닙니다.</li>
          <li><strong>100점 척도로 변환</strong><br />합산 결과를 0~100점으로 변환합니다. 높을수록 학습한 AI 예시의 문자 패턴 쪽에 가깝다는 뜻이며, AI 사용 비율이나 작성 확률을 뜻하지 않습니다.</li>
        </ol>
        </> : <>
        <p>한 가지 문체 비율 모델이 아래 순서로 계산합니다.</p>
        <ol className="list-decimal space-y-3 pl-6">
          <li><strong>문체 비율 측정</strong><br />네 답변마다 문장 길이와 그 변동, 쉼표·마침표·괄호·따옴표·숫자·영문·줄바꿈 비율, 어휘 다양도, 연결어미 뒤 쉼표 비율, 띄어 써도 되는 자리의 띄어쓰기 비율을 잽니다. 글 전체 길이는 쓰지 않으며, 뜻을 이해하거나 사실 여부를 확인하는 방식은 아닙니다.</li>
          <li><strong>각 항목의 영향 합산</strong><br />네 답변의 평균과 가장 낮은 값을 사람 작성 자료와 AI 작성 예시로 미리 학습한 비교 모델에 넣어, 항목별로 점수를 높이거나 낮추는 영향을 합산합니다.</li>
          <li><strong>100점 척도로 변환</strong><br />합산 결과를 0~100점으로 변환합니다. 높을수록 학습한 AI 예시의 문체 쪽에 가깝다는 뜻이며, AI 사용 비율이나 작성 확률을 뜻하지 않습니다.</li>
        </ol>
        </>}
      </section>

      <section aria-label="해석 시 유의사항" className="space-y-3 rounded-lg border border-[var(--line-strong)] p-5">
        <h3 className="text-lg font-bold">검토 시 유의 사항</h3>
        <p>생성 모델, 문항, 글 길이가 달라지면 결과가 달라질 수 있습니다. 높은 점수나 강조된 표현만으로 AI 사용을 확정하지 말고, 자기소개서 내용과 다른 확인 자료를 함께 검토해 주십시오.</p>
        {!!result?.warnings.length && <ul className="list-disc space-y-2 pl-5">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      </section>

      {result && <details className="break-words border-t border-[var(--line-strong)] pt-4">
        <summary className="cursor-pointer font-semibold">분석 버전 및 계산 세부정보</summary>
        <dl className="mt-3 space-y-2">
          <div><dt className="font-medium">모델 버전</dt><dd>{result.model_version}</dd></div>
          <div><dt className="font-medium">점수 보정 버전</dt><dd>{result.calibration_version}</dd></div>
          <div><dt className="font-medium">입력 처리 버전</dt><dd>{result.normalization_version}</dd></div>
          <div><dt className="font-medium">실험 기준 비교</dt><dd>{result.threshold_exceeded ? "초과" : "이하"} · 기준 점수 {result.threshold_score.toPrecision(6)} / 100. 반올림 전 점수로 비교하며 AI 작성 확정 판정은 아닙니다.</dd></div>
        </dl>
        {detection?.last_attempt?.error_code && <p className="mt-3">최근 실행 오류: {detection.last_attempt.error_code}</p>}
      </details>}
    </div>
  );
}
