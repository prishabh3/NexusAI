"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CorrelationHeatmapProps {
  matrix: Record<string, Record<string, number>>;
}

function correlationToColor(value: number): string {
  const abs = Math.abs(value);
  const alpha = Math.round(abs * 100);
  if (value > 0.7) return `rgba(59,130,246,${abs})`;   // blue — strong positive
  if (value > 0.3) return `rgba(59,130,246,${abs * 0.6})`;
  if (value < -0.7) return `rgba(239,68,68,${abs})`;  // red — strong negative
  if (value < -0.3) return `rgba(239,68,68,${abs * 0.6})`;
  return `rgba(100,116,139,${abs * 0.3})`;               // muted neutral
}

export function CorrelationHeatmap({ matrix }: CorrelationHeatmapProps) {
  const columns = useMemo(() => Object.keys(matrix), [matrix]);

  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">No correlation data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="w-24 text-right pr-1 text-muted-foreground font-normal" />
            {columns.map((col) => (
              <th key={col} className="w-16 text-center pb-1">
                <span className="block truncate max-w-[60px] text-muted-foreground font-medium" title={col}>
                  {col.length > 7 ? `${col.slice(0, 7)}…` : col}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((row) => (
            <tr key={row}>
              <td className="pr-2 text-right text-muted-foreground truncate max-w-[90px]" title={row}>
                {row.length > 10 ? `${row.slice(0, 10)}…` : row}
              </td>
              {columns.map((col) => {
                const value = row === col ? 1.0 : (matrix[row]?.[col] ?? 0);
                return (
                  <td
                    key={col}
                    className="h-8 w-14 rounded-sm text-center font-mono transition-all cursor-default"
                    style={{ backgroundColor: correlationToColor(value) }}
                    title={`${row} × ${col}: ${value.toFixed(3)}`}
                  >
                    <span className={cn(
                      "text-[10px] font-medium",
                      Math.abs(value) > 0.5 ? "text-white" : "text-foreground/70"
                    )}>
                      {value.toFixed(2)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
