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
function parseDate(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})[.\-/]?(\d{1,2})?[.\-/]?(\d{1,2})?/);
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

  return new Date(y, month - 1, day).getTime();
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
 */
function assignLanes(boxes: { left: number; trueWidth: number }[]): number[] {
  const laneRight: number[] = []; // 레인별 현재 오른쪽 끝(%)
  return boxes.map(({ left, trueWidth }) => {
    let lane = laneRight.findIndex((right) => right <= left);
    if (lane === -1) lane = laneRight.length;
    laneRight[lane] = left + trueWidth;
    return lane;
  });
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
    return Math.max(trueWidth, Math.min(MIN_WIDTH, room));
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
  const toBarSegs = (segs: Segment[], colors: string[]): BarSeg[] => {
    const boxes = segs.map((s) => {
      const left = pos(s.start);
      return { left, trueWidth: pos(s.end ?? max) - left };
    });
    // 겹치는 항목을 아래 줄로 내린다 — 위치가 다 정해진 뒤라야 판단할 수 있다.
    const lanes = assignLanes(boxes);
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
          career={toBarSegs(car, CAR_COLORS)}
          education={toBarSegs(edu, EDU_COLORS)}
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
