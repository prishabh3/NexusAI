"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { ForecastPoint } from "@/types/dataset";
import { formatNumber } from "@/lib/utils";

interface ForecastChartProps {
  points: ForecastPoint[];
  metric: string;
}

export function ForecastChart({ points, metric }: ForecastChartProps) {
  const chartData = points.map((p) => ({
    date: p.timestamp,
    value: p.is_forecast ? null : p.value,
    forecast: p.is_forecast ? p.value : p.value,
    lower: p.lower_bound,
    upper: p.upper_bound,
    isForecast: p.is_forecast,
  }));

  const historical = points.filter((p) => !p.is_forecast);
  const forecasted = points.filter((p) => p.is_forecast);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-8 rounded-full bg-primary" />
          <span>Historical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-8 rounded-full bg-primary/50 border border-dashed border-primary/60" />
          <span>Forecast ({forecasted.length} periods)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-8 rounded-full bg-primary/10" />
          <span>95% CI</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.12} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(new Date(v), "MMM d")}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            labelFormatter={(v) => format(new Date(v as string), "MMM d, yyyy")}
            formatter={(v: number, name: string) => [formatNumber(v), name === "upper" ? "Upper CI" : name === "lower" ? "Lower CI" : metric]}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          {/* Confidence interval */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="url(#ciGradient)"
            stackId="ci"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="hsl(var(--background))"
            stackId="ci"
          />
          {/* Actual line */}
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            fill="none"
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="none"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
