import { GraduationCap, Briefcase } from "lucide-react";
import { serverNow } from "@/lib/server-now";
import TimelineTrack, { type BarSeg } from "@/components/timeline-track";

/** timeline-section.tsx 와 동일한 형태 (지원정보 xlsx 주입분) */
type EducationItem = {
  kind: string;
  school?: string;
  degree?: string;
  major?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
};

type CareerItem = {
  company: string;
  department?: string;
  title?: string;
  employment_type?: string;
  start_date?: string;
  end_date?: string;
};

/** 바 하나를 그리는 데 필요한 최소 정보로 정규화한 형태 */
type Segment = {
  label: string;
  detail: string;
  start: number; // epoch ms
  end: number | null; // null = 종료일 미기재 (재직중·휴학) → 차트 오른쪽 끝까지
};

/**
 * "2017.03.02" / "2017-03-02" / "2017.03" / "2017" 를 epoch ms 로.
 * 파싱 실패는 null — 호출부에서 해당 항목을 건너뛴다.
 */
function parseDate(s?: unknown): number | null {
  // education·career 는 백엔드에서 dict[str, Any] 로 검증 없이 내려온다.
  // xlsx 에서 날짜가 시리얼 숫자(43570)로 들어오면 truthy 라 통과한 뒤
  // s.match 에서 터지고, 서버 컴포넌트라 페이지 전체가 오류 화면이 된다.
  if (typeof s !== "string" || !s) return null;
  const m = s.match(/^(\d{4})[.\-/년]?\s*(\d{1,2})?[.\-/월]?\s*(\d{1,2})?/);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 1900 || y > 2200) return null;

  // new Date 는 범위를 넘는 값을 조용히 굴린다 — new Date(2017, 12, 1) 은 2018년 1월이 된다.
  // 지원정보 xlsx 는 사람이 손으로 만들어 "2017.13" 같은 오타가 들어올 수 있고,
  // 그대로 두면 1년 어긋난 막대가 경고 없이 그려진다. 여기서 잘라낸다.
  const month = m[2] ? Number(m[2]) : 1;
  if (month < 1 || month > 12) return null;
  const day = m[3] ? Number(m[3]) : 1;
  if (day < 1 || day > 31) return null;

  const t = new Date(y, month - 1, day);
  // 2019.02.31 같은 날짜는 3월로 굴러간다. 월이 바뀌었으면 잘못된 입력이다
  if (t.getMonth() !== month - 1) return null;
  return t.getTime();
}

/** 화면에 쓸 기간 문자열 — 연.월 까지만 */
function ymLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 눈금 연도 목록.
 * 전체 기간이 4년인 지원자와 25년인 지원자가 같이 있으므로 간격을 자동 조정한다.
 * (10년 미만 1년 / 25년 미만 5년 / 그 이상 10년 단위)
 */
function tickYears(startY: number, endY: number): number[] {
  const span = endY - startY;
  const step = span < 10 ? 1 : span < 25 ? 5 : 10;
  const first = Math.ceil(startY / step) * step;
  const out: number[] = [];
  for (let y = first; y <= endY; y += step) out.push(y);
  return out;
}

function toSegments(
  education: EducationItem[] | null | undefined,
  career: CareerItem[] | null | undefined,
): { edu: Segment[]; car: Segment[] } {
  const edu: Segment[] = [];
  for (const e of education || []) {
    const start = parseDate(e.start_date);
    if (start === null) continue; // 날짜 없으면 바에서 제외 (아래 목록에는 그대로 남음)
    edu.push({
      label: [e.school || e.kind, e.degree].filter(Boolean).join(" "),
      detail: [e.major, e.status].filter(Boolean).join(" · "),
      start,
      end: parseDate(e.end_date),
    });
  }

  const car: Segment[] = [];
  for (const c of career || []) {
    const start = parseDate(c.start_date);
    if (start === null) continue;
    car.push({
      label: [c.company, c.title].filter(Boolean).join(" "),
      detail: [c.department, c.employment_type].filter(Boolean).join(" · "),
      start,
      end: parseDate(c.end_date),
    });
  }

  edu.sort((a, b) => a.start - b.start);
  car.sort((a, b) => a.start - b.start);
  return { edu, car };
}

/** 트랙별 색 — 같은 트랙 안에서 순서대로 진해진다 (겹쳐도 구분되도록) */
const EDU_COLORS = ["#33307A", "#4A46A8", "#6B67C4", "#8C89D6"];
const CAR_COLORS = ["#F39200", "#D97D00", "#B86A00", "#F5A733", "#FFC166"];

/**
 * 얇은 막대의 최소 폭(%). 짧은 항목이 긴 축에서 실 조각이 되지 않게 한다.
 * 실측: 27년 축에서 5개월 경력은 0.9% = 900px 바에서 8px 로 잡기도 어렵다.
 */
const MIN_WIDTH = 2.2;

/**
 * 레인 배정 — 기간이 겹치는 항목만 아래 줄로 내린다 (Gantt 의 표준 해법).
 *
 * **반드시 실제 폭으로 계산해야 한다.** 최소 폭으로 부풀린 값을 쓰면
 * 겹치지도 않는 이력이 갈라진다 — 2개월 경력(실폭 1.6%)이 2.2% 로 부풀려져
 * 0.02% 차이로 다음 경력을 밀어내는 사례가 실제로 나왔다.
 * 최소 폭은 "얇은 막대를 마우스로 잡게" 하는 렌더링 편의일 뿐,
 * 시간에 대한 사실이 아니다. 레인은 사실로만 나눈다.
 *
 * 여유 간격(gap)도 두지 않는다. 2025.02 졸업 → 2025.03 입학처럼 잇달아
 * 이어지는 학력은 17.5년 축에서 0.25% 밖에 안 떨어져 있는데, 이걸 갈라놓으면
 * 두 과정을 *동시에* 다닌 것처럼 읽힌다. 연속된 이력은 붙어 보이는 것이 맞고,
 * 구분은 색이 맡는다.
 *
 * segs 는 호출 전에 시작일 순으로 정렬돼 있어야 한다 (toSegments 에서 정렬함).
 * 그래야 첫 빈 레인에 넣는 greedy 가 최소 레인 수를 보장한다.
 *
 * 그래서 이 함수는 **화면 값이 아니라 실제 시각(ms)** 을 받는다. 퍼센트를 받으면
 * 누군가 pos() 에 클램프나 최소 폭을 넣는 순간 같은 버그가 세 번째로 재발하는데,
 * 인자 자체가 사실이면 그 통로가 막힌다.
 */
function assignLanes(segs: Segment[], axisEnd: number): number[] {
  const laneEnd: number[] = []; // 레인별 마지막 종료 시각(ms)
  return segs.map((s) => {
    // 종료일 미기재(재직중·휴학)는 축 끝까지. 역전 입력은 시작 시점의 점으로 본다.
    const end = Math.max(s.end ?? axisEnd, s.start);
    let lane = laneEnd.findIndex((e) => e <= s.start);
    if (lane === -1) lane = laneEnd.length;
    // 역전 입력이 레인 끝을 뒤로 물리면, 뒤 항목이 빈 레인으로 오판돼 겹쳐 그려진다
    laneEnd[lane] = Math.max(laneEnd[lane] ?? -Infinity, end);
    return lane;
  });
}

/**
 * 개발 모드 자기점검 — 레인 배정이 사실과 어긋나면 알린다.
 *
 * 이 로직은 같은 종류의 버그가 두 번 재발했다. 두 번 다 화면용으로 만든 값이
 * 「누가 겹치는가」라는 사실 판단에 흘러든 것이 원인이었다.
 * 주석은 세 번째를 막지 못하므로, **원본 ms 기준으로** 실제로 검사한다.
 * 서버 컴포넌트라 경고는 dev 서버 터미널에 뜬다.
 */
function warnIfLanesWrong(
  track: string,
  segs: Segment[],
  lanes: number[],
  axisEnd: number,
): void {
  if (process.env.NODE_ENV === "production" || segs.length === 0) return;

  const endOf = (s: Segment) => Math.max(s.end ?? axisEnd, s.start);
  const warn = (msg: string) =>
    console.warn(
      `[TimelineBar] ${track}: ${msg}`,
      segs.map((s, i) => ({ label: s.label, lane: lanes[i] })),
    );

  for (let i = 1; i < segs.length; i += 1) {
    if (segs[i].start < segs[i - 1].start) {
      warn("시작일 순으로 정렬돼 있지 않다 (greedy 최소 레인 전제가 깨진다)");
      break;
    }
  }

  // 같은 레인 안에서는 어떤 두 항목도 겹치면 안 된다
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      if (lanes[i] !== lanes[j]) continue;
      if (segs[i].start < endOf(segs[j]) && segs[j].start < endOf(segs[i])) {
        warn(`같은 레인에 겹치는 항목이 있다 (${segs[i].label} ↔ ${segs[j].label})`);
        return;
      }
    }
  }

  // 최소성 — 구간 그래프에서 최소 레인 수 = 최대 동시 겹침 깊이
  const events = segs.flatMap((s) => [
    { t: s.start, k: 1 },
    { t: endOf(s), k: -1 },
  ]);
  // 끝점이 맞닿는 것(졸업일 = 입학일)은 겹침이 아니므로 같은 시각에선 -1 을 먼저 본다
  events.sort((a, b) => a.t - b.t || a.k - b.k);
  let cur = 0;
  let deep = 0;
  for (const e of events) {
    cur += e.k;
    deep = Math.max(deep, cur);
  }
  const used = lanes.reduce((n, l) => Math.max(n, l + 1), 0);
  const depth = Math.max(1, deep);
  if (used !== depth) warn(`레인 ${used}겹 ≠ 동시 진행 ${depth}건`);

  const broken = segs.filter((s) => s.end !== null && s.end < s.start);
  if (broken.length > 0) {
    console.warn(
      `[TimelineBar] ${track}: 종료일이 시작일보다 빠른 항목`,
      broken.map((s) => s.label),
    );
  }
}

/**
 * 그려질 폭 — 최소 폭까지 넓히되, **같은 레인의 다음 막대를 침범하지 않는 선까지만**.
 * 부풀리기가 옆 막대를 덮어 한 덩어리로 보이는 것을 막는다.
 * 레인 배정이 끝난 뒤라야 "같은 레인의 다음 막대"를 알 수 있다.
 */
function renderWidths(
  boxes: { left: number; trueWidth: number }[],
  lanes: number[],
): number[] {
  return boxes.map(({ left, trueWidth }, i) => {
    const next = boxes.findIndex((_, j) => j > i && lanes[j] === lanes[i]);
    const room = next === -1 ? Infinity : boxes[next].left - left;
    // 바로 옆에 다음 막대가 붙어 있으면 room 이 0 이라 폭도 0 이 된다.
    // 그러면 기간이 이상한 항목일수록 화면에서 사라져 확인할 길이 없어진다.
    return Math.max(trueWidth, Math.min(MIN_WIDTH, room), 0.4);
  });
}

export default function TimelineBar({
  education,
  career,
}: {
  education: EducationItem[] | null | undefined;
  career: CareerItem[] | null | undefined;
}) {
  const { edu, car } = toSegments(education, career);
  const all = [...edu, ...car];

  // 날짜를 하나도 못 읽었으면 바를 그리지 않는다 (아래 목록만 남음)
  if (all.length === 0) return null;

  // 축 시작 = 지원자별 가장 이른 날짜 / 축 끝 = 항상 현재 시각.
  // 끝을 고정하면 지원자끼리 "언제까지 이력이 이어졌는지"를 같은 기준으로 비교할 수 있다.
  const min = Math.min(...all.map((s) => s.start));
  const now = serverNow();
  const knownEnds = all.map((s) => s.end).filter((v): v is number => v !== null);
  const max = Math.max(now, ...all.map((s) => s.start), ...knownEnds);
  const span = Math.max(max - min, 365 * 24 * 60 * 60 * 1000);

  // 좌우 끝에 붙지 않도록 3% 여백
  const pos = (ms: number) => ((ms - min) / span) * 94 + 3;

  const years = tickYears(
    new Date(min).getFullYear(),
    new Date(min + span).getFullYear(),
  );

  /**
   * 클라이언트로 넘길 형태로 변환 — 여기서 위치·폭·기간 문자열을 전부 확정한다.
   * 클라이언트는 날짜를 모르고, 넘겨받은 %와 문자열만 그린다.
   */
  const toBarSegs = (segs: Segment[], colors: string[], track: string): BarSeg[] => {
    // 겹침 판정은 실제 날짜로만 한다. 화면 좌표는 그 뒤에 계산한다.
    const lanes = assignLanes(segs, max);
    warnIfLanesWrong(track, segs, lanes, max);

    const boxes = segs.map((s) => {
      const left = pos(s.start);
      // 역전 입력이면 폭이 음수가 되어 막대가 사라진다. 최소 폭 계산에 맡긴다
      return { left, trueWidth: Math.max(pos(Math.max(s.end ?? max, s.start)) - left, 0) };
    });
    const widths = renderWidths(boxes, lanes);

    return segs.map((s, i) => {
      // 종료일이 시작일보다 빠른 입력 오류. Math.max 로 눌러버리면 작은 막대가 되어
      // 마우스를 올리기 전까지 이상한 줄 모른다 → tooltip 기간 옆에 표시한다.
      const reversed = s.end !== null && s.end < s.start;
      return {
        label: s.label,
        detail: s.detail,
        period:
          `${ymLabel(s.start)} – ${s.end === null ? "계속" : ymLabel(s.end)}` +
          (reversed ? " (기간 확인 필요)" : ""),
        left: boxes[i].left,
        width: widths[i],
        lane: lanes[i],
        color: colors[i % colors.length],
        open: s.end === null,
      };
    });
  };

  return (
    <div className="mb-6">
      {/* 로딩 애니메이션 정의 — 이 컴포넌트와 같은 파일에 둔다.
          globals.css 에 넣으면 이 컴포넌트만 보고는 존재를 알 수 없고,
          빌드 파이프라인도 달라 반영 여부를 따로 확인해야 한다. */}
      <style>{`
        @keyframes stepi-bar-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stepi-bar-grow { animation: none !important; }
        }
      `}</style>

      {/* 연도 눈금 */}
      <div className="relative h-[18px] mb-1.5">
        {years.map((y) => {
          const left = pos(new Date(y, 0, 1).getTime());
          if (left < 0 || left > 100) return null;
          return (
            <span
              key={y}
              className="absolute top-0 -translate-x-1/2 text-[11px] tabular-nums text-[var(--ink-muted)]"
              style={{ left: `${left}%` }}
            >
              {y}
            </span>
          );
        })}
      </div>

      {/* 바 본체 — 시각적으로 한 줄, 위=경력 아래=학력.
          배경·격자선은 별도 레이어에서 clip 하고, 세그먼트 레이어는 clip 하지 않는다
          (hover tooltip 이 바 밖으로 나올 수 있어야 함) */}
      <div className="relative">
        {/* 배경 + 연도 세로 격자 (여기만 overflow-hidden) */}
        <div className="absolute inset-0 rounded-md bg-[var(--line)]/40 overflow-hidden">
          {years.map((y) => {
            const left = pos(new Date(y, 0, 1).getTime());
            if (left < 0 || left > 100) return null;
            return (
              <div
                key={y}
                className="absolute top-0 bottom-0 w-px bg-[var(--line)]"
                style={{ left: `${left}%` }}
              />
            );
          })}
        </div>

        {/* 세그먼트 레이어 + 커서 추적 tooltip (클라이언트) */}
        <TimelineTrack
          career={toBarSegs(car, CAR_COLORS, "경력")}
          education={toBarSegs(edu, EDU_COLORS, "학력")}
        />
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
        {car.length > 0 && (
          <Legend icon={<Briefcase size={11} />} label="경력" color={CAR_COLORS[0]} />
        )}
        {edu.length > 0 && (
          <Legend icon={<GraduationCap size={11} />} label="학력" color={EDU_COLORS[0]} />
        )}
        {all.some((s) => s.end === null) && (
          <span className="text-[11px] text-[var(--ink-soft)]">
            흐린 끝 = 종료일 미기재 (재직중·휴학)
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--ink-muted)]">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
      {icon}
      {label}
    </span>
  );
}
