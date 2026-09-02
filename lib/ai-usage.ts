/**
 * AI 사용 의심도 — 만들 지표 목록.
 *
 * 지금은 **이름표만 있다.** 점수·횟수·근거 문장은 하나도 넣지 않았다.
 * 지표가 하나뿐인 상태에서 화면에 숫자를 채우면 다 된 것처럼 보이고,
 * 그 화면에 맞춰 로직을 억지로 끼우게 된다. 지표가 나온 뒤에 표시를 정한다.
 *
 * 종합 점수는 두 축의 평균이다. 축 하나는 지표 여러 개를 합친 값이다.
 * 지표 이름은 백엔드 필드명·논문과 같은 말을 쓴다. 화면에서 쉬운 말로 바꾸면
 * 나중에 「이 점수 왜 이래요」를 추적할 때 무엇을 가리키는 말인지 알 수 없게 된다.
 */

export type AiUsageItemStatus =
  /** 구현하고 실측으로 채택했다 */
  | "done"
  /** 만들 것이다 */
  | "planned"
  /** 만들었지만 실측에서 떨어졌다 */
  | "dropped";

export type AiUsageItem = {
  label: string;
  status: AiUsageItemStatus;
  /** 무엇을 보는 지표인지, 또는 왜 떨어졌는지 한 줄 */
  note: string;
};

export type AiUsageAxis = {
  label: string;
  note: string;
  items: AiUsageItem[];
};

export const AI_USAGE_PLAN: {
  formula: string;
  axes: AiUsageAxis[];
  caveat: string;
} = {
  formula: "종합 점수 = (문체 축 + 모델 축) ÷ 2",
  axes: [
    {
      label: "문체 축",
      note: "한국어 어문규범상 부자연스러운 자리를 셉니다. 지표 여러 개를 합쳐 한 점수로 만듭니다.",
      items: [
        {
          label: "연결어미 뒤 쉼표",
          status: "done",
          note: "「~하고,」처럼 연결어미 뒤에 쉼표를 찍는 자리. 생성 모델이 영어 구두법을 옮겨 옵니다.",
        },
        {
          label: "품사 n-gram 다양성",
          status: "planned",
          note: "품사 배열이 얼마나 되풀이되는지. 형태소 분석기가 필요합니다.",
        },
        {
          label: "어휘 다양성 (MTLD)",
          status: "planned",
          note: "쓰인 낱말의 폭. 글 길이에 휘둘리지 않는 방식으로 잽니다.",
        },
        {
          label: "열거 표지 유형 분포",
          status: "planned",
          note: "「첫째」 「먼저」 같은 나열 표지를 어떤 유형으로 쓰는지.",
        },
        {
          label: "문항 간 문체 흔들림",
          status: "planned",
          note: "네 문항의 문체가 서로 얼마나 다른지. 사람은 흔들리고 생성 모델은 고릅니다.",
        },
        {
          label: "띄어쓰기 일관성",
          status: "dropped",
          note: "실측에서 연도와 무관하게 흔들려 눈금에 넣지 않기로 했습니다.",
        },
      ],
    },
    {
      label: "모델 축",
      note: "언어 모델이 이 글을 얼마나 자기가 쓸 법한 글로 보는지 잽니다.",
      items: [
        {
          label: "Fast-DetectGPT",
          status: "planned",
          note: "채점에는 Qwen3-4B를 씁니다. 앵커를 만든 모델과 일부러 다른 것을 씁니다.",
        },
      ],
    },
  ],
  caveat:
    "완성돼도 확정 판정이 아닙니다. 면접에서 내용을 직접 물어보는 데 쓰는 참고자료입니다.",
};

/** 헤더 통계줄 한 칸. 값이 없으므로 자리만 지킨다 */
export function aiUsageHeadline(): { value: string; unit: string; sub: string } {
  return { value: "–", unit: "", sub: "준비 중" };
}
