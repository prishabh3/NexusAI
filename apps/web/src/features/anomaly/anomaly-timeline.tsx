"use client";

import { AlertTriangle, Info } from "lucide-react";
import type { AnomalyRecord } from "@/types/dataset";
import { cn, SEVERITY_BG_COLORS } from "@/lib/utils";

interface AnomalyTimelineProps {
  anomalies: AnomalyRecord[];
  totalRows: number;
}

export function AnomalyTimeline({ anomalies, totalRows }: AnomalyTimelineProps) {
  const critical = anomalies.filter((a) => a.severity === "critical");
  const high = anomalies.filter((a) => a.severity === "high");
  const medium = anomalies.filter((a) => a.severity === "medium");

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Critical", count: critical.length, severity: "critical" },
          { label: "High", count: high.length, severity: "high" },
          { label: "Medium", count: medium.length, severity: "medium" },
        ].map(({ label, count, severity }) => (
          <div key={label} className={cn("rounded-lg px-3 py-2.5", SEVERITY_BG_COLORS[severity as keyof typeof SEVERITY_BG_COLORS])}>
            <p className="text-lg font-semibold">{count}</p>
            <p className="text-xs font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Density bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Anomaly density</span>
          <span>{totalRows > 0 ? ((anomalies.length / totalRows) * 100).toFixed(2) : "0.00"}% of {totalRows.toLocaleString()} rows</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-red-500/70"
            style={{ width: `${totalRows > 0 ? Math.min(100, (anomalies.length / totalRows) * 100 * 20) : 0}%` }}
          />
        </div>
      </div>

      {/* Anomaly list */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {anomalies.slice(0, 20).map((anomaly, i) => (
          <AnomalyRow key={i} anomaly={anomaly} />
        ))}
        {anomalies.length > 20 && (
          <p className="text-center text-xs text-muted-foreground py-2">
            +{anomalies.length - 20} more anomalies
          </p>
        )}
      </div>

      {anomalies.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
          <Info className="h-4 w-4 flex-shrink-0" />
          No anomalies detected in this dataset.
        </div>
      )}
    </div>
  );
}

function AnomalyRow({ anomaly }: { anomaly: AnomalyRecord }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(
            "h-3.5 w-3.5 flex-shrink-0",
            anomaly.severity === "critical" ? "text-red-500" :
            anomaly.severity === "high" ? "text-orange-500" :
            anomaly.severity === "medium" ? "text-yellow-500" : "text-green-500"
          )} />
          <span className="font-medium text-foreground">Row {anomaly.row_index}</span>
        </div>
        <span className={cn(
          "rounded-sm px-1.5 py-0.5 text-[10px] font-medium capitalize",
          SEVERITY_BG_COLORS[anomaly.severity as keyof typeof SEVERITY_BG_COLORS]
        )}>
          {anomaly.severity}
        </span>
      </div>
      <p className="mt-1.5 text-muted-foreground leading-relaxed">{anomaly.explanation}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {anomaly.affected_columns.map((col) => (
          <span key={col} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {col}
          </span>
        ))}
      </div>
    </div>
  );
}
