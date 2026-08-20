"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface Props {
  data: Array<{ axis: string; value: number }>;
  color?: string;
  max?: number;
  /** 비교 기준선 (예: 합격자 평균) — 축 이름 → 값. 연한 음영으로 함께 표시 */
  baseline?: Record<string, number> | null;
  /** 본 시리즈 / 기준선 범례 라벨 */
  valueLabel?: string;
  baselineLabel?: string;
  /** 그림 높이(px). 좁은 칸에 여러 개를 나란히 놓을 때만 줄인다 */
  height?: number;
  /** 꼭짓점 라벨 크기(px). 칸이 좁아지면 라벨끼리 붙어 읽기 어렵다 */
  labelSize?: number;
}

export default function RadarCard({
  data,
  color = "#33307A",
  max = 10,
  baseline = null,
  valueLabel = "지원자",
  baselineLabel = "합격자 평균",
  height = 320,
  labelSize = 13,
}: Props) {
  const hasBaseline = baseline != null && Object.keys(baseline).length > 0;
  const merged = data.map((d) => ({
    ...d,
    baseline: hasBaseline ? baseline?.[d.axis] : undefined,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={merged} outerRadius="65%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--ink)", fontSize: labelSize, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          {/* 합격자 평균 — 연한 음영(아래쪽에 먼저 그려 지원자 라인이 위로) */}
          {hasBaseline && (
            <Radar
              name={baselineLabel}
              dataKey="baseline"
              stroke="var(--ink-soft)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="var(--ink-soft)"
              fillOpacity={0.1}
              isAnimationActive={false}
            />
          )}
          <Radar
            name={valueLabel}
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.22}
            isAnimationActive
          />
          {hasBaseline && (
            <Legend
              verticalAlign="bottom"
              height={24}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, color: "var(--ink-muted)" }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid var(--line-strong)",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
            }}
            formatter={(v, name) => [typeof v === "number" ? v.toFixed(1) : String(v), String(name)]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
