"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface Props {
  data: Array<{ axis: string; value: number }>;
  color?: string;
  max?: number;
}

export default function RadarCard({ data, color = "#33307A", max = 10 }: Props) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="68%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--ink)", fontSize: 13, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.2}
            isAnimationActive
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid var(--line-strong)",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink)",
            }}
            formatter={(v) => [typeof v === "number" ? v.toFixed(1) : String(v), "점수"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
