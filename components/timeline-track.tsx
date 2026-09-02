"use client";

import { useState } from "react";

/**
 * 연혁 바의 세그먼트 레이어 + 커서를 따라다니는 tooltip.
 *
 * 이 파일만 클라이언트 컴포넌트인 이유: 마우스 좌표는 브라우저에만 있기 때문.
 * 날짜 파싱·축 계산은 서버(`timeline-bar.tsx`)에서 끝내고 여기로는 계산된 %와
 * 표시용 문자열만 넘어온다. 그래야 `serverNow()` 가 브라우저로 새지 않는다.
 * (레이더 `radar-card.tsx` 도 같은 구조 — 점수는 page.tsx 가 계산해 넘긴다)
 *
 * 따라다니는 동작은 recharts 의 Tooltip 을 그대로 옮긴 것:
 *   1) 커서 좌표를 상태로 보관           (recharts: coordinate)
 *   2) 경계를 넘으면 안쪽으로 밀어 넣음   (recharts: viewBox clamp)
 *   3) top/left 는 고정하고 transform 만 바꿈 + transition: transform
 *   4) pointer-events: none 으로 커서를 가로채지 않음
 */
export type BarSeg = {
  label: string;
  detail: string;
  /** 표시용 기간 문자열 (예: "2017.03 – 2021.02") — 서버에서 포맷 완료 */
  period: string;
  left: number; // %
  width: number; // %
  /** 세로 몇 번째 줄인가 (0 = 맨 위). 기간이 겹치는 항목만 아래로 내려간다 */
  lane: number;
  color: string;
  /** 종료일 미기재 (재직중·휴학) */
  open: boolean;
};

/** 레인 한 겹의 높이(px)와 그 안에 놓이는 막대 높이 — 겹침이 잦으면 여기만 줄이면 된다 */
const LANE_H = 28;
const BAR_H = 20;

type Hover = {
  key: string;
  seg: BarSeg;
  /** 바 좌측 기준 커서 x (px) */
  x: number;
  /** 바 전체 폭 (px) — tooltip 을 양끝 안쪽으로 가두는 데 사용 */
  w: number;
};

const TOOLTIP_MAX = 280;

export default function TimelineTrack({
  career,
  education,
}: {
  career: BarSeg[];
  education: BarSeg[];
}) {
  const [hover, setHover] = useState<Hover | null>(null);

  const onMove =
    (key: string, seg: BarSeg) => (e: React.MouseEvent<HTMLDivElement>) => {
      // 세그먼트가 아니라 바 전체를 기준으로 잡아야 커서 위치가 맞는다
      const root = e.currentTarget.closest("[data-timeline-root]");
      if (!root) return;
      const r = root.getBoundingClientRect();
      setHover({ key, seg, x: e.clientX - r.left, w: r.width });
    };

  // 키보드로 막대에 초점이 가면 같은 툴팁을 연다. 커서 위치가 없으므로 막대 가운데를 쓴다
  const onFocus =
    (key: string, seg: BarSeg) => (e: React.FocusEvent<HTMLDivElement>) => {
      const root = e.currentTarget.closest("[data-timeline-root]");
      if (!root) return;
      const r = root.getBoundingClientRect();
      const b = e.currentTarget.getBoundingClientRect();
      setHover({ key, seg, x: b.left + b.width / 2 - r.left, w: r.width });
    };

  const onBlur = () => setHover(null);

  // recharts 의 viewBox clamp 에 해당 — 양끝에서 tooltip 이 잘리지 않게 안쪽으로 민다
  const half = TOOLTIP_MAX / 2;
  const x = hover ? Math.min(Math.max(hover.x, half), Math.max(hover.w - half, half)) : 0;

  return (
    <div
      className="relative"
      data-timeline-root
      onMouseLeave={() => setHover(null)}
    >
      {career.length > 0 && (
        <Row segs={career} track="c" onMove={onMove} onFocus={onFocus} onBlur={onBlur} activeKey={hover?.key} />
      )}
      {/* 학력도 경력과 같게 방어한다 — 없으면 22px 빈 줄만 남아
          "데이터가 있는데 안 나오나?" 로 읽힌다 */}
      {education.length > 0 && (
        <Row segs={education} track="e" onMove={onMove} onFocus={onFocus} onBlur={onBlur} activeKey={hover?.key} />
      )}

      {/* tooltip — top/left 고정, transform 만 움직인다 */}
      <div
        className="pointer-events-none absolute bottom-[calc(100%+9px)] left-0 top-auto z-40 w-max
                   rounded-md border border-[var(--line-strong)] bg-white px-2.5 py-2
                   shadow-[0_4px_14px_rgba(27,26,64,0.16)]
                   motion-safe:transition-[transform,opacity] motion-safe:duration-100 ease-out"
        style={{
          maxWidth: TOOLTIP_MAX,
          opacity: hover ? 1 : 0,
          visibility: hover ? "visible" : "hidden",
          transform: `translateX(${x}px) translateX(-50%) translateY(${hover ? 0 : 4}px)`,
        }}
      >
        {hover && (
          <>
            <div className="text-[13px] font-bold leading-[1.4] text-[var(--p-700)]">
              {hover.seg.label}
            </div>
            <div className="mt-0.5 text-[12px] font-bold tabular-nums text-black">
              {hover.seg.period}
            </div>
            {hover.seg.detail && (
              <div className="mt-0.5 text-[12px] font-bold leading-[1.5] text-black">
                {hover.seg.detail}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 트랙 한 겹 — 세그먼트를 절대배치로 얹는다 */
function Row({
  segs,
  track,
  onMove,
  onFocus,
  onBlur,
  activeKey,
}: {
  segs: BarSeg[];
  track: string;
  onMove: (
    key: string,
    seg: BarSeg,
  ) => (e: React.MouseEvent<HTMLDivElement>) => void;
  onFocus: (
    key: string,
    seg: BarSeg,
  ) => (e: React.FocusEvent<HTMLDivElement>) => void;
  onBlur: () => void;
  activeKey?: string;
}) {
  // 트랙 높이는 실제로 쓰인 레인 수만큼 늘어난다. 겹침이 없으면 예전과 똑같은 22px.
  const laneCount = segs.reduce((n, s) => Math.max(n, s.lane + 1), 1);
  const pad = (LANE_H - BAR_H) / 2;

  return (
    <div className="relative" style={{ height: laneCount * LANE_H }}>
      {segs.map((s, i) => {
        const key = `${track}-${i}`;
        const isActive = activeKey === key;
        return (
          <div
            key={key}
            onMouseMove={onMove(key, s)}
            // 마우스만 지원하면 키보드·터치 사용자는 기간과 소속을 볼 방법이 없다.
            // 막대 자체에 이름을 붙여 스크린리더에도 빈 영역으로 들리지 않게 한다.
            tabIndex={0}
            role="img"
            aria-label={`${s.label} ${s.period}${s.detail ? ` ${s.detail}` : ""}`}
            onFocus={onFocus(key, s)}
            onBlur={onBlur}
            // 5개월짜리 경력은 폭이 얇아 잡기 어렵다 — 보이지 않는 hover 영역을 넓힌다.
            // 세로 여백은 레인 사이 간격(pad)을 넘지 않아야 아래 레인의 클릭을 안 뺏는다.
            className={`absolute outline-none
                        before:absolute before:-inset-x-[5px] before:-inset-y-[3px] before:content-['']
                        focus-visible:ring-2 focus-visible:ring-[var(--secondary)] focus-visible:ring-offset-1
                        ${isActive ? "z-30" : ""}`}
            style={{
              left: `${s.left}%`,
              width: `${s.width}%`,
              top: s.lane * LANE_H + pad,
              height: BAR_H,
            }}
          >
            {/* 자라나는 래퍼 — 로딩 시 좌→우. hover 변형은 안쪽 막대가 맡아 서로 간섭 없음 */}
            <div
              className="stepi-bar-grow h-full w-full"
              style={{
                transformOrigin: "left center",
                animation: "stepi-bar-grow 0.9s cubic-bezier(0.22,0.68,0.28,1) both",
                animationDelay: `${Math.round(s.left * 6)}ms`,
              }}
            >
              {/* 막대 본체 — 커서가 올라간 동안 떠오른 채 유지 */}
              <div
                className={`h-full w-full rounded-[6px] transition-[transform,box-shadow] duration-150 ease-out
                            ${
                              isActive
                                ? "-translate-y-[2px] scale-y-[1.18] shadow-[0_2px_8px_rgba(27,26,64,0.28)]"
                                : ""
                            }`}
                style={{
                  background: s.open
                    ? `linear-gradient(to right, ${s.color} 55%, ${s.color}22)`
                    : s.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
