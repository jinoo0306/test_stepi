"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TALENT_TYPES } from "@/lib/talent-types";
import { useTalentSets, type TalentSet } from "@/lib/talent-selection";
import {
  getEvaluation,
  formatScore100,
  TALENT_SCORE_MAX,
  TALENT_SCORE_DISPLAY_MAX,
  type AxisResult,
  type ApplicantEvaluation,
} from "@/lib/talent-evaluation";
import RadarCard from "@/components/radar-card";
import TalentEvidenceDrawer from "@/components/talent-evidence-drawer";
import { Bar } from "@/components/page-skeleton";
import { ExperimentalBadge } from "@/components/mock-mark";

/**
 * 인재상 유형 도달도: 1안과 2안을 한 화면에 위아래로 쌓음
 *
 *   상단 = 1안 : 이번 분석에 선정된 유형만 강조. 세트마다 오각형 하나
 *   하단 = 2안 : 34개 전체 점수 (기본 접힘)
 *
 * 2안이 1안의 상위집합이라 별도 화면을 만들 필요가 없음
 * 전체를 그릴 수 있으면 그중 일부만 강조하는 것이 1안임
 *
 * 34개를 레이더(오각형)로 못 그리는 이유: 꼭짓점마다 라벨이 붙는데
 * 그 수만큼이면 글자가 겹쳐 읽을 수 없음. 가로 막대가 유일한 현실적 선택임
 *
 * --- 점수의 출처 ---
 *    백엔드가 엑셀 기준 문항의 판정(O/X/N)에서 계산함
 *    어느 줄이든 눌러 실제 입력 근거와 보류 사유를 볼 수 있음
 *
 * `"use client"` 인 이유는 펼치기 상태·근거 패널·세트 저장값 구독 때문임
 */

/**
 * 레이더로 그리기 위한 최소 꼭짓점 수.
 * 1개는 점, 2개는 선이 되어 도형이 안 됨
 *
 * 선택 팝업이 세트당 3개 이상을 강제하므로(lib/talent-selection.ts 의
 * MIN_TALENT_SELECTION) 정상 경로로는 여기에 걸리지 않음. 다만 저장값은
 * 개발자도구로 고칠 수 있으니, 그때 화면이 깨지지 않게 막대로 떨어뜨림
 */
const RADAR_MIN = 3;

/**
 * 세트 박스를 까는 격자.
 *
 * 규칙: 한 층에 3개까지. 다만 4개는 3+1 이 아니라 2+2 로 나눔.
 * 한 칸만 남은 줄은 그 세트가 특별해 보이는 착시를 줌.
 *   3개 -> 3        4개 -> 2+2      5개 -> 3+2      6개 -> 3+3
 * 화면이 좁아지면 두 개씩, 더 좁으면 한 개씩 내려감.
 *
 * Tailwind 는 빌드 시점에 클래스 이름을 훑어 CSS 를 만듦.
 * `grid-cols-${n}` 처럼 조립한 이름은 그 스캔에 안 잡혀 스타일이 통째로 빠짐.
 * 그래서 완성된 문자열을 그대로 돌려줌
 */
function gridCols(n: number, printMode = false): string {
  if (n <= 1) return "grid-cols-1";
  // PDF 는 렌더러 창 폭에 따라 xl 구간을 못 탈 수 있어, 인쇄에서는 화면 폭과 무관하게 고정함
  if (printMode) return n === 2 || n === 4 ? "grid-cols-2" : "grid-cols-3";
  if (n === 2 || n === 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
}

/** 한 층에 여러 개가 놓이면 칸이 좁아지므로 오각형도 같이 줄임 */
function radarSize(n: number, printMode = false): { height: number; labelSize: number } {
  // 인쇄에서는 세트 도형을 작게 그려 한 장에 더 담음
  // 인쇄는 선정 인재상과 전체 34개가 한 장에 들어가야 해서 더 작게 그림
  if (printMode) {
    if (n <= 1) return { height: 150, labelSize: 10.5 };
    if (n === 2 || n === 4) return { height: 140, labelSize: 10 };
    return { height: 130, labelSize: 9.5 };
  }
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
  /** 인쇄 화면용: 34개를 처음부터 펼치고 접기 버튼을 뺌 (종이에는 접힘이 의미 없음) */
  printMode?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  /** 근거 패널을 연 인재상 번호 */
  const [openNo, setOpenNo] = useState<number | null>(null);
  /**
   * 패널을 연 버튼. 닫을 때 초점을 여기로 돌려줌.
   * 줄을 여럿 눌러 보게 되는 화면이라, 닫을 때마다 초점이 페이지 맨 위로
   * 날아가면 키보드로는 쓸 수 없음
   */
  const triggerRef = useRef<HTMLElement | null>(null);

  const [result, setResult] = useState<{ key: string; data?: ApplicantEvaluation; error?: string } | null>(null);
  const requestKey = `${jobId}/${applicantId}`;
  useEffect(() => {
    const controller = new AbortController();
    getEvaluation(jobId, applicantId, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ key: requestKey, data }); },
      () => { if (!controller.signal.aborted) setResult({ key: requestKey, error: "인재상 판정 결과를 불러오지 못하였습니다." }); },
    );
    return () => controller.abort();
  }, [jobId, applicantId, requestKey]);
  const evaluation = result?.key === requestKey ? result.data : undefined;
  const axisByNo = useMemo(
    () => new Map((evaluation?.axes ?? []).map((a) => [a.no, a])),
    [evaluation],
  );

  // 이 분석에 저장된 세트들. 없으면 기본 예시를 기본값으로 씀.
  // 아직 못 불러왔을 때도 기본값이 오므로, 그 둘을 status 로 구분해 알려줌.
  const { sets, status, isDefault } = useTalentSets(jobId);
  // 어느 세트든 선정된 항목은 전체 목록에서 강조함
  const selectedNos = useMemo(() => new Set(sets.flatMap((s) => s.nos)), [sets]);

  // 선정분을 세트별 구획으로 묶음. 한 인재상이 두 세트에 있으면 양쪽에 다 나옴
  // 세트마다 무엇을 골랐는지가 이 화면의 목적이라, 중복은 감출 정보가 아님
  const groups = useMemo(() => {
    const built = sets.map((set) => ({
      id: set.id,
      name: set.name,
      items: [...new Set(set.nos)]
        .map((no) => axisByNo.get(no))
        .filter((a): a is AxisResult => a !== undefined)
        .sort(byEvidenceThenScore),
    }));
    // start 는 막대 등장 애니메이션 지연용. 구획을 가로질러 이어져야 순차로 보임
    return built.map((g, i) => ({
      ...g,
      start: built.slice(0, i).reduce((n, x) => n + x.items.length, 0),
    }));
  }, [sets, axisByNo]);
  const selectedRowCount = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups],
  );

  // 어느 세트에도 없는 나머지. 기본 상태에서는 목록만 접히고 구획 머리는 남음
  const others = useMemo(
    () => (evaluation?.axes ?? []).filter((a) => !selectedNos.has(a.no)).sort(byScoreDesc),
    [evaluation, selectedNos],
  );
  const allShown = expanded || printMode;
  // 인쇄에서는 34줄이 한 장에 들어가야 하므로 세 단으로 나누고 줄 간격을 줄임
  const listClass = printMode ? "grid grid-cols-3 gap-x-4" : "space-y-1";

  const openAxis = (axis: AxisResult, el: HTMLElement) => {
    triggerRef.current = el;
    setOpenNo(axis.no);
  };
  const closeDrawer = () => {
    setOpenNo(null);
    triggerRef.current?.focus();
  };
  const opened = openNo === null ? null : (axisByNo.get(openNo) ?? null);

  if (!evaluation) return <div role="status">{result?.key === requestKey && result.error ? result.error : "인재상 판정 결과를 불러오는 중입니다."}</div>;

  return (
    // 자기소개서 탭과 같은 간격으로 카드를 쌓음
    <div className="print-flow print-sections flex flex-col gap-5">
      <p className="text-sm text-[var(--ink-muted)]">초기 판정입니다. 추가 요청·미확정 기준은 점수에서 제외됩니다. {evaluation.reference_date ? `기준일: ${evaluation.reference_date}` : "기준일 미지정으로 최근 연도·기간 판정을 보류합니다."}</p>
      <style>{`
        @keyframes stepi-talent-grow {
          from {transform: scaleX(0);}
          to   {transform: scaleX(1);}
        }
        @media (prefers-reduced-motion: reduce){
          .stepi-talent-grow { animation: none !important; }
        }
        `}</style>

      {/* --- 1안 : 선정 인재상 --- */}
      <Block
        title="선정 인재상"
        count={status === "loading" ? "" : status === "error" ? "불러오기 실패" : isDefault ? "기본 예시" : `${sets.length}세트`}
        badge={<><ExperimentalBadge /><span className="text-xs">엑셀 v0.2 초기 판정</span></>}
        desc={
          <>
            {status === "ready" && isDefault ? "저장된 인재상 세트가 없어 기본 예시를 표시합니다." : "이번 분석에 적용된 인재상입니다."} 왼쪽 메뉴의{" "}
            <b className="font-bold text-[var(--ink)]">인재상 선택</b>에서 변경할 수 있습니다.
          </>
        }
      >
        {/* 못 불러온 상태에서 기본 세트를 아무 말 없이 그리면, 담당자가 고른 적 없는
            인재상을 이 분석의 선정 결과로 읽게 됨. 무엇을 보고 있는지 먼저 밝힘 */}
        {/* 불러오는 동안 기본 예시를 그리면 담당자가 고른 적 없는 인재상이 잠깐 선정 결과처럼 보임 */}
        {status === "loading" ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">선정 인재상을 불러오는 중입니다</span>
            <div className={`animate-pulse grid gap-5 ${gridCols(2, printMode)}`} aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 pt-3.5 pb-4">
                  <Bar className="h-4 w-24" />
                  <Bar className="mt-4 h-[240px] w-full" />
                  <Bar className="mt-4 h-3.5 w-3/4" />
                  <Bar className="mt-2 h-3.5 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {status === "error" && (
              <p className="mb-4 text-[14px] leading-[1.6] text-[var(--bad)]">
                선정 인재상을 불러오지 못하였습니다. 아래는 저장된 값이 아니라 기본 예시입니다. 왼쪽 메뉴에서 다시 시도해 주십시오.
              </p>
            )}
            <div
              className={`grid ${printMode ? "gap-3" : "gap-5"} ${gridCols(sets.length, printMode)} ${
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
                  printMode={printMode}
                />
              ))}
            </div>
          </>
        )}
      </Block>

      {/* --- 2안 : 전체 목록 --- */}
      <Block
        title="전체 인재상"
        split
        count={`${TALENT_TYPES.length}개`}
        badge={<><ExperimentalBadge /><span className="text-xs">엑셀 v0.2 초기 판정</span></>}
        desc={
          <>
            인재상마다 판정 가능한 문항 중 충족한 수로 점수를 냅니다. 미확정 기준과 자료 부족은 판정 불가로 표시합니다.{" "}
            <b className="font-bold text-[var(--ink)]">항목을 선택하면 판정 결과와 근거를 확인할 수 있습니다.</b>
          </>
        }
        action={
          printMode ? null : (
            /* 글자만 있으면 누를 수 있는지 모름. 테두리를 둘러 버튼으로 보이게 함 */
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3.5 py-2 text-[15px] font-semibold text-[var(--ink)] transition hover:border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary)]"
            >
              {expanded ? "접기" : `전체 보기 (${TALENT_TYPES.length})`}
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )
        }
      >
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.id}>
              <GroupHeading label={g.name} count={g.items.length} />
              {g.items.length === 0 ? (
                <p className="px-1 py-2 text-[15px] text-[var(--ink-soft)]">
                  선택한 인재상이 없습니다.
                </p>
              ) : (
                <ul className={listClass}>
                  {g.items.map((axis, i) => (
                    // 같은 인재상이 여러 구획에 나오므로 번호만으로는 key 가 겹침
                    <li key={`${g.id}-${axis.no}`} className="print-row">
                      <Row axis={axis} index={g.start + i} highlight dense={printMode} onOpen={openAxis} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {others.length > 0 && (
            /* 접힌 상태에서도 구획 머리는 남김. 아래에 무엇이 더 있는지 보여야
               「전체 보기」가 무엇을 펼치는 버튼인지 알 수 있음 */
            <section>
              <GroupHeading
                label="그 외"
                count={others.length}
                onToggle={printMode ? undefined : () => setExpanded((v) => !v)}
                expanded={expanded}
              />
              {allShown && (
                <ul className={listClass}>
                  {others.map((axis, i) => (
                    <li key={`other-${axis.no}`} className="print-row">
                      <Row axis={axis} index={selectedRowCount + i} dense={printMode} onOpen={openAxis} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </Block>

      {opened && (
        <TalentEvidenceDrawer axis={opened} applicantId={applicantId} onClose={closeDrawer} />
      )}
    </div>
  );
}

/**
 * 목록 정렬 규칙
 *
 * 점수만으로 줄 세우면 안 됨. 유효 문항이 1개인데 그 하나가 O 면 10점이 되어
 * 실제로 열 문항을 다 통과한 인재상과 같은 자리에 섬. 문항표조차 없는
 * 예시 유형도 마찬가지임. 그래서 근거의 두께를 먼저 보고 점수를 나중에 봄
 *   1) 문항표가 있는 유형 먼저
 *   2) 유효 문항이 충분한 것 먼저, 판정 불가는 맨 뒤
 *   3) 점수 내림차순
 *   4) 번호 (동점이 잦으므로 타이브레이커가 없으면 정렬이 흔들려 보임)
 */
function byEvidenceThenScore(a: AxisResult, b: AxisResult): number {
  const tier = (x: AxisResult) => (x.score === null ? 2 : x.enough ? 0 : 1);
  return (
    Number(b.defined) - Number(a.defined) ||
    tier(a) - tier(b) ||
    (b.score ?? 0) - (a.score ?? 0) ||
    a.no - b.no
  );
}

/**
 * 「그 외」 정렬: 점수 내림차순
 *
 * 선정 구획과 달리 근거 두께(유효 문항 수)를 앞세우지 않음. 선정되지 않은
 * 29개는 훑어보는 목록이라 높은 점수가 위에 있는 편이 읽기 쉬움
 * 판정 불가는 순위를 매길 수 없어 맨 뒤로 보냄
 */
function byScoreDesc(a: AxisResult, b: AxisResult): number {
  if (a.score === null || b.score === null) {
    return Number(a.score === null) - Number(b.score === null) || a.no - b.no;
  }
  return b.score - a.score || a.no - b.no;
}

/**
 * 구획 머리: 세트 이름으로 목록을 나눔. 세트가 한 벌이어도 붙임
 * onToggle 을 주면 머리 줄 전체가 펼치기 버튼이 됨 (「그 외」 전용)
 */
function GroupHeading({
  label,
  count,
  onToggle,
  expanded,
}: {
  label: string;
  count: number;
  onToggle?: () => void;
  expanded?: boolean;
}) {
  const inner = (
    <>
      <span className="min-w-0 shrink truncate text-[16px] font-bold text-[var(--ink)]">
        {label}
      </span>
      <span className="h-[2px] flex-1 translate-y-[-4px] bg-[var(--line-strong)]" />
      <span className="shrink-0 text-[14px] font-medium tabular-nums text-[var(--ink-muted)]">
        {count}개
      </span>
      {onToggle &&
        (expanded ? (
          <ChevronUp size={16} className="shrink-0 translate-y-[2px] text-[var(--ink-muted)]" />
        ) : (
          <ChevronDown size={16} className="shrink-0 translate-y-[2px] text-[var(--ink-muted)]" />
        ))}
    </>
  );

  if (!onToggle) {
    return <h3 className="print-head mb-3 flex items-baseline gap-3">{inner}</h3>;
  }
  return (
    <h3 className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-baseline gap-3 rounded px-1 py-1 text-left transition hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--secondary)]"
      >
        {inner}
      </button>
    </h3>
  );
}

/**
 * 세트 하나 = 테두리 박스 하나.
 * 박스로 감싸는 이유는 세트끼리의 경계를 눈으로 잡기 위해서임
 * 여러 오각형이 여백만 두고 늘어서면 어느 이름이 어느 그림인지 헷갈림
 */
function SetBox({
  set,
  index,
  total,
  axisByNo,
  onOpen,
  printMode = false,
}: {
  set: TalentSet;
  index: number;
  total: number;
  axisByNo: Map<number, AxisResult>;
  onOpen: (axis: AxisResult, el: HTMLElement) => void;
  printMode?: boolean;
}) {
  // 사용자가 고르는 값이라 목록에 없는 번호나 중복이 섞일 수 있음
  // `!` 단언은 undefined 를 통과시켜 화면이 터지고, 중복은 React key 를 겹치게 함
  const items = useMemo(
    () =>
      [...new Set(set.nos)]
        .map((no) => axisByNo.get(no))
        .filter((a): a is AxisResult => a !== undefined),
    [set.nos, axisByNo],
  );
  const { height, labelSize } = radarSize(total, printMode);
  // 매 렌더마다 새 배열을 넘기면 recharts 가 통째로 다시 계산함
  // 목록이 100점으로 적히므로 오각형 눈금(툴팁 값)도 같은 척도로 맞춤
  const radarData = useMemo(
    () =>
      items.map((a) => ({
        axis: a.axis,
        value: a.score === null ? null : (a.score / TALENT_SCORE_MAX) * TALENT_SCORE_DISPLAY_MAX,
      })),
    [items],
  );

  return (
    // 박스 전체를 묶으면 점수 줄까지 함께 다음 장으로 밀려 앞 장이 빔
    // 제목과 레이더만 한 덩어리로 묶어, 쪽 끝에 제목만 남고 레이더가 넘어가는 일을 막음
    <section className={`rounded-lg border border-[var(--line)] bg-[var(--paper)] ${printMode ? "px-3 pt-2 pb-2" : "px-4 pt-3.5 pb-4"}`}>
      <div className="print-figure">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h4 className="truncate text-[15px] font-bold text-[var(--ink)]">{set.name}</h4>
          <span className="shrink-0 text-[14px] tabular-nums text-[var(--ink-muted)]">
            {items.length}개
          </span>
        </div>
        {/* 판정 불가는 null 로 넘겨 꼭짓점을 끊음. 0 으로 그리면 "0점"으로 읽힘 */}
        {items.length >= RADAR_MIN && (
          <RadarCard
            data={radarData}
            color="#ED911A"
            max={TALENT_SCORE_DISPLAY_MAX}
            height={height}
            labelSize={labelSize}
          />
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[14px] leading-[1.6] text-[var(--ink-muted)]">
          선택한 인재상이 없습니다.
        </p>
      ) : items.length >= RADAR_MIN ? (
        <>
          {/* 오각형은 클릭 대상이 아니므로, 세트 안에서도 근거로 들어갈 길을 둠 */}
          <ul className="mt-1 space-y-0.5">
            {items.map((a) => (
              <li key={a.no} className="print-row">
                <CompactRow axis={a} onOpen={onOpen} printMode={printMode} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        /* 2개 이하는 레이더가 도형이 안 되므로 막대로 보여줌 */
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

/** 카드 하나. page.tsx 의 Card 를 가져다 쓸 수 없어 모양만 맞춘 것이라, 디자인을 바꿀 땐 두 곳을 같이 고쳐야 함 */
function Block({
  title,
  count,
  badge,
  desc,
  action,
  split,
  children,
}: {
  title: string;
  count: string;
  /** 제목 옆 표식 */
  badge?: React.ReactNode;
  // 문장 안 일부만 굵게 쓰는 곳이 있어 문자열이 아니라 노드를 받음
  desc: React.ReactNode;
  action?: React.ReactNode;
  /** 인쇄 때 페이지를 넘겨 이어 씀 */
  split?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel${split ? " print-split" : ""}`}>
      <div className="print-head flex items-start justify-between gap-4 pb-3.5 mb-4 border-b border-[var(--line)]">
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
          <p className="mt-1.5 text-[16px] leading-[1.6] text-[var(--ink-muted)] break-keep">
            {desc}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** 점수 + 유효 문항 표기. 목록과 세트 박스가 같은 문장을 쓰도록 한곳에 둠 */
function ScoreText({
  axis,
  hideValid = false,
  small = false,
}: {
  axis: AxisResult;
  hideValid?: boolean;
  /** 인쇄용 축소 표시 */
  small?: boolean;
}) {
  return (
    <span className="shrink-0 text-right">
      <span className={`serif ${small ? "text-[12px]" : "text-[15.5px]"} tabular-nums text-[var(--ink)]`}>
        {formatScore100(axis.score)}
        {axis.score !== null && (
          <span className={`ml-0.5 ${small ? "text-[10px]" : "text-[12.5px]"} font-normal text-[var(--ink-soft)]`}>
            / {TALENT_SCORE_DISPLAY_MAX}
          </span>
        )}
      </span>
      {/* N 문항이 있으면 분모가 10이 아님. 패널을 열어야 알 수 있으면 늦음.
          유효 문항이 너무 적으면 점수를 그대로 믿으면 안 되므로 더 눈에 띄게 적음 */}
      {!hideValid && axis.n_count > 0 && axis.score !== null && (
        <span
          className={`ml-1.5 text-[11.5px] tabular-nums ${
            axis.enough ? "text-[var(--secondary-2)]" : "font-semibold text-[var(--secondary-2)]"
          }`}
        >
          유효 문항 {axis.effective_total}개
          {!axis.enough && "뿐"}
        </span>
      )}
    </span>
  );
}

function Row({
  axis,
  index,
  highlight,
  dense = false,
  onOpen,
}: {
  axis: AxisResult;
  index: number;
  highlight?: boolean;
  /** 인쇄용 축소 표시 */
  dense?: boolean;
  onOpen: (axis: AxisResult, el: HTMLElement) => void;
}) {
  const pct = ((axis.score ?? 0) / TALENT_SCORE_MAX) * 100;
  // 34줄이면 index 10 에서 상한에 닿아 나머지가 한꺼번에 시작함. 간격을 좁혀 끝까지 이어지게 함
  const delay = Math.min(index * 22, 500);
  return (
    <button
      type="button"
      onClick={(e) => onOpen(axis, e.currentTarget)}
      aria-label={`${axis.axis} 판정 근거 보기`}
      className={`block w-full rounded px-1 ${dense ? "py-0.5" : "py-2"} text-left transition hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--secondary)]`}
    >
      <span className="min-w-0 block">
        {/* 이름과 점수를 왼쪽에 붙여 둠. 양 끝으로 벌려 놓으면 34줄을 훑을 때
            시선이 줄마다 가로로 왕복해야 하고, 이름이 짧은 줄일수록 멀어짐 */}
        <span className={`flex items-baseline gap-2.5 ${dense ? "mb-0.5" : "mb-1.5"}`}>
          <span
            className={`min-w-0 truncate ${dense ? "text-[11.5px]" : "text-[17px]"} leading-[1.5] ${
              highlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
            }`}
          >
            {axis.axis}
          </span>
          <ScoreText axis={axis} small={dense} />
        </span>
        {/* 판정 불가는 폭 0 막대로 그리면 0점처럼 보임. 아예 다른 표시로 바꿈 */}
        {axis.score === null ? (
          <span className={`block ${dense ? "h-1" : "h-2"} w-full rounded-full border border-dashed border-[var(--line-strong)]`} />
        ) : (
          <span className={`relative block ${dense ? "h-1" : "h-2"} w-full rounded-full bg-[var(--line)] overflow-hidden`}>
            <span
              className="stepi-talent-grow block h-full rounded-full"
              style={{
                width: `${pct}%`,
                // 축약형 background 는 backgroundSize 까지 같이 초기화해서,
                // 둘을 한 객체에 섞으면 리렌더 때 크기가 지워질 수 있음 (React 경고)
                backgroundColor: highlight ? undefined : "var(--primary)",
                backgroundImage: highlight
                  ? "linear-gradient(90deg, var(--gold), var(--gold-2))"
                  : undefined,
                // highlight 그라디언트를 막대 자기 폭이 아니라 트랙 전체 폭에 맞춤.
                // 안 그러면 같은 위치인데 값마다 색이 다르게 나옴 (단색 막대엔 무의미)
                backgroundSize: highlight && pct > 0 ? `${(10000 / pct).toFixed(2)}% 100%` : undefined,
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
  printMode = false,
}: {
  axis: AxisResult;
  onOpen: (axis: AxisResult, el: HTMLElement) => void;
  /** 인쇄에서는 유효 문항 표기를 빼 점수 끝을 가지런히 맞춤. 붙는 줄과 안 붙는 줄이 섞여 들쭉날쭉함 */
  printMode?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onOpen(axis, e.currentTarget)}
      aria-label={`${axis.axis} 판정 근거 보기`}
      className={`grid w-full grid-cols-[auto_1fr_auto] items-baseline gap-2 rounded px-1.5 ${printMode ? "py-0" : "py-1"} text-left transition hover:bg-[var(--bg-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--secondary)]`}
    >
      <span className={`min-w-0 truncate ${printMode ? "text-[12px]" : "text-[16px]"} text-[var(--ink)]`}>{axis.axis}</span>
      {/* 안내선: 이름과 점수가 멀어도 눈이 같은 줄을 따라감 (목차 방식) */}
      <span className="translate-y-[-4px] border-b border-[var(--line-mid)]" />
      <ScoreText axis={axis} hideValid={printMode} small={printMode} />
    </button>
  );
}
