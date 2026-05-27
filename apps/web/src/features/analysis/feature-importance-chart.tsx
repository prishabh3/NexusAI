"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface FeatureImportanceChartProps {
  importance: Record<string, number>;
  maxFeatures?: number;
}

export function FeatureImportanceChart({ importance, maxFeatures = 12 }: FeatureImportanceChartProps) {
  const sorted = Object.entries(importance)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxFeatures)
    .map(([name, value]) => ({ name, value }));

  const max = sorted[0]?.value ?? 1;

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 28)}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        barCategoryGap="20%"
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          domain={[0, max * 1.05]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.toFixed(3)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          formatter={(v: number) => [v.toFixed(4), "Importance"]}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {sorted.map((_, i) => (
            <Cell
              key={i}
              fill={`hsl(222 83% ${75 - (i / sorted.length) * 30}%)`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
