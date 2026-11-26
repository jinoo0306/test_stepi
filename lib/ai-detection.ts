/** Model contributions explain the classifier, not whether AI actually wrote a passage. */
interface Totals {
  total_positive: number;
  total_negative: number;
  intercept: number;
  linear_score: number;
  omitted_contribution: number;
}

/** 10/22 문자 패턴 모델로 저장된 옛 결과 */
export interface AiDetectionCharExplanation extends Totals {
  version: "char-contribution-v1";
  method: "character_pattern_logistic";
  items: Array<{
    question_index: number;
    pattern: string;
    excerpt: string;
    /** Unicode code point offsets within the normalized excerpt. */
    match_start: number;
    match_end: number;
    direction: "raises" | "lowers";
    contribution: number;
  }>;
}

/** 문체 비율 모델(AIDET-002). value 는 이 지원자 값, reference 는 학습 자료 평균 */
export interface AiDetectionStyleExplanation extends Totals {
  version: "style-contribution-v1";
  method: "style_ratio_logistic";
  items: Array<{
    feature: string;
    label: string;
    value: number | null;
    reference: number;
    direction: "raises" | "lowers";
    contribution: number;
  }>;
}

export type AiDetectionExplanation = AiDetectionCharExplanation | AiDetectionStyleExplanation;
