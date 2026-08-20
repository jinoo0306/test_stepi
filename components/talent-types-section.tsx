"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  TALENT_TYPES,
  type TalentType,
} from "@/lib/talent-types";
import { useTalentSets, type TalentSet } from "@/lib/talent-selection";
import RadarCard from "@/components/radar-card";

/**
 * 인재상 유형 도달도 - 미팅 자료의 1안과 2안을 한 화면에 위아래로 쌓는다.
 *
 *   상단 = 1안 : 이번 공고에 선정된 유형만 강조. 세트마다 오각형 하나.
 *   하단 = 2안 : 34개 전체 점수 (기본 접힘)
 *
 * 2안이 1안의 상위집합이라 별도 화면을 만들 필요가 없다.
 * 전체를 그릴 수 있으면 그중 일부만 강조하는 것이 1안이다.
 *
 * 34개를 레이더(오각형)로 못 그리는 이유: 꼭짓점마다 라벨이 붙는데
 * 그 수만큼이면 글자가 겹쳐 읽을 수 없다. 가로 막대가 유일한 현실적 선택이다.
 *
 * `"use client"` 인 이유는 펼치기 상태(useState)와 세트 저장값 구독 때문이다.
 * 점수 자체는 lib/talent-types.ts 의 상수이며 서버 호출이 없다.
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

export default function TalentTypesSection({ jobId }: { jobId: string }) {
  const [expanded, setExpanded] = useState(false);

  // 이 공고에 저장된 세트들. 없으면 미팅 자료의 2025년 예시가 기본값이다.
  // 아직 못 불러왔을 때도 기본값이 오므로, 그 둘을 status 로 구분해 알려준다.
  const { sets, status } = useTalentSets(jobId);
  // 어느 세트든 선정된 항목은 전체 목록에서 강조한다
  const selectedNos = new Set(sets.flatMap((s) => s.nos));

  // 전체 목록은 점수 내림차순. 원본 배열을 건드리지 않도록 복사 후 정렬한다.
  const ranked = [...TALENT_TYPES].sort((a, b) => b.score - a.score);
  // 목록이 PEEK*2 이하면 상위·하위 구간이 겹쳐 같은 항목이 두 번 들어간다
  // (예: 8개 → slice(0,5) 와 slice(-5) 가 3,4 를 공유 → key 중복).
  // 그럴 땐 자를 이유도 없으므로 통째로 보여준다.
  const visible =
    expanded || ranked.length <= PEEK * 2
      ? ranked
      : [...ranked.slice(0, PEEK), ...ranked.slice(-PEEK)];
  const hiddenCount = ranked.length - PEEK * 2;

  return (
    <div>
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
        badge="점수 미연동"
        desc="이번 공고에 적용된 인재상입니다. 세트는 왼쪽 메뉴의 「인재상 선택」에서 만들고 이름을 붙이며, 세트마다 3개에서 5개까지 고릅니다. 이 브라우저에만 저장되므로 다른 PC나 다른 담당자에게는 기본값이 보입니다."
      >
        {/* 못 불러온 상태에서 기본 세트를 아무 말 없이 그리면, 담당자가 고른 적 없는
            인재상을 이 공고의 선정 결과로 읽게 된다. 무엇을 보고 있는지 먼저 밝힌다. */}
        {status !== "ready" && (
          <p
            className={`mb-4 text-[13.5px] leading-[1.6] ${
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
            <SetBox key={set.id} set={set} index={i} total={sets.length} />
          ))}
        </div>
      </Block>

      {/* ── 2안 : 전체 목록 ── */}
      <Block
        title="전체 인재상"
        count={`${TALENT_TYPES.length}개`}
        badge="점수 미연동"
        desc="점수가 높은 순입니다. 어느 세트든 선정된 항목은 진하게 표시됩니다."
        action={
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[14px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
          >
            {expanded ? "접기" : `전체 보기 (${TALENT_TYPES.length})`}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        }
      >
        <ul className="space-y-4">
          {visible.map((t, i) => (
            <li key={t.no}>
              {/* 접힘 상태에서 상위 5와 하위 5 사이에 생략 표시 */}
              {!expanded && i === PEEK && hiddenCount > 0 && (
                <div className="flex items-center gap-3 py-1.5 mb-4">
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-[13px] text-[var(--ink-soft)] tabular-nums">
                    {hiddenCount}개 생략
                  </span>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
              )}
              <Row item={t} index={i} highlight={selectedNos.has(t.no)} />
            </li>
          ))}
        </ul>
      </Block>
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
}: {
  set: TalentSet;
  index: number;
  total: number;
}) {
  const items = set.nos
    .map((no) => TALENT_TYPES.find((t) => t.no === no))
    // 사용자가 고르는 값이라 목록에 없는 번호가 섞일 수 있다.
    // `!` 단언은 그 경우 undefined 를 통과시켜 화면이 터진다 → filter 로 거른다.
    .filter((t): t is TalentType => t !== undefined);
  const { height, labelSize } = radarSize(total);

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-4 pt-3.5 pb-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h4 className="truncate text-[15px] font-bold text-[var(--ink)]">
          {set.name}
        </h4>
        <span className="shrink-0 text-[13px] tabular-nums text-[var(--ink-muted)]">
          {items.length}개
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] leading-[1.6] text-[var(--ink-muted)]">
          고른 인재상이 없습니다.
        </p>
      ) : items.length >= RADAR_MIN ? (
        /* 자기소개서 분석 탭의 오각형과 같은 컴포넌트다.
           원점에서 퍼지는 애니메이션(radar-card.tsx 의 isAnimationActive)도 그대로 따라온다.
           점수가 0~10 이라 max 는 기본값을 쓰고, 색은 아래 「전체 인재상」의
           선정 항목 막대(gold)와 계열을 맞춘다. */
        <RadarCard
          data={items.map((t) => ({ axis: t.name, value: t.score }))}
          color="#F39200"
          height={height}
          labelSize={labelSize}
        />
      ) : (
        /* 2개 이하는 레이더가 도형이 안 되므로 막대로 보여준다 */
        <ul className="space-y-4 py-2">
          {items.map((t, i) => (
            <li key={t.no}>
              <Row item={t} index={index + i} highlight />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 소제목 + 우측 액션을 가진 구역. Card 안에 두 번 들어간다. */
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
  /** 제목 옆 작은 표식 (예: 미연동) */
  badge?: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-[17px] font-bold text-[var(--ink)]">
            {title}
            <span className="ml-2 text-[14px] font-medium text-[var(--ink-muted)] tabular-nums">
              {count}
            </span>
            {badge && (
              <span className="ml-2 align-middle rounded-full border border-[var(--line-strong)] px-2 py-[1px] text-[12px] font-medium text-[var(--ink-muted)]">
                {badge}
              </span>
            )}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[var(--ink-muted)]">{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * 한 줄 = 번호 · 이름 · 점수 · 막대.
 * 막대 스타일은 dept-bar.tsx 의 시각 어휘를 따랐다 (gold 그라디언트).
 * 트랙 높이만 h-2 로 키웠다. 글자를 키운 만큼 막대도 같이 굵어야 균형이 맞는다.
 */
function Row({
  item,
  index,
  highlight,
}:{
item: TalentType;
index: number;
highlight?: boolean;
}) {
  const pct = (item.score / 10) * 100;
  const delay = Math.min(index*45, 450);
  return (
    <div className="grid grid-cols-[2.25rem_1fr] items-start gap-3">
      <span className="pt-[2px] text-[13.5px] tabular-nums text-[var(--ink-soft)] text-right">
        {item.no}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span
            className={`truncate text-[15.5px] leading-[1.5] ${
              highlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
            }`}
          >
            {item.name}
          </span>
          <span className="serif text-[15.5px] tabular-nums text-[var(--ink-muted)] shrink-0">
            {item.score.toFixed(1)}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--bg-2)] overflow-hidden">
          <div
            className="stepi-talent-grow h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: highlight
                ? "linear-gradient(90deg, var(--gold), var(--gold-2))"
                : "var(--line-strong)",
                transformOrigin: "left center",
                animation: "stepi-talent-grow 0.9s cubic-bezier(0.22,0.68,0.28,1) both",
                animationDelay: `${delay}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
