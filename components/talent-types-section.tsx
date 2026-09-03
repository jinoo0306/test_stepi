"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TALENT_TYPES } from "@/lib/talent-types";
import { useTalentSets, type TalentSet } from "@/lib/talent-selection";
import {
  getEvaluation,
  formatScore,
  TALENT_SCORE_MAX,
  type AxisResult,
} from "@/lib/talent-evaluation";
import RadarCard from "@/components/radar-card";
import TalentEvidenceDrawer from "@/components/talent-evidence-drawer";
import { MockBadge } from "@/components/mock-mark";

/**
 * 인재상 유형 도달도 - 미팅 자료의 1안과 2안을 한 화면에 위아래로 쌓는다.
 *
 *   상단 = 1안 : 이번 분석에 선정된 유형만 강조. 세트마다 오각형 하나.
 *   하단 = 2안 : 34개 전체 점수 (기본 접힘)
 *
 * 2안이 1안의 상위집합이라 별도 화면을 만들 필요가 없다.
 * 전체를 그릴 수 있으면 그중 일부만 강조하는 것이 1안이다.
 *
 * 34개를 레이더(오각형)로 못 그리는 이유: 꼭짓점마다 라벨이 붙는데
 * 그 수만큼이면 글자가 겹쳐 읽을 수 없다. 가로 막대가 유일한 현실적 선택이다.
 *
 * ── 점수의 출처
 *    lib/talent-evaluation.ts 가 문항 10개의 판정(O/X/N)에서 계산한다.
 *    아직 목 데이터이지만 계산 방식은 실제와 같다. 어느 줄이든 눌러 근거를 볼 수 있다.
 *
 * `"use client"` 인 이유는 펼치기 상태·근거 패널·세트 저장값 구독 때문이다.
 */

/** 접힘 상태에서 전체 목록에 보여줄 상·하위 개수 */
const PEEK = 5;

/**
 * 레이더로 그리기 위한 최소 꼭짓점 수.
 * 1개는 점, 2개는 선이 되어 도형이 안 된다.
 *
 * 선택 팝업이 세트당 3개 이상을 강제하므로(lib/talent-selection.ts 의
 * MIN_TALENT_SELECTION) 정상 경로로는 여기에 걸리지 않는다. 다만 저장값은
 * 개발자도구로 고칠 수 있으니, 그때 화면이 깨지지 않게 막대로 떨어뜨린다.
 */
const RADAR_MIN = 3;

/**
 * 세트 박스를 까는 격자.
 *
 * 규칙: **한 층에 3개까지.** 다만 4개는 3+1 이 아니라 2+2 로 나눈다.
 * 한 칸만 남은 줄은 그 세트가 특별해 보이는 착시를 준다.
 *   3개 → 3        4개 → 2+2      5개 → 3+2      6개 → 3+3
 * 화면이 좁아지면 두 개씩, 더 좁으면 한 개씩 내려간다.
 *
 * Tailwind 는 빌드 시점에 클래스 이름을 훑어 CSS 를 만든다.
 * `grid-cols-${n}` 처럼 조립한 이름은 그 스캔에 안 잡혀 스타일이 통째로 빠진다.
 * 그래서 완성된 문자열을 그대로 돌려준다.
 */
function gridCols(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n === 2 || n === 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
}

/** 한 층에 여러 개가 놓이면 칸이 좁아지므로 오각형도 같이 줄인다 */
function radarSize(n: number): { height: number; labelSize: number } {
  if (n <= 1) return { height: 320, labelSize: 13 };
  if (n === 2 || n === 4) return { height: 280, labelSize: 12.5 };
  return { height: 250, labelSize: 11.5 };
}

export default function TalentTypesSection({
  jobId,
  applicantId,
  printMode = false,
}: {
  jobId: string;
  applicantId: string;
  /** 인쇄 화면용 — 34개를 처음부터 펼치고 접기 버튼을 뺀다 (종이에는 접힘이 의미 없다) */
  printMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  /** 근거 패널을 연 인재상 번호 */
  const [openNo, setOpenNo] = useState<number | null>(null);
  /**
   * 패널을 연 버튼. 닫을 때 초점을 여기로 돌려준다.
   * 줄을 여럿 눌러 보게 되는 화면이라, 닫을 때마다 초점이 페이지 맨 위로
   * 날아가면 키보드로는 쓸 수 없다.
   */
  const triggerRef = useRef<HTMLElement | null>(null);

  // 지원자 한 명의 34유형 채점 결과. 목 단계에서는 동기 함수라 그대로 읽는다.
  // 서버 호출이 생기면 lib/talent-selection.ts 의 useSyncExternalStore 방식을 따른다.
  const evaluation = useMemo(() => getEvaluation(applicantId), [applicantId]);
  const axisByNo = useMemo(
    () => new Map(evaluation.axes.map((a) => [a.no, a])),
    [evaluation],
  );

  // 이 분석에 저장된 세트들. 없으면 미팅 자료의 예시가 기본값이다.
  // 아직 못 불러왔을 때도 기본값이 오므로, 그 둘을 status 로 구분해 알려준다.
  const { sets, status } = useTalentSets(jobId);
  // 어느 세트든 선정된 항목은 전체 목록에서 강조한다
  const selectedNos = useMemo(() => new Set(sets.flatMap((s) => s.nos)), [sets]);

  // 전체 목록 정렬.
  //
  // 점수만으로 줄 세우면 안 된다. 유효 문항이 1개인데 그 하나가 O 면 10점이 되어
  // 실제로 열 문항을 다 통과한 인재상과 같은 자리에 선다. 문항표조차 없는
  // 예시 유형도 마찬가지다. 그래서 근거의 두께를 먼저 보고 점수를 나중에 본다.
  //   1) 문항표가 있는 유형 먼저
  //   2) 유효 문항이 충분한 것 먼저, 판정 불가는 맨 뒤
  //   3) 점수 내림차순
  //   4) 번호 (동점이 잦으므로 타이브레이커가 없으면 정렬이 흔들려 보인다)
  const ranked = useMemo(() => {
    const tier = (a: AxisResult) => (a.score === null ? 2 : a.enough ? 0 : 1);
    return [...evaluation.axes].sort(
      (a, b) =>
        Number(b.defined) - Number(a.defined) ||
        tier(a) - tier(b) ||
        (b.score ?? 0) - (a.score ?? 0) ||
        a.no - b.no,
    );
  }, [evaluation]);

  // 목록이 PEEK*2 이하면 상위·하위 구간이 겹쳐 같은 항목이 두 번 들어간다
  // (예: 8개 → slice(0,5) 와 slice(-5) 가 3,4 를 공유 → key 중복).
  // 그럴 땐 자를 이유도 없으므로 통째로 보여준다.
  const allShown = expanded || printMode;
  const visible = useMemo(
    () =>
      allShown || ranked.length <= PEEK * 2
        ? ranked
        : [...ranked.slice(0, PEEK), ...ranked.slice(-PEEK)],
    [allShown, ranked],
  );
  const hiddenCount = ranked.length - PEEK * 2;

  const openAxis = (axis: AxisResult, el: HTMLElement) => {
    triggerRef.current = el;
    setOpenNo(axis.no);
  };
  const closeDrawer = () => {
    setOpenNo(null);
    triggerRef.current?.focus();
  };
  const opened = openNo === null ? null : (axisByNo.get(openNo) ?? null);

  return (
    // 자기소개서 탭과 같은 간격으로 카드를 쌓는다
    <div className="flex flex-col gap-5">
      <style>{`
        @keyframes stepi-talent-grow {
          from {transform: scaleX(0);}
          to   {transform: scaleX(1);}
        }
        @media (prefers-reduced-motion: reduce){
          .stepi-talent-grow { animation: none !important; }
        }
        `}</style>

      {/* ── 1안 : 선정 인재상 ── */}
      <Block
        title="선정 인재상"
        count={`${sets.length}세트`}
        badge={<MockBadge />}
        desc={
          <>
            이번 분석에 적용된 인재상입니다. 왼쪽 메뉴의{" "}
            <b className="font-bold text-[var(--ink)]">인재상 선택</b>에서 변경할 수 있습니다.
          </>
        }
      >
        {/* 못 불러온 상태에서 기본 세트를 아무 말 없이 그리면, 담당자가 고른 적 없는
            인재상을 이 분석의 선정 결과로 읽게 된다. 무엇을 보고 있는지 먼저 밝힌다. */}
        {status !== "ready" && (
          <p
            className={`mb-4 text-[14px] leading-[1.6] ${
              status === "error" ? "text-[var(--bad)]" : "text-[var(--ink-muted)]"
            }`}
          >
            {status === "error"
              ? "선정 인재상을 불러오지 못했습니다. 아래는 저장된 값이 아니라 기본 예시입니다. 왼쪽 메뉴에서 다시 시도해 주세요."
              : "선정 인재상을 불러오는 중입니다. 아래는 잠시 보여주는 기본 예시입니다."}
          </p>
        )}
        <div
          className={`grid gap-5 ${gridCols(sets.length)} ${
            status === "ready" ? "" : "opacity-55"
          }`}
        >
          {sets.map((set, i) => (
            <SetBox
              key={set.id}
              set={set}
              index={i}
              total={sets.length}
              axisByNo={axisByNo}
              onOpen={openAxis}
            />
          ))}
        </div>
      </Block>

      {/* ── 2안 : 전체 목록 ── */}
      <Block
        title="전체 인재상"
        count={`${TALENT_TYPES.length}개`}
        badge={<MockBadge />}
        desc="인재상마다 사실 확인 문항 10개 중 충족한 수로 점수를 냅니다. 줄을 누르면 판정과 근거가 열립니다."
        action={
          printMode ? null : (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[14px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
            >
              {expanded ? "접기" : `전체 보기 (${TALENT_TYPES.length})`}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )
        }
      >
        <ul className="space-y-1">
          {visible.map((axis, i) => (
            <li key={axis.no}>
              {/* 접힘 상태에서 상위 5와 하위 5 사이에 생략 표시 */}
              {!allShown && i === PEEK && hiddenCount > 0 && (
                <div className="flex items-center gap-3 py-1.5 mb-2">
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-[14px] text-[var(--ink-soft)] tabular-nums">
                    {hiddenCount}개 생략
                  </span>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
              )}
              <Row
                axis={axis}
                index={i}
                highlight={selectedNos.has(axis.no)}
                onOpen={openAxis}
              />
            </li>
          ))}
        </ul>
      </Block>

      {opened && (
        <TalentEvidenceDrawer axis={opened} applicantId={applicantId} onClose={closeDrawer} />
      )}
    </div>
  );
}

/**
 * 세트 하나 = 테두리 박스 하나.
 * 박스로 감싸는 이유는 세트끼리의 경계를 눈으로 잡기 위해서다.
 * 여러 오각형이 여백만 두고 늘어서면 어느 이름이 어느 그림인지 헷갈린다.
 */
function SetBox({
  set,
  index,
  total,
  axisByNo,
  onOpen,
}: {
  set: TalentSet;
  index: number;
  total: number;
  axisByNo: Map<number, AxisResult>;
  onOpen: (axis: AxisResult, el: HTMLElement) => void;
}) {
  // 사용자가 고르는 값이라 목록에 없는 번호나 중복이 섞일 수 있다.
  // `!` 단언은 undefined 를 통과시켜 화면이 터지고, 중복은 React key 를 겹치게 한다.
  const items = useMemo(
    () =>
      [...new Set(set.nos)]
        .map((no) => axisByNo.get(no))
        .filter((a): a is AxisResult => a !== undefined),
    [set.nos, axisByNo],
  );
  const { height, labelSize } = radarSize(total);
  // 매 렌더마다 새 배열을 넘기면 recharts 가 통째로 다시 계산한다
  const radarData = useMemo(
    () => items.map((a) => ({ axis: a.axis, value: a.score })),
    [items],
  );

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 pt-3.5 pb-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h4 className="truncate text-[15px] font-bold text-[var(--ink)]">{set.name}</h4>
        <span className="shrink-0 text-[14px] tabular-nums text-[var(--ink-muted)]">
          {items.length}개
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[14px] leading-[1.6] text-[var(--ink-muted)]">
          고른 인재상이 없습니다.
        </p>
      ) : items.length >= RADAR_MIN ? (
        <>
          {/* 판정 불가는 null 로 넘겨 꼭짓점을 끊는다. 0 으로 그리면 "0점"으로 읽힌다 */}
          <RadarCard data={radarData} color="#F39200" height={height} labelSize={labelSize} />
          {/* 오각형은 클릭 대상이 아니므로, 세트 안에서도 근거로 들어갈 길을 둔다 */}
          <ul className="mt-1 space-y-0.5">
            {items.map((a) => (
              <li key={a.no}>
                <CompactRow axis={a} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        /* 2개 이하는 레이더가 도형이 안 되므로 막대로 보여준다 */
        <ul className="space-y-4 py-2">
          {items.map((a, i) => (
            <li key={a.no}>
              <Row axis={a} index={index + i} highlight onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 카드 하나. page.tsx 의 Card 를 가져다 쓸 수 없어 모양만 맞춘 것이라, 디자인을 바꿀 땐 두 곳을 같이 고쳐야 한다 */
function Block({
  title,
  count,
  badge,
  desc,
  action,
  children,
}: {
  title: string;
  count: string;
  /** 제목 옆 표식 */
  badge?: React.ReactNode;
  // 문장 안 일부만 굵게 쓰는 곳이 있어 문자열이 아니라 노드를 받는다
  desc: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="flex items-start justify-between gap-4 pb-3.5 mb-4 border-b border-[var(--line)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mark" />
            <h2 className="text-[18px] font-bold tracking-[-0.012em] text-[var(--ink)]">
              {title}
              <span className="ml-2 text-[14px] font-medium text-[var(--ink-muted)] tabular-nums">
                {count}
              </span>
            </h2>
            {badge}
          </div>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--ink-muted)] break-keep">
            {desc}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 점수 + 유효 문항 표기. 목록과 세트 박스가 같은 문장을 쓰도록 한곳에 둔다 */
function ScoreText({ axis }: { axis: AxisResult }) {
  return (
    <span className="shrink-0 text-right">
      <span className="serif text-[15.5px] tabular-nums text-[var(--ink-muted)]">
        {formatScore(axis.score)}
        {axis.score !== null && (
          <span className="ml-0.5 text-[12.5px] text-[var(--ink-soft)]">
            / {TALENT_SCORE_MAX}
          </span>
        )}
      </span>
      {/* N 문항이 있으면 분모가 10이 아니다. 패널을 열어야 알 수 있으면 늦다.
          유효 문항이 너무 적으면 점수를 그대로 믿으면 안 되므로 더 눈에 띄게 적는다 */}
      {axis.n_count > 0 && axis.score !== null && (
        <span
          className={`ml-1.5 text-[11.5px] tabular-nums ${
            axis.enough ? "text-[var(--secondary-2)]" : "font-semibold text-[var(--secondary-2)]"
          }`}
        >
          유효 {axis.effective_total}문항
          {!axis.enough && " 뿐"}
        </span>
      )}
    </span>
  );
}

function Row({
  axis,
  index,
  highlight,
  onOpen,
}: {
  axis: AxisResult;
  index: number;
  highlight?: boolean;
  onOpen: (axis: AxisResult, el: HTMLElement) => void;
}) {
  const pct = ((axis.score ?? 0) / TALENT_SCORE_MAX) * 100;
  // 34줄이면 index 10 에서 상한에 닿아 나머지가 한꺼번에 시작한다. 간격을 좁혀 끝까지 이어지게 한다
  const delay = Math.min(index * 22, 500);
  return (
    <button
      type="button"
      onClick={(e) => onOpen(axis, e.currentTarget)}
      aria-label={`${axis.axis} 판정 근거 보기`}
      className="grid w-full grid-cols-[2.25rem_1fr] items-start gap-3 rounded px-1 py-2 text-left transition hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--secondary)]"
    >
      <span className="pt-[2px] text-[14px] tabular-nums text-[var(--ink-soft)] text-right">
        {axis.no}
      </span>
      <span className="min-w-0 block">
        <span className="flex items-baseline justify-between gap-3 mb-1.5">
          <span className="min-w-0 flex items-baseline gap-1.5">
            <span
              className={`truncate text-[15.5px] leading-[1.5] ${
                highlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
              }`}
            >
              {axis.axis}
            </span>
          </span>
          <ScoreText axis={axis} />
        </span>
        {/* 판정 불가는 폭 0 막대로 그리면 0점처럼 보인다. 아예 다른 표시로 바꾼다 */}
        {axis.score === null ? (
          <span className="block h-2 w-full rounded-full border border-dashed border-[var(--line-strong)]" />
        ) : (
          <span className="relative block h-2 w-full rounded-full bg-[var(--line)] overflow-hidden">
            <span
              className="stepi-talent-grow block h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: highlight
                  ? "linear-gradient(90deg, var(--gold), var(--gold-2))"
                  : "var(--p-300)",
                // highlight 그라디언트를 막대 자기 폭이 아니라 트랙 전체 폭에 맞춘다.
                // 안 그러면 같은 위치인데 값마다 색이 다르게 나온다 (단색 막대엔 무의미)
                backgroundSize: pct > 0 ? `${(10000 / pct).toFixed(2)}% 100%` : "100% 100%",
                transformOrigin: "left center",
                animation: "stepi-talent-grow 0.9s cubic-bezier(0.22,0.68,0.28,1) both",
                animationDelay: `${delay}ms`,
              }}
            />
          </span>
        )}
      </span>
    </button>
  );
}

/** 세트 박스 안에서 오각형 아래에 까는 줄. 막대 없이 이름과 점수만 */
function CompactRow({
  axis,
  onOpen,
}: {
  axis: AxisResult;
  onOpen: (axis: AxisResult, el: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(axis, e.currentTarget)}
      aria-label={`${axis.axis} 판정 근거 보기`}
      className="flex w-full items-baseline justify-between gap-3 rounded px-1.5 py-1 text-left transition hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--secondary)]"
    >
      <span className="min-w-0 flex items-baseline gap-1.5">
        <span className="truncate text-[14px] text-[var(--ink)]">{axis.axis}</span>
      </span>
      <ScoreText axis={axis} />
    </button>
  );
}
