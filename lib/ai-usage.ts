/**
 * AI 문체 유사도 — 표시용 데이터.
 *
 * ── **전부 목업이다.** 백엔드에 이 값을 산출하는 코드가 없다.
 *    lib/api.ts 의 scores 타입에 관련 필드가 없어 받아올 값 자체가 없다.
 *    지원자가 바뀌어도 같은 숫자가 나오며, 화면 배치·문구 확정용이다.
 *
 * ── 백엔드가 생기면 이 파일의 상수를 API 응답으로 교체한다.
 *    화면 구조(종합 점수 1개 + 문항별 분해 + 설명 가능한 보조 지표)는
 *    어떤 탐지 방식을 쓰더라도 그대로 쓸 수 있게 잡았다.
 *
 * ── 탐지 방식 (2026-08-19 기준 미확정, 박사님 판단 필요):
 *    ① perplexity 단독      — 싸지만 격식 한국어에서 오탐이 많다
 *    ② 2모델 대조(Binoculars) — cross-perplexity 로 "원래 뻔한 글" 성분을 상쇄. 학습 불필요.
 *                              Qwen3-4B + 14B 로 구현 가능 (생성이 아니라 forward pass)
 *    ③ 문체 지표            — 단독으로는 약하나 *사람이 읽을 근거*를 만드는 유일한 축
 *    권장은 ②가 점수를, ③이 근거를 맡는 병행 구조.
 *    직무 적합도가 LLM 점수 + 코사인 근거 문장을 나란히 보여주는 것과 같은 형태다.
 *
 * ⚠️ 문장 단위 발췌("이 문장이 AI 같습니다")는 **일부러 목업으로 넣지 않았다.**
 *    나머지 목업은 배치 확인용인 게 보이지만, 가짜 근거 문장은 진짜처럼 읽혀
 *    실제 채용 판단에 영향을 줄 수 있다. 백엔드가 붙을 때 채운다.
 */

export type AiUsageMetric = {
  /** 지표 이름 — 면접관이 읽는 말 */
  label: string;
  /** 0-100. 높을수록 AI 문체에 가깝다 */
  score: number;
  /** 이 지표가 무엇을 보는지 한 줄 설명 */
  hint: string;
};

export type AiUsageQuestion = {
  /** 자기소개서 문항 번호 */
  no: number;
  title: string;
  /** 0-100 */
  score: number;
};

export type AiUsage = {
  /** 0-100. 헤더 통계줄에도 같은 값이 나간다 */
  overall: number;
  /** 문항별 분해 — 어느 문항이 점수를 끌어올렸는지 */
  questions: AiUsageQuestion[];
  /** 사람이 읽을 수 있는 보조 지표 */
  metrics: AiUsageMetric[];
};

export const AI_USAGE_MOCK: AiUsage = {
  overall: 80,
  questions: [
    { no: 1, title: "지원 동기", score: 62 },
    { no: 2, title: "직무 역량", score: 91 },
    { no: 3, title: "성장 과정", score: 44 },
    { no: 4, title: "입사 후 포부", score: 78 },
  ],
  metrics: [
    {
      label: "문장 길이 고름",
      score: 88,
      hint: "사람이 쓴 글은 길이가 들쭉날쭉하다. 고르면 AI 쪽이다",
    },
    {
      label: "상투 표현 빈도",
      score: 74,
      hint: "「~를 통해 성장」처럼 어느 자소서에나 있는 표현",
    },
    {
      label: "구체 사례 밀도",
      score: 81,
      hint: "숫자·기관명·기간이 적을수록 AI 쪽이다 (역방향 지표)",
    },
    {
      label: "어휘 다양성",
      score: 69,
      hint: "쓰인 낱말의 폭. 좁을수록 AI 쪽이다 (역방향 지표)",
    },
  ],
};

/** 점수대별 표현 — 「확정 판정 아님」이 문구에서 드러나야 한다 */
export function aiUsageLevel(score: number): { text: string; tone: "high" | "mid" | "low" } {
  if (score >= 75) return { text: "AI 문체와 많이 닮음", tone: "high" };
  if (score >= 45) return { text: "일부 구간이 닮음", tone: "mid" };
  return { text: "AI 문체와 크게 다름", tone: "low" };
}
