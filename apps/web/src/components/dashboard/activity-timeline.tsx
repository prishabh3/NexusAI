"use client";

import type { Analysis } from "@/types/dataset";
import { cn, formatRelativeTime } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  eda: "Exploratory Analysis",
  anomaly_detection: "Anomaly Detection",
  forecasting: "Forecasting",
  classification: "Classification",
  regression: "Regression",
  clustering: "Clustering",
  correlation: "Correlation",
  custom_query: "Custom Query",
  full_pipeline: "Full Pipeline",
};

const STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-500",
  running:   "bg-blue-500 animate-pulse",
  failed:    "bg-red-500",
  queued:    "bg-amber-500",
  cancelled: "bg-muted-foreground/30",
};

export function ActivityTimeline({ analyses }: { analyses: Analysis[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-card h-full">
      <div className="border-b border-border px-5 py-3">
        <p className="text-[13px] font-semibold text-foreground">Activity</p>
      </div>
      <div className="px-5 py-4">
        {analyses.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-4">
            {analyses.slice(0, 12).map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span className={cn("mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full", STATUS_DOT[a.status] ?? STATUS_DOT.queued)} />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-foreground leading-snug">
                    {a.user_query ?? TYPE_LABEL[a.analysis_type] ?? a.analysis_type.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatRelativeTime(a.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
