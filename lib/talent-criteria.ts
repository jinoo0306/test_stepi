/**
 * 인재상 문항표 — 무엇을 묻고, 무엇을 근거로 판정하는가.
 *
 * 「STEPI 인재상 평가기준 구현 사양」 10절의 표를 그대로 옮겼다.
 * 판정 결과와 목 데이터는 talent-evaluation.ts 가 만든다. 여기는 정의만 둔다.
 *
 * `pending: true` 는 표의 「( 작성 필요 )」 칸이다. 근거로 쓸 DB 필드가 없어
 * 아직 문항을 만들지 못했고, 화면에는 N(문항 미확정)으로 나온다.
 * 이 상태가 그대로 보이는 것이 확정 논의의 자료가 되므로 감추지 않는다.
 */

export type JudgedBy = "code" | "llm";
export type SourceField = "papers" | "education" | "career" | "essays";
export type ItemFlag = "date_calc" | "judgment_boundary" | "data_sparse";

export type CriterionDef = {
  no: number;
  name: string;
  question: string;
  judged_by: JudgedBy;
  rule: string;
  x_example?: string;
  source_fields: SourceField[];
  /** "논문-2" = 논문 계단의 두 번째 단. 판정 기준은 LADDER_RULES 가 갖는다 */
  ladder?: string;
  flags?: ItemFlag[];
  /** 문항 미확정 자리 */
  pending?: boolean;
};

/**
 * 계단 문항의 판정 기준.
 *
 * 계단은 같은 사실을 난이도로 나눈 것이라, 판정도 **같은 값 하나**를 봐야 한다.
 * 단마다 따로 판정하면 "3편은 X 인데 5편은 O" 같은 모순이 생긴다.
 * need[step-1] 이 그 단을 넘기는 데 필요한 값이다.
 */
export type LadderSource =
  | "paper_count"
  | "coauthor_count"
  | "recent_paper_count"
  | "degree_level"
  | "tenure_months";

export const LADDER_RULES: Record<string, { source: LadderSource; need: number[] }> = {
  학위: { source: "degree_level", need: [1, 2] },        // 석사 이상 / 박사
  논문: { source: "paper_count", need: [1, 3, 5] },
  연구: { source: "paper_count", need: [1, 5, 10] },
  공저: { source: "coauthor_count", need: [1, 3, 5] },
  최신: { source: "recent_paper_count", need: [1, 3, 5] },
  재직: { source: "tenure_months", need: [36, 60] },      // 3년 / 5년
};

/** 계단 문자열을 그룹과 단으로 나눈다. 형식이 어긋나면 null */
export function parseLadder(ladder: string): { group: string; step: number } | null {
  const [group, stepText] = ladder.split("-");
  const step = Number(stepText);
  if (!group || !Number.isInteger(step) || step < 1) return null;
  if (!LADDER_RULES[group]) return null;
  return { group, step };
}

/** 아직 문항을 만들지 못한 칸 */
function pending(no: number): CriterionDef {
  return {
    no,
    name: "문항 미확정",
    question: "아직 문항이 확정되지 않았습니다.",
    judged_by: "code",
    rule: "근거로 쓸 데이터 필드가 없어 문항을 만들지 못했습니다.",
    source_fields: [],
    pending: true,
  };
}

export const AXIS_CRITERIA: Record<string, CriterionDef[]> = {
  전문성: [
    { no: 1, name: "석사 학위", question: "석사 이상 학위를 취득하였는가?", judged_by: "code", rule: "education[].degree 에 '석사' 또는 '박사' 포함 AND status='졸업'", x_example: "재학·수료·휴학은 X", source_fields: ["education"], ladder: "학위-1" },
    { no: 2, name: "박사 학위", question: "박사 학위를 취득하였는가?", judged_by: "code", rule: "education[].degree='박사' AND status='졸업'", x_example: "수료(ABD)는 X", source_fields: ["education"], ladder: "학위-2" },
    { no: 3, name: "논문 1편", question: "학술지 게재 논문이 1편 이상인가?", judged_by: "code", rule: "papers 배열 길이 ≥ 1", source_fields: ["papers"], ladder: "논문-1" },
    { no: 4, name: "논문 3편", question: "학술지 게재 논문이 3편 이상인가?", judged_by: "code", rule: "papers 배열 길이 ≥ 3", source_fields: ["papers"], ladder: "논문-2" },
    { no: 5, name: "논문 5편", question: "학술지 게재 논문이 5편 이상인가?", judged_by: "code", rule: "papers 배열 길이 ≥ 5", source_fields: ["papers"], ladder: "논문-3" },
    { no: 6, name: "주저자 논문", question: "주저자·제1저자·단독저자 논문이 1편 이상인가?", judged_by: "code", rule: "claimed_role ∈ {주저자, 제1저자, 단독저자}", x_example: "공동저자·제2저자만 있으면 X", source_fields: ["papers"] },
    { no: 7, name: "교신저자 논문", question: "교신저자 논문이 1편 이상인가?", judged_by: "code", rule: "claimed_role='교신저자'", source_fields: ["papers"] },
    { no: 8, name: "동일분야 경력 2년", question: "지원 직무와 동일 분야 경력이 2년 이상인가?", judged_by: "code", rule: "job_field 관련 career 항목의 (end_date − start_date) 합산 ≥ 24개월", source_fields: ["career"], flags: ["date_calc"] },
    { no: 9, name: "전공-직무 일치", question: "최종 학력 전공계열이 지원 직무 분야와 일치하는가?", judged_by: "code", rule: "education[-1].major_field 와 job_field 대조", source_fields: ["education"] },
    { no: 10, name: "전문지식 활용", question: "전문지식을 활용해 문제를 해결한 사례를 기술하였는가?", judged_by: "llm", rule: "문제 상황 · 적용한 지식 · 결과가 모두 서술된 경우", x_example: "'전문성을 기르겠다'는 의지 표현만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
  ],
  연구력: [
    { no: 1, name: "논문 1편", question: "학술지 게재 논문이 1편 이상인가?", judged_by: "code", rule: "papers 길이 ≥ 1", source_fields: ["papers"], ladder: "연구-1" },
    { no: 2, name: "논문 5편", question: "학술지 게재 논문이 5편 이상인가?", judged_by: "code", rule: "papers 길이 ≥ 5", source_fields: ["papers"], ladder: "연구-2" },
    { no: 3, name: "논문 10편", question: "학술지 게재 논문이 10편 이상인가?", judged_by: "code", rule: "papers 길이 ≥ 10", source_fields: ["papers"], ladder: "연구-3" },
    { no: 4, name: "주저자 3편", question: "주저자 논문이 3편 이상인가?", judged_by: "code", rule: "claimed_role ∈ {주저자,제1저자,단독저자} 3건 이상", source_fields: ["papers"] },
    { no: 5, name: "학술지 다양성", question: "서로 다른 학술지에 3종 이상 게재하였는가?", judged_by: "code", rule: "claimed_journal 고유값 ≥ 3", source_fields: ["papers"] },
    { no: 6, name: "연구 지속성", question: "최초 게재와 최근 게재의 간격이 3년 이상인가?", judged_by: "code", rule: "max(claimed_year) − min(claimed_year) ≥ 3", source_fields: ["papers"] },
    { no: 7, name: "박사 학위", question: "박사 학위를 취득하였는가?", judged_by: "code", rule: "education.degree='박사' AND status='졸업'", source_fields: ["education"] },
    { no: 8, name: "연구직 경력", question: "연구직 직위로 근무한 이력이 있는가?", judged_by: "code", rule: "career.title 에 연구원·연구위원·연구교수 등 포함", source_fields: ["career"] },
    { no: 9, name: "연구직 3년", question: "연구직 경력이 3년 이상인가?", judged_by: "code", rule: "해당 career 항목의 (end_date − start_date) 합산 ≥ 36개월", source_fields: ["career"], flags: ["date_calc"] },
    { no: 10, name: "원문 검증", question: "논문 원문(PDF)이 제출되어 매칭되었는가?", judged_by: "code", rule: "match_status='matched'", x_example: "meta_only 는 X", source_fields: ["papers"], flags: ["data_sparse"] },
  ],
  융합력: [
    { no: 1, name: "복수전공", question: "복수전공 또는 부전공을 이수하였는가?", judged_by: "code", rule: "education[].major 에 줄바꿈 존재 = 전공 2개 이상", source_fields: ["education"] },
    { no: 2, name: "계열 상이 복수전공", question: "복수전공의 계열이 서로 다른가?", judged_by: "code", rule: "major_field 를 줄바꿈으로 분리 후 계열명 비교", x_example: "동일 계열 내 세부전공은 X", source_fields: ["education"] },
    { no: 3, name: "학부-대학원 전공 전환", question: "학부와 대학원 전공계열이 다른가?", judged_by: "code", rule: "kind='대학교' 와 '대학원' 의 major_field 계열 비교", x_example: "동일 계열은 X", source_fields: ["education"] },
    { no: 4, name: "복수 기관 경력", question: "서로 다른 2개 이상 기관에서 근무한 이력이 있는가?", judged_by: "code", rule: "career[].company 고유값 ≥ 2", source_fields: ["career"] },
    { no: 5, name: "직무 다양성", question: "서로 다른 2종 이상의 직무를 수행한 이력이 있는가?", judged_by: "llm", rule: "career[].duties 가 실질적으로 상이한 직무인 경우", x_example: "같은 직무를 다르게 표현한 경우 X", source_fields: ["career"], flags: ["judgment_boundary"] },
    { no: 6, name: "전공 외 경력", question: "전공계열과 다른 분야의 경력을 보유하였는가?", judged_by: "llm", rule: "education.major_field 와 career.duties 가 다른 분야", source_fields: ["education", "career"], flags: ["judgment_boundary"] },
    { no: 7, name: "학제간 경험 기술", question: "2개 이상 학문·기술 분야가 결합된 경험을 기술하였는가?", judged_by: "llm", rule: "결합된 두 분야가 모두 명시된 경우", x_example: "분야 언급만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 8, name: "타분야 지식 활용", question: "타 분야의 지식·방법론을 자신의 업무에 적용한 사례를 기술하였는가?", judged_by: "llm", rule: "적용한 방법과 대상이 함께 명시", source_fields: ["essays"], flags: ["judgment_boundary"] },
    pending(9),
    pending(10),
  ],
  협업력: [
    { no: 1, name: "공저 논문 1편", question: "공동저자로 참여한 논문이 1편 이상인가?", judged_by: "code", rule: "claimed_author_order '(n/m)' 에서 m ≥ 2 인 논문 1건 이상", x_example: "단독저자 (1/1) 만 있으면 X", source_fields: ["papers"], ladder: "공저-1" },
    { no: 2, name: "공저 논문 3편", question: "공동저자로 참여한 논문이 3편 이상인가?", judged_by: "code", rule: "동일 기준 3건 이상", source_fields: ["papers"], ladder: "공저-2" },
    { no: 3, name: "공저 논문 5편", question: "공동저자로 참여한 논문이 5편 이상인가?", judged_by: "code", rule: "동일 기준 5건 이상", source_fields: ["papers"], ladder: "공저-3" },
    { no: 4, name: "대규모 공동연구", question: "저자 4인 이상 논문에 참여한 이력이 있는가?", judged_by: "code", rule: "claimed_author_order 의 전체 저자수 ≥ 4", source_fields: ["papers"] },
    { no: 5, name: "공동저자 역할", question: "공동저자 역할로 참여한 논문이 있는가?", judged_by: "code", rule: "claimed_role='공동저자'", source_fields: ["papers"] },
    { no: 6, name: "조직 소속 근무", question: "부서 단위 조직에 소속되어 근무한 이력이 있는가?", judged_by: "code", rule: "career[].department 값이 존재", source_fields: ["career"] },
    { no: 7, name: "동일 조직 2년", question: "동일 기관에서 2년 이상 근무한 이력이 있는가?", judged_by: "code", rule: "동일 company 의 (end_date − start_date) 합산 ≥ 24개월", source_fields: ["career"], flags: ["date_calc"] },
    { no: 8, name: "팀 내 역할 기술", question: "팀 활동에서 본인이 담당한 역할을 구체적으로 기술하였는가?", judged_by: "llm", rule: "담당 업무가 특정되는 경우", x_example: "'협업했다'는 서술만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 9, name: "조율 사례 기술", question: "이견 조정·의견 조율 경험을 결과와 함께 기술하였는가?", judged_by: "llm", rule: "상황 · 행동 · 결과가 모두 존재", x_example: "'소통을 중시한다'는 표현만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 10, name: "지도·멘토링", question: "후배·팀원을 지도한 경험을 기술하였는가?", judged_by: "llm", rule: "대상과 내용이 명시", source_fields: ["essays"], flags: ["judgment_boundary"] },
  ],
  혁신성: [
    { no: 1, name: "최근 1년 실적", question: "최근 1년 이내 게재된 논문이 1편 이상인가?", judged_by: "code", rule: "claimed_year ≥ (기준연도 − 1)", source_fields: ["papers"], ladder: "최신-1" },
    { no: 2, name: "최근 3년 3편", question: "최근 3년 이내 게재된 논문이 3편 이상인가?", judged_by: "code", rule: "claimed_year ≥ (기준연도 − 3) 인 논문 3건", source_fields: ["papers"], ladder: "최신-2" },
    { no: 3, name: "최근 5년 5편", question: "최근 5년 이내 게재된 논문이 5편 이상인가?", judged_by: "code", rule: "claimed_year ≥ (기준연도 − 5) 인 논문 5건", source_fields: ["papers"], ladder: "최신-3" },
    { no: 4, name: "현재 활동 중", question: "현재 재직 중인 경력이 있는가?", judged_by: "code", rule: "career[].end_date='재직중'", source_fields: ["career"], flags: ["date_calc"] },
    { no: 5, name: "최근 학위", question: "최근 3년 이내 학위를 취득하였는가?", judged_by: "code", rule: "education[].end_date 가 기준일로부터 36개월 이내", source_fields: ["education"], flags: ["date_calc"] },
    { no: 6, name: "신기술 적용", question: "최신 기술·방법론을 실제 업무에 적용한 사례를 기술하였는가?", judged_by: "llm", rule: "기술명과 적용 결과가 함께 명시", x_example: "기술 언급만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 7, name: "AI·데이터 활용", question: "AI 또는 데이터 분석 기술을 활용한 실적을 기술하였는가?", judged_by: "llm", rule: "도구·기법과 적용 대상이 명시", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 8, name: "정량적 개선", question: "기존 방식을 개선하고 결과를 수치로 제시하였는가?", judged_by: "llm", rule: "개선 전후 수치가 명시", x_example: "'효율을 높였다'는 서술만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    pending(9),
    pending(10),
  ],
  도전성: [
    { no: 1, name: "전공 전환", question: "학부와 대학원 전공계열을 전환한 이력이 있는가?", judged_by: "code", rule: "education 항목 간 major_field 계열 상이", source_fields: ["education"] },
    { no: 2, name: "직무 전환", question: "경력 중 직무를 전환한 이력이 있는가?", judged_by: "llm", rule: "career 를 start_date 순 정렬 시 duties 가 실질 변경", source_fields: ["career"], flags: ["judgment_boundary"] },
    { no: 3, name: "재직 중 학위", question: "재직하면서 학위를 취득한 이력이 있는가?", judged_by: "code", rule: "career 기간과 education 기간이 중첩", source_fields: ["career", "education"], flags: ["date_calc"] },
    { no: 4, name: "해외 이력", question: "해외 소재 학교 또는 기관에서 수학·근무한 이력이 있는가?", judged_by: "code", rule: "education.school 또는 career.company 가 해외 소재", source_fields: ["education", "career"] },
    { no: 5, name: "고용형태 다양", question: "정규직 외 고용형태(계약·파견 등) 경험이 있는가?", judged_by: "code", rule: "career[].employment_type 에 정규직 외 값 존재", source_fields: ["career"] },
    { no: 6, name: "실패 경험 기술", question: "실패·시행착오 경험과 원인 분석을 함께 기술하였는가?", judged_by: "llm", rule: "실패 사실과 원인 분석이 모두 존재", x_example: "어려움 나열만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 7, name: "새로운 영역 도전", question: "기존에 해보지 않은 영역에 도전한 사례를 기술하였는가?", judged_by: "llm", rule: "이전 경험과의 차이가 명시", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 8, name: "고난도 과제", question: "난이도 높은 과제를 자발적으로 수행한 사례를 기술하였는가?", judged_by: "llm", rule: "자발성과 과제 성격이 함께 기술", source_fields: ["essays"], flags: ["judgment_boundary"] },
    pending(9),
    pending(10),
  ],
  창의성: [
    { no: 1, name: "단독 연구", question: "단독저자 논문이 1편 이상인가?", judged_by: "code", rule: "claimed_role='단독저자' 또는 claimed_author_order='(1/1)'", source_fields: ["papers"] },
    { no: 2, name: "주저자 3편", question: "주저자 논문이 3편 이상인가?", judged_by: "code", rule: "claimed_role ∈ {주저자,제1저자} 3건 이상", source_fields: ["papers"] },
    { no: 3, name: "연구 주제 확장", question: "서로 다른 주제 영역의 논문을 보유하였는가?", judged_by: "llm", rule: "claimed_title 의 주제가 2개 군 이상으로 나뉨", source_fields: ["papers"], flags: ["judgment_boundary"] },
    { no: 4, name: "독창적 방법 제안", question: "기존과 다른 방법·접근을 제안한 사례를 기술하였는가?", judged_by: "llm", rule: "기존 방법과의 차이가 명시", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 5, name: "한계 지적·대안", question: "기존 방식의 한계를 지적하고 대안을 제시한 사례를 기술하였는가?", judged_by: "llm", rule: "한계와 대안이 모두 존재", x_example: "비판만 있으면 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    { no: 6, name: "산출물 구축", question: "새로운 도구·데이터셋·프로세스를 만든 경험을 기술하였는가?", judged_by: "llm", rule: "산출물명과 용도가 명시", source_fields: ["essays"], flags: ["judgment_boundary"] },
    pending(7),
    pending(8),
    pending(9),
    pending(10),
  ],
  신뢰성: [
    { no: 1, name: "동일기관 3년", question: "동일 기관에서 3년 이상 근무한 이력이 있는가?", judged_by: "code", rule: "동일 company 의 (end_date − start_date) 합산 ≥ 36개월", source_fields: ["career"], ladder: "재직-1", flags: ["date_calc"] },
    { no: 2, name: "동일기관 5년", question: "동일 기관에서 5년 이상 근무한 이력이 있는가?", judged_by: "code", rule: "동일 기준 60개월 이상", source_fields: ["career"], ladder: "재직-2", flags: ["date_calc"] },
    { no: 3, name: "누적 경력 5년", question: "누적 경력이 5년 이상인가?", judged_by: "code", rule: "전체 career 의 (end_date − start_date) 합산 ≥ 60개월", source_fields: ["career"], flags: ["date_calc"] },
    { no: 4, name: "학위 정상 취득", question: "기재한 학위 과정을 모두 졸업하였는가?", judged_by: "code", rule: "education[].status 가 모두 '졸업'", x_example: "중퇴·제적 포함 시 X", source_fields: ["education"] },
    { no: 5, name: "경력 기간 정합", question: "경력 항목 간 기간이 서로 모순되지 않는가?", judged_by: "code", rule: "기간 역전(end < start) 및 비정상 중복이 없음", source_fields: ["career"], flags: ["date_calc"] },
    { no: 6, name: "학력 기재 일치", question: "자기소개서에 언급한 학력이 education 데이터와 일치하는가?", judged_by: "llm", rule: "학교·전공·학위에 모순이 없는 경우", source_fields: ["essays", "education"], flags: ["judgment_boundary"] },
    { no: 7, name: "논문 기재 일치", question: "자기소개서에 언급한 논문 실적이 papers 데이터와 일치하는가?", judged_by: "llm", rule: "편수·저널에 모순이 없는 경우", source_fields: ["essays", "papers"], flags: ["judgment_boundary"] },
    { no: 8, name: "경력 공백 없음", question: "6개월을 초과하는 미설명 경력 공백이 없는가?", judged_by: "code", rule: "이전 end_date ~ 다음 start_date 간격 ≤ 6개월 또는 사유 기재", source_fields: ["career"], flags: ["date_calc"] },
    { no: 9, name: "문항 완결성", question: "자기소개서 전 문항에 응답하였는가?", judged_by: "code", rule: "essays[].answer 에 결측·공란 없음", source_fields: ["essays"] },
    { no: 10, name: "원문 검증", question: "제출 논문 중 원문(PDF)으로 검증된 건이 있는가?", judged_by: "code", rule: "match_status='matched' 1건 이상", source_fields: ["papers"], flags: ["data_sparse"] },
  ],
  투명성: [
    { no: 1, name: "논문 서지 완전성", question: "논문 서지정보(제목·학술지·연도)를 모두 기재하였는가?", judged_by: "code", rule: "claimed_title / claimed_journal / claimed_year 모두 존재", x_example: "하나라도 누락 시 X", source_fields: ["papers"] },
    { no: 2, name: "저자 정보 기재", question: "논문의 저자 순위·역할을 기재하였는가?", judged_by: "code", rule: "claimed_author_order 또는 claimed_role 존재", source_fields: ["papers"] },
    { no: 3, name: "경력 정보 완전성", question: "경력의 소속·직위·기간을 모두 기재하였는가?", judged_by: "code", rule: "company / title / start_date 모두 존재", source_fields: ["career"] },
    { no: 4, name: "학력 정보 완전성", question: "학력의 학교·전공·기간·상태를 모두 기재하였는가?", judged_by: "code", rule: "school / major / start_date / status 모두 존재", source_fields: ["education"] },
    { no: 5, name: "원문 제출", question: "논문 원문을 제출하여 기재 내용을 검증 가능하게 하였는가?", judged_by: "code", rule: "match_status='matched'", source_fields: ["papers"], flags: ["data_sparse"] },
    { no: 6, name: "한계·제약 명시", question: "업무·연구의 한계나 제약을 명시적으로 기술하였는가?", judged_by: "llm", rule: "한계 서술이 존재", x_example: "성과만 나열한 경우 X", source_fields: ["essays"], flags: ["judgment_boundary"] },
    pending(7),
    pending(8),
    pending(9),
    pending(10),
  ],
  성실성: [
    { no: 1, name: "학위 정상 취득", question: "기재한 학위 과정을 모두 졸업하였는가?", judged_by: "code", rule: "education[].status 가 모두 '졸업'", source_fields: ["education"] },
    { no: 2, name: "정규 학기 취득", question: "학위를 정규 수업연한 내에 취득하였는가?", judged_by: "code", rule: "(end_date − start_date) 가 학사 4년 · 석사 2년 · 박사 4년 이내", source_fields: ["education"], flags: ["date_calc"] },
    { no: 3, name: "누적 경력 5년", question: "누적 경력이 5년 이상인가?", judged_by: "code", rule: "전체 career 기간 합산 ≥ 60개월", source_fields: ["career"], flags: ["date_calc"] },
    { no: 4, name: "단기 이직 제한", question: "1년 미만 재직 후 이직한 이력이 2회 미만인가?", judged_by: "code", rule: "기간 12개월 미만인 종료 경력이 1건 이하", x_example: "재직중 항목은 제외", source_fields: ["career"], flags: ["date_calc"] },
    { no: 5, name: "실적 지속성", question: "최근 5년간 논문 실적이 매년 존재하는가?", judged_by: "code", rule: "claimed_year 가 최근 5개 연도를 모두 포함", source_fields: ["papers"] },
    { no: 6, name: "게재 지속 기간", question: "논문 게재 활동을 5년 이상 지속하였는가?", judged_by: "code", rule: "max(claimed_year) − min(claimed_year) ≥ 5", source_fields: ["papers"] },
    { no: 7, name: "문항 완결성", question: "자기소개서 전 문항에 응답하였는가?", judged_by: "code", rule: "essays[].answer 결측 없음", source_fields: ["essays"] },
    { no: 8, name: "응답 충실성", question: "자기소개서 각 문항이 최소 분량을 충족하는가?", judged_by: "code", rule: "모든 문항이 기준 글자수 이상", source_fields: ["essays"] },
    { no: 9, name: "경력 공백 없음", question: "6개월을 초과하는 미설명 경력 공백이 없는가?", judged_by: "code", rule: "이전 end_date ~ 다음 start_date 간격 ≤ 6개월 또는 사유 기재", source_fields: ["career"], flags: ["date_calc"] },
    pending(10),
  ],
};

/**
 * 문항표가 없는 유형에 쓰는 목업 문항.
 *
 * 근거 필드를 각 문항에 직접 적는다. 예전에는 인덱스 산술로 배정했는데,
 * 그 결과 「학력 근거」 문항에 논문이 붙는 어긋남이 24개 유형 전부에서 났다.
 */
const TEMPLATE_SHAPES: Array<{
  name: string;
  question: (n: string) => string;
  judged_by: JudgedBy;
  rule: string;
  field: SourceField;
}> = [
  { name: "관련 경험", question: (n) => `${n}을(를) 발휘한 경험을 시점·역할과 함께 기술하였는가?`, judged_by: "llm", rule: "시점 · 역할 · 결과가 함께 서술된 경우", field: "essays" },
  { name: "구체적 사례", question: (n) => `${n}이(가) 드러나는 구체적 사례를 제시하였는가?`, judged_by: "llm", rule: "사례의 상황과 행동이 특정되는 경우", field: "essays" },
  { name: "성과 기술", question: (n) => `${n} 관련 활동의 결과를 기술하였는가?`, judged_by: "llm", rule: "활동의 결과가 명시된 경우", field: "essays" },
  { name: "학력 근거", question: (n) => `${n}과(와) 연관된 전공·학위를 보유하였는가?`, judged_by: "code", rule: "education 의 전공계열 대조", field: "education" },
  { name: "경력 근거", question: (n) => `${n}과(와) 연관된 직무 경력이 있는가?`, judged_by: "code", rule: "career 의 직위·업무 대조", field: "career" },
  { name: "지속성", question: (n) => `${n} 관련 활동을 2년 이상 지속하였는가?`, judged_by: "code", rule: "관련 항목 기간 합산 ≥ 24개월", field: "career" },
  { name: "연구 실적", question: (n) => `${n}과(와) 연관된 논문 실적이 있는가?`, judged_by: "code", rule: "papers 의 주제 대조", field: "papers" },
  { name: "협업 맥락", question: (n) => `${n}을(를) 조직 안에서 발휘한 사례를 기술하였는가?`, judged_by: "llm", rule: "조직 맥락이 함께 서술된 경우", field: "essays" },
  { name: "개선 사례", question: (n) => `${n}을(를) 통해 기존 방식을 개선한 사례가 있는가?`, judged_by: "llm", rule: "개선 전후가 비교되는 경우", field: "essays" },
  { name: "자기 평가", question: (n) => `${n}에 대한 스스로의 한계를 함께 기술하였는가?`, judged_by: "llm", rule: "한계 서술이 존재하는 경우", field: "essays" },
];

/** 유형 이름마다 한 번만 만들어 재사용한다 */
const templateCache = new Map<string, CriterionDef[]>();

function buildTemplate(name: string): CriterionDef[] {
  return TEMPLATE_SHAPES.map((s, i) => ({
    no: i + 1,
    name: s.name,
    question: s.question(name),
    judged_by: s.judged_by,
    rule: s.rule,
    source_fields: [s.field],
    flags: s.judged_by === "llm" ? (["judgment_boundary"] as ItemFlag[]) : [],
  }));
}

/** 이 유형에 문항표가 있는가 */
export function hasCriteria(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(AXIS_CRITERIA, name);
}

/** 문항표가 있으면 그것을, 없으면 목업 문항을 돌려준다 */
export function criteriaOf(name: string): CriterionDef[] {
  if (hasCriteria(name)) return AXIS_CRITERIA[name];
  let cached = templateCache.get(name);
  if (!cached) {
    cached = buildTemplate(name);
    templateCache.set(name, cached);
  }
  return cached;
}
