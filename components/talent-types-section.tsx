"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  TALENT_TYPES,
  type TalentType,
} from "@/lib/talent-types";
import { useTalentSelection } from "@/lib/talent-selection";
import RadarCard from "@/components/radar-card";

/**
 * 인재상 유형 도달도 — 미팅 자료의 1안과 2안을 한 화면에 위아래로 쌓는다.
 *
 *   상단 = 1안 : 이번 공고에 선정된 유형만 강조
 *   하단 = 2안 : 34개 전체 점수 (기본 접힘)
 *
 * 2안이 1안의 상위집합이라 별도 화면을 만들 필요가 없다.
 * 전체를 그릴 수 있으면 그중 일부만 강조하는 것이 1안이다.
 *
 * 34개를 레이더(오각형)로 못 그리는 이유: 꼭짓점마다 라벨이 붙는데
 * 그 수만큼이면 글자가 겹쳐 읽을 수 없다. 가로 막대가 유일한 현실적 선택이다.
 *
 * `"use client"` 인 이유는 펼치기 상태(useState) 하나 때문이다.
 * 데이터는 lib/talent-types.ts 의 상수이며 서버 호출이 없다.
 */

/** 접힘 상태에서 전체 목록에 보여줄 상·하위 개수 */
const PEEK = 5;

/**
 * 레이더로 그리기 위한 최소 꼭짓점 수.
 * 1개는 점, 2개는 선이 되어 도형이 안 된다 → 그 아래는 막대로 떨어뜨린다.
 */
const RADAR_MIN = 3;

export default function TalentTypesSection({ jobId }: { jobId: string }) {
  const [expanded, setExpanded] = useState(false);

  // 이 공고에 저장된 선택. 없으면 미팅 자료의 2025년 예시가 기본값이다.
  const selectedNos = useTalentSelection(jobId);
  // 사용자가 고르는 값이라 목록에 없는 번호가 섞일 수 있다.
  // 기존의 `!` 단언은 그 경우 undefined 를 통과시켜 화면이 터진다 → filter 로 거른다.
  const selected = selectedNos
    .map((no) => TALENT_TYPES.find((t) => t.no === no))
    .filter((t): t is TalentType => t !== undefined);

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
        count={`${selected.length}개`}
        badge="점수 미연동"
        desc="이번 공고에 적용된 인재상입니다. 선택은 이 브라우저에만 저장되므로, 다른 PC나 다른 담당자에게는 기본값이 보입니다."
      >
        {selected.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-muted)]">
            선정된 인재상이 없습니다. 왼쪽 메뉴의 「인재상 선택」에서 골라주세요.
          </p>
        ) : selected.length >= RADAR_MIN ? (
          /* 자기소개서 분석 탭의 오각형과 같은 컴포넌트다.
             원점에서 퍼지는 애니메이션(radar-card.tsx 의 isAnimationActive)도 그대로 따라온다.
             점수가 0~10 이라 max 는 기본값을 쓰고, 색은 아래 「전체 인재상」의
             선정 항목 막대(gold)와 계열을 맞춘다. */
          <RadarCard
            data={selected.map((t) => ({ axis: t.name, value: t.score }))}
            color="#F39200"
          />
        ) : (
          /* 2개 이하는 레이더가 도형이 안 되므로 막대로 보여준다 */
          <ul className="space-y-3.5">
            {selected.map((t, i) => (
              <Row key={t.no} item={t} index={i} highlight />
            ))}
          </ul>
        )}
      </Block>

      {/* ── 2안 : 전체 목록 ── */}
      <Block
        title="전체 인재상"
        count={`${TALENT_TYPES.length}개`}
        badge="점수 미연동"
        desc="점수가 높은 순입니다."
        action={
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
          >
            {expanded ? "접기" : `전체 보기 (${TALENT_TYPES.length})`}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        }
      >
        <ul className="space-y-3.5">
          {visible.map((t, i) => (
            <li key={t.no}>
              {/* 접힘 상태에서 상위 5와 하위 5 사이에 생략 표시 */}
              {!expanded && i === PEEK && hiddenCount > 0 && (
                <div className="flex items-center gap-3 py-1.5 mb-3.5">
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  <span className="text-[12px] text-[var(--ink-soft)] tabular-nums">
                    {hiddenCount}개 생략
                  </span>
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>
              )}
              <Row item={t} index={i} highlight={selectedNos.includes(t.no)} />
            </li>
          ))}
        </ul>
      </Block>
    </div>
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
          <h3 className="text-[15px] font-bold text-[var(--ink)]">
            {title}
            <span className="ml-2 text-[13px] font-medium text-[var(--ink-muted)] tabular-nums">
              {count}
            </span>
            {badge && (
              <span className="ml-2 align-middle rounded-full border border-[var(--line-strong)] px-2 py-[1px] text-[11px] font-medium text-[var(--ink-muted)]">
                {badge}
              </span>
            )}
          </h3>
          <p className="mt-1 text-[12.5px] text-[var(--ink-muted)]">{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * 한 줄 = 번호 · 이름 · 점수 · 막대.
 * 막대 스타일은 dept-bar.tsx 의 시각 어휘를 따랐다 (트랙 h-1.5 + gold 그라디언트).
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
    <div className="grid grid-cols-[2rem_1fr] items-start gap-3">
      <span className="pt-[1px] text-[12px] tabular-nums text-[var(--ink-soft)] text-right">
        {item.no}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span
            className={`truncate text-sm ${
              highlight ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"
            }`}
          >
            {item.name}
          </span>
          <span className="serif text-sm tabular-nums text-[var(--ink-muted)] shrink-0">
            {item.score.toFixed(1)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--bg-2)] overflow-hidden">
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
