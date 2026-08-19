/**
 * 인재상 34유형 — 표시용 데이터.
 *
 * ── 이름: 확정 (박사님 미팅 자료).
 *
 * ── 점수: **목업이다.** 백엔드에 이 유형들을 채점하는 코드가 없다.
 *    services/hreval/backend_handoff/code/score_axes.py:27 의 AXES 는 5축뿐이고
 *    (전문성·책임감·상호협력·도전성·혁신성), 인재상 유형용 anchor 문장도 존재하지 않는다.
 *    화면 배치 확인용 고정값이며, 백엔드가 생기면 이 배열을 API 응답으로 교체한다.
 *
 * ── 미해결 사항 (박사님 확인 필요):
 *    1. 「분석력」이 15번과 31번에 중복이어서 31번을 삭제하고,
 *       번호를 1~34로 당겼다 (2026-08-18, 김준영 결정).
 *
 *       ⚠️ 이 때문에 **미팅 자료의 번호와 32번부터 어긋난다.**
 *          자료 표기        지금
 *          다양성(32)    →  31
 *          포용성(33)    →  32
 *          성장지향성(34) → 33
 *          자기계발력(35) → 34
 *       박사님과 번호로 이야기할 때 혼선이 생길 수 있으니, 확정본을 받을 때
 *       번호 체계를 함께 맞출 것.
 *    2. 기존 5축 중 4개가 이 목록에 그대로 있다 — 전문성(1)·도전성(4)·혁신성(5)·책임감(7).
 *       상호협력만 같은 이름이 없고 협업력(3)/협력(24)/팀워크(25)로 흩어져 있다.
 *       인재상 유형이 5축을 대체하는지 별도인지 미확정.
 */

export type TalentType = {
  no: number;
  name: string;
  /** 0-10. 목업 값 — 위 주석 참고 */
  score: number;
};

export const TALENT_TYPES: TalentType[] = [
  { no: 1, name: "전문성", score: 8.4 },
  { no: 2, name: "융합력", score: 6.1 },
  { no: 3, name: "협업력", score: 7.8 },
  { no: 4, name: "도전성", score: 7.2 },
  { no: 5, name: "혁신성", score: 6.9 },
  { no: 6, name: "신뢰성", score: 8.0 },
  { no: 7, name: "책임감", score: 8.7 },
  { no: 8, name: "공정성", score: 7.4 },
  { no: 9, name: "투명성", score: 7.1 },
  { no: 10, name: "공익성", score: 6.6 },
  { no: 11, name: "헌신성", score: 7.0 },
  { no: 12, name: "소통력", score: 8.2 },
  { no: 13, name: "글로벌역량", score: 5.4 },
  { no: 14, name: "리더십", score: 6.8 },
  { no: 15, name: "분석력", score: 9.1 },
  { no: 16, name: "정책기획력", score: 6.3 },
  { no: 17, name: "창의성", score: 7.6 },
  { no: 18, name: "연구력", score: 9.3 },
  { no: 19, name: "AI활용력", score: 5.8 },
  { no: 20, name: "디지털역량", score: 6.2 },
  { no: 21, name: "실무전문성", score: 8.1 },
  { no: 22, name: "근면성", score: 7.9 },
  { no: 23, name: "성실성", score: 8.3 },
  { no: 24, name: "협력", score: 7.7 },
  { no: 25, name: "팀워크", score: 7.5 },
  { no: 26, name: "고객지향성", score: 5.2 },
  { no: 27, name: "위기대응력", score: 6.5 },
  { no: 28, name: "비전제시력", score: 6.0 },
  { no: 29, name: "미래지향성", score: 7.3 },
  { no: 30, name: "수리력", score: 8.6 },
  { no: 31, name: "다양성", score: 6.4 },
  { no: 32, name: "포용성", score: 6.7 },
  { no: 33, name: "성장지향성", score: 7.8 },
  { no: 34, name: "자기계발력", score: 8.5 },
];

/**
 * 1안 — 이번 공고에 선정된 유형.
 * 미팅 자료의 「2025년 인재상으로 5가지 선택」 예시를 그대로 넣었다.
 * 나중에 공고별 설정(D 작업)으로 대체된다.
 */
export const SELECTED_TALENT_NOS = [12, 13, 29, 31, 32];
