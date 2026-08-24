/**
 * 인재상 채점 결과 — 타입 + 목 데이터.
 *
 * ── 이 파일은 전부 목업이다.
 *    백엔드 판정 로직은 아직 논의 중이며, 문항표에도 미확정 칸이 남아 있다.
 *    화면을 먼저 만들기 위한 가짜 데이터이고, 백엔드가 붙으면
 *    `getEvaluation` 을 API 호출로 바꾸면 된다. 문항 정의는 talent-criteria.ts 에 있다.
 *
 * ── 타입은 「STEPI 인재상 평가기준 구현 사양」 7절을 그대로 옮겼다.
 *    필드명을 snake_case 로 둔 것은 의도적이다. 카멜케이스로 바꾸면 응답과 화면
 *    사이에 변환층이 하나 생기고, 계약이 맞는지 눈으로 대조하기 어려워진다.
 *
 * ── 채점 방식
 *    인재상 하나를 사실 확인 문항 10개로 쪼갠다. 각 문항은 O / X / N 하나로만 답한다.
 *      O = 충족 (근거 필수)
 *      X = 미충족, 또는 해당 내용 없음
 *      N = 판정 불가. 근거 데이터 자체가 없다 → **분모에서 뺀다**
 *
 *      점수 = (O 개수 ÷ 유효 문항 수) × 10,   유효 문항 수 = 10 − N 개수
 *
 *    N 을 분모에서 빼는 이유: 경력 데이터가 있는 지원자는 351명 중 273명(78%)뿐이다.
 *    나머지 78명에게 X 를 주면 "데이터 미수집"이 "경력 부족"으로 둔갑한다.
 *
 * ── 판정과 근거는 반드시 같은 값을 본다.
 *    지원자마다 가짜 논문·경력·학력 목록을 **먼저 한 벌 만들고**, 판정도 근거도
 *    그 목록에서 뽑는다. 예전에는 판정을 해시로 따로 굴려서
 *    "논문 5편 이상 O" 인데 근거가 1장인 화면이 나왔다. 그러면 이 기능의 전제가 무너진다.
 */

import { TALENT_TYPES } from "./talent-types";
import {
  criteriaOf,
  hasCriteria,
  parseLadder,
  LADDER_RULES,
  type CriterionDef,
  type JudgedBy,
  type SourceField,
  type ItemFlag,
} from "./talent-criteria";

export type { JudgedBy, SourceField, ItemFlag };

export type Verdict = "O" | "X" | "N";

export interface Evidence {
  type: "paper" | "education" | "career" | "essay";
  // paper
  title?: string;
  journal?: string;
  year?: string;
  /** "(본인순위/전체저자수)" 형식 */
  author_order?: string;
  match_status?: "matched" | "meta_only";
  // education / career
  school?: string;
  company?: string;
  title_text?: string;
  degree?: string;
  status?: string;
  /** "2019.03.02 ~ 2021.05.01 (26개월)" */
  period_text?: string;
  major?: string;
  major_field?: string;
  // essay
  essay_index?: number;
  question?: string;
  /** 원문 인용 (LLM 판정 시) */
  quote?: string;
}

export interface ItemResult {
  /** "전문성-4" */
  item_id: string;
  no: number;
  name: string;
  question: string;
  verdict: Verdict;
  judged_by: JudgedBy;
  rule: string;
  x_example: string | null;
  source_fields: SourceField[];
  ladder: string | null;
  flags: ItemFlag[];
  /** N 인 경우 사유 */
  reason: string | null;
}

export interface AxisResult {
  axis: string;
  /** lib/talent-types.ts 의 번호 */
  no: number;
  /** 유효 문항 기준 점수. 전 문항이 N 이면 null (판정 불가) */
  score: number | null;
  o_count: number;
  x_count: number;
  n_count: number;
  /** 10 − n_count */
  effective_total: number;
  /** 유효 문항이 충분한가. 적으면 점수를 그대로 비교하면 안 된다 */
  enough: boolean;
  /** 사양서에 문항표가 있는 인재상인지. false 면 문항 자체가 목업이다 */
  defined: boolean;
  items: ItemResult[];
}

export interface ApplicantEvaluation {
  applicant_id: string;
  /** 사양서 계약 필드. 재현성 추적용이며 아직 화면에 쓰지 않는다 */
  evaluated_at: string;
  prompt_version: string;
  axes: AxisResult[];
}

/** 인재상 하나당 문항 수 */
export const CRITERIA_PER_AXIS = 10;
/** 점수 만점 */
export const TALENT_SCORE_MAX = 10;

/**
 * 점수를 그대로 비교해도 되는 최소 유효 문항 수.
 *
 * 유효 문항이 1개인데 그 하나가 O 면 10점이 되어 34개 중 공동 1위가 된다.
 * 숫자는 같아도 근거의 두께가 전혀 다르므로, 이 아래는 순위에서 내리고
 * 화면에 이유를 밝힌다.
 */
export const MIN_EFFECTIVE_ITEMS = 3;

/* ────────────────────────────────────────────────────────────
   목 데이터 생성

   **결정적이어야 한다.** 지원자 상세 페이지는 서버 컴포넌트이고
   화면 컴포넌트는 클라이언트다. Math.random() 을 쓰면 서버가 그린 HTML 과
   브라우저가 그린 결과가 달라 hydration 이 깨진다.
   그래서 지원자 id 와 문항 id 를 섞은 해시로만 값을 정한다.
   ──────────────────────────────────────────────────────────── */

/** FNV-1a. 짧고 분포가 고른 비암호용 해시 */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roll(seed: string, mod: number): number {
  if (mod <= 0) return 0;
  return hash(seed) % mod;
}

function pickFrom<T>(seed: string, pool: readonly T[]): T | undefined {
  if (pool.length === 0) return undefined;
  return pool[roll(seed, pool.length)];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const PAPER_TITLES = [
  "국가연구개발사업 성과지표 재설계에 관한 연구",
  "기술혁신 정책수단의 효과성 비교분석",
  "지역 혁신클러스터의 성장요인 실증분석",
  "공공 R&D 투자의 민간 유발효과 추정",
  "탄소중립 기술로드맵의 우선순위 도출",
  "과학기술인력 수급전망 모형 개선방안",
  "데이터 기반 정책평가 체계 구축 방안",
  "인공지능 도입이 연구생산성에 미치는 영향",
];

const JOURNALS = [
  "과학기술정책",
  "기술혁신연구",
  "STI Policy Review",
  "정책분석평가학회보",
  "한국혁신학회지",
  "기술경영경제학회지",
];

const COMPANIES = [
  "한국과학기술기획평가원",
  "산업연구원",
  "한국행정연구원",
  "대한기술정책연구소",
  "미래전략연구센터",
];

const JOB_TITLES = ["연구원", "선임연구원", "연구원(계약)", "전임연구원", "정책분석원"];

const SCHOOLS = ["가천대학교", "성균관대학교", "서울시립대학교", "경기대학교", "충남대학교"];

const MAJORS = [
  { major: "화공생명공학과\n글로벌경영학과", field: "공학계열(화공)\n상경계열(경영·경제)" },
  { major: "행정학과", field: "사회계열(행정)" },
  { major: "산업공학과\n경제학과", field: "공학계열(산업)\n상경계열(경영·경제)" },
  { major: "과학기술정책학과", field: "사회계열(정책)" },
];

const ESSAY_QUESTIONS = [
  "지원 동기와 입사 후 포부를 기술하시오",
  "직무 관련 경험을 기술하시오",
  "타인과 협업하여 성과를 낸 경험을 기술하시오",
  "가장 어려웠던 문제와 해결 과정을 기술하시오",
];

const ESSAY_QUOTES = [
  "기존 회귀모형의 다중공선성 문제를 진단하고 릿지 회귀로 대체하여 예측오차를 18% 낮췄습니다",
  "설계팀과 매주 정기 회의를 열어 요구사항 충돌 지점을 먼저 정리한 뒤 우선순위를 합의했습니다",
  "초기 가설이 데이터와 맞지 않는다는 점을 인정하고 표본 추출 방식부터 다시 설계했습니다",
  "부서별로 흩어져 있던 집계 기준을 하나로 통일해 월간 보고 준비 시간을 이틀에서 반나절로 줄였습니다",
  "선행 연구가 다루지 않은 중소기업 표본을 별도로 분리해 분석 대상에 포함했습니다",
  "파이썬으로 수집 자동화 스크립트를 만들어 매주 반복하던 수작업을 없앴습니다",
];

/** 목 데이터의 기준 연도. 실제 시각을 쓰면 hydration 이 깨진다 */
const BASE_YEAR = 2026;

const DEGREES = ["학사", "석사", "박사"];

type MockPaper = {
  title: string;
  journal: string;
  year: number;
  mine: number;
  total: number;
  matched: boolean;
};

type MockCareer = {
  company: string;
  title_text: string;
  start_year: number;
  start_month: number;
  months: number;
  working: boolean;
};

type MockEducation = {
  school: string;
  major: string;
  major_field: string;
  /** 0 학사 · 1 석사 · 2 박사 */
  level: number;
  status: string;
  start_year: number;
  years: number;
};

/**
 * 지원자 한 명의 가짜 이력.
 * 판정도 근거도 전부 여기서 나온다. 커버리지는 실제와 비슷하게 맞췄다
 * (학력 84% · 경력 78%).
 */
export type MockProfile = {
  papers: MockPaper[];
  careers: MockCareer[];
  educations: MockEducation[];
  paper_count: number;
  coauthor_count: number;
  /** 최근 3년(BASE_YEAR-2 이후) 게재 편수 */
  recent_paper_count: number;
  /** 0 학사 · 1 석사 · 2 박사. 학력이 없으면 0 */
  degree_level: number;
  /** 한 기관에서 가장 오래 일한 개월 수 */
  tenure_months: number;
};

function buildPapers(applicantId: string): MockPaper[] {
  const count = roll(`${applicantId}|papers`, 13);
  // 실제로는 1022건 중 12건만 matched 다. 배지를 확인할 수 있을 정도로만 둔다
  const hasMatched = roll(`${applicantId}|matched`, 100) < 12;
  return Array.from({ length: count }, (_, i) => {
    const s = `${applicantId}|paper|${i}`;
    const total = 1 + roll(`${s}|authors`, 4);
    return {
      title: pickFrom(s, PAPER_TITLES) ?? PAPER_TITLES[0],
      journal: pickFrom(`${s}|j`, JOURNALS) ?? JOURNALS[0],
      year: BASE_YEAR - roll(`${s}|y`, 5),
      total,
      mine: 1 + roll(`${s}|mine`, total),
      matched: hasMatched && i === 0,
    };
  });
}

function buildCareers(applicantId: string): MockCareer[] {
  if (roll(`${applicantId}|career`, 100) >= 78) return [];
  const count = 1 + roll(`${applicantId}|career-n`, 3);
  return Array.from({ length: count }, (_, i) => {
    const s = `${applicantId}|career|${i}`;
    return {
      company: pickFrom(s, COMPANIES) ?? COMPANIES[0],
      title_text: pickFrom(`${s}|t`, JOB_TITLES) ?? JOB_TITLES[0],
      start_year: 2014 + roll(`${s}|sy`, 9),
      start_month: 1 + roll(`${s}|sm`, 12),
      months: 6 + roll(`${s}|m`, 60),
      working: roll(`${s}|w`, 100) < 26,
    };
  });
}

function buildEducations(applicantId: string): MockEducation[] {
  if (roll(`${applicantId}|edu`, 100) >= 84) return [];
  // 최종 학력까지 차곡차곡 쌓는다. 학사만, 학사+석사, 학사+석사+박사
  const top = roll(`${applicantId}|degree`, 3);
  let year = 2008 + roll(`${applicantId}|edu-start`, 8);
  const out: MockEducation[] = [];
  for (let level = 0; level <= top; level += 1) {
    const s = `${applicantId}|edu|${level}`;
    const m = pickFrom(s, MAJORS) ?? MAJORS[0];
    const years = level === 0 ? 4 : level === 1 ? 2 : 4;
    out.push({
      school: pickFrom(`${s}|s`, SCHOOLS) ?? SCHOOLS[0],
      major: m.major,
      major_field: m.field,
      level,
      status: "졸업",
      start_year: year,
      years,
    });
    year += years;
  }
  return out;
}

const profileCache = new Map<string, MockProfile>();

/** 지원자 한 명의 가짜 이력. 문항마다 다시 만들지 않도록 캐시한다 */
export function profileOf(applicantId: string): MockProfile {
  const cached = profileCache.get(applicantId);
  if (cached) return cached;

  const papers = buildPapers(applicantId);
  const careers = buildCareers(applicantId);
  const educations = buildEducations(applicantId);

  const profile: MockProfile = {
    papers,
    careers,
    educations,
    paper_count: papers.length,
    coauthor_count: papers.filter((p) => p.total >= 2).length,
    recent_paper_count: papers.filter((p) => p.year >= BASE_YEAR - 2).length,
    degree_level: educations.reduce((max, e) => Math.max(max, e.level), 0),
    tenure_months: careers.reduce((max, c) => Math.max(max, c.months), 0),
  };
  profileCache.set(applicantId, profile);
  return profile;
}

/* ── 근거 만들기 ─────────────────────────────────────────── */

function careerPeriod(c: MockCareer): string {
  if (c.working) {
    return `${c.start_year}.${pad2(c.start_month)}.02 ~ 재직중 (${c.months}개월)`;
  }
  // 개월 수에서 종료 시점을 실제로 계산한다. 연도만 올리면 표기와 기간이 어긋난다
  const endTotal = c.start_year * 12 + (c.start_month - 1) + c.months;
  const ey = Math.floor(endTotal / 12);
  const em = (endTotal % 12) + 1;
  return `${c.start_year}.${pad2(c.start_month)}.02 ~ ${ey}.${pad2(em)}.01 (${c.months}개월)`;
}

function paperEvidence(p: MockPaper): Evidence {
  return {
    type: "paper",
    title: p.title,
    journal: p.journal,
    year: String(p.year),
    author_order: `(${p.mine}/${p.total})`,
    match_status: p.matched ? "matched" : "meta_only",
  };
}

function careerEvidence(c: MockCareer): Evidence {
  return {
    type: "career",
    company: c.company,
    title_text: c.title_text,
    period_text: careerPeriod(c),
  };
}

function educationEvidence(e: MockEducation): Evidence {
  return {
    type: "education",
    school: e.school,
    major: e.major,
    major_field: e.major_field,
    degree: DEGREES[e.level],
    status: e.status,
    period_text: `${e.start_year}.03.02 ~ ${e.start_year + e.years}.02.23`,
  };
}

function essayEvidence(seed: string): Evidence {
  const idx = roll(`${seed}|i`, ESSAY_QUESTIONS.length);
  return {
    type: "essay",
    essay_index: idx + 1,
    question: ESSAY_QUESTIONS[idx],
    quote: pickFrom(seed, ESSAY_QUOTES) ?? ESSAY_QUOTES[0],
  };
}

/** 화면에 한 번에 보여줄 근거 최대 개수 */
const EVIDENCE_LIMIT = 3;

/**
 * 이 문항의 근거.
 *
 * 판정과 같은 프로필을 보므로 "5편 이상 O 인데 근거 1장" 같은 모순이 생기지 않는다.
 * 목록을 그릴 때는 필요 없고 근거 패널을 열 때만 필요하므로, 그때 부른다.
 */
export function evidenceFor(applicantId: string, item: ItemResult): Evidence[] {
  if (item.verdict !== "O") return [];
  const profile = profileOf(applicantId);
  const seed = `${applicantId}|${item.item_id}`;

  // 계단 문항은 그 단을 넘긴 근거를 그 수만큼 보여준다
  if (item.ladder) {
    const parsed = parseLadder(item.ladder);
    if (parsed) {
      const rule = LADDER_RULES[parsed.group];
      const need = rule.need[parsed.step - 1] ?? 1;
      if (rule.source === "degree_level") {
        const e = profile.educations.find((x) => x.level >= need);
        return e ? [educationEvidence(e)] : [];
      }
      if (rule.source === "tenure_months") {
        const c = [...profile.careers].sort((a, b) => b.months - a.months)[0];
        return c ? [careerEvidence(c)] : [];
      }
      const pool =
        rule.source === "coauthor_count"
          ? profile.papers.filter((p) => p.total >= 2)
          : rule.source === "recent_paper_count"
            ? profile.papers.filter((p) => p.year >= BASE_YEAR - 2)
            : profile.papers;
      return pool.slice(0, Math.min(need, EVIDENCE_LIMIT)).map(paperEvidence);
    }
  }

  // 여러 소스를 대조하는 문항은 양쪽을 다 보여준다.
  // 예: "재직하면서 학위를 취득하였는가" 는 경력만 보여주면 중첩을 확인할 수 없다.
  const out: Evidence[] = [];
  for (const field of item.source_fields) {
    if (field === "papers") {
      out.push(...profile.papers.slice(0, EVIDENCE_LIMIT).map(paperEvidence));
    } else if (field === "career") {
      out.push(...profile.careers.slice(0, 2).map(careerEvidence));
    } else if (field === "education") {
      out.push(...profile.educations.slice(-1).map(educationEvidence));
    } else if (field === "essays") {
      out.push(essayEvidence(seed));
    }
  }
  return out;
}

/* ── 판정 ────────────────────────────────────────────────── */

function judgeItem(
  applicantId: string,
  axis: string,
  def: CriterionDef,
  profile: MockProfile,
): ItemResult {
  const item_id = `${axis}-${def.no}`;
  const base = {
    item_id,
    no: def.no,
    name: def.name,
    question: def.question,
    judged_by: def.judged_by,
    rule: def.rule,
    x_example: def.x_example ?? null,
    source_fields: def.source_fields,
    ladder: def.ladder ?? null,
    flags: def.flags ?? [],
  };

  const unjudged = (reason: string): ItemResult => ({ ...base, verdict: "N", reason });

  if (def.pending) return unjudged("문항 미확정");
  if (def.source_fields.includes("papers") && profile.paper_count === 0) {
    return unjudged("논문 데이터 미수집");
  }
  if (def.source_fields.includes("career") && profile.careers.length === 0) {
    return unjudged("경력 데이터 미수집");
  }
  if (def.source_fields.includes("education") && profile.educations.length === 0) {
    return unjudged("학력 데이터 미수집");
  }

  let met: boolean;
  const parsed = def.ladder ? parseLadder(def.ladder) : null;
  if (parsed) {
    // 계단은 프로필의 실제 값과 임계값을 비교한다. 단마다 따로 굴리면 모순이 난다
    const rule = LADDER_RULES[parsed.group];
    const need = rule.need[parsed.step - 1];
    met = need !== undefined && profile[rule.source] >= need;
  } else {
    met = roll(`${applicantId}|${item_id}`, 100) < 55;
  }

  return { ...base, verdict: met ? "O" : "X", reason: null };
}

/**
 * 유효 문항 기준 점수.
 * 전 문항이 N 이면 나눗셈이 성립하지 않는다. 이때 0 이 아니라 null 을 준다.
 * 0 으로 두면 "평가했더니 0점"으로 읽혀 정반대 의미가 된다.
 */
export function computeScore(items: ItemResult[]): number | null {
  let o = 0;
  let n = 0;
  for (const item of items) {
    if (item.verdict === "O") o += 1;
    else if (item.verdict === "N") n += 1;
  }
  const effective = items.length - n;
  if (effective <= 0) return null;
  return (o / effective) * TALENT_SCORE_MAX;
}

/** 7 → "7", 7.78 → "7.8". 불필요한 .0 을 붙이지 않는다 */
export function formatScore(score: number | null): string {
  if (score === null) return "판정 불가";
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function buildAxis(applicantId: string, no: number, name: string, profile: MockProfile): AxisResult {
  const items = criteriaOf(name).map((d) => judgeItem(applicantId, name, d, profile));

  let o_count = 0;
  let x_count = 0;
  let n_count = 0;
  for (const item of items) {
    if (item.verdict === "O") o_count += 1;
    else if (item.verdict === "X") x_count += 1;
    else n_count += 1;
  }
  const effective_total = items.length - n_count;

  return {
    axis: name,
    no,
    score: computeScore(items),
    o_count,
    x_count,
    n_count,
    effective_total,
    enough: effective_total >= MIN_EFFECTIVE_ITEMS,
    defined: hasCriteria(name),
    items,
  };
}

/**
 * 지원자 한 명의 34유형 채점 결과 (목업).
 * 백엔드가 붙으면 이 함수를 API 호출로 바꾼다.
 */
export function getEvaluation(applicantId: string): ApplicantEvaluation {
  const profile = profileOf(applicantId);
  return {
    applicant_id: applicantId,
    evaluated_at: "2026-08-21T09:00:00+09:00",
    prompt_version: "mock-2026-08-21",
    axes: TALENT_TYPES.map((t) => buildAxis(applicantId, t.no, t.name, profile)),
  };
}
