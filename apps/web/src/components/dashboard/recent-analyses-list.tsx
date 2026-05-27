"use client";

import Link from "next/link";
import { CheckCircle2, Clock, XCircle, Loader2, ArrowRight } from "lucide-react";
import type { Analysis } from "@/types/dataset";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";

const STATUS = {
  completed: { dot: "bg-emerald-500",        label: "Done" },
  running:   { dot: "bg-blue-500 animate-pulse", label: "Running" },
  failed:    { dot: "bg-red-500",             label: "Failed" },
  queued:    { dot: "bg-amber-500",           label: "Queued" },
  cancelled: { dot: "bg-muted-foreground/40", label: "Cancelled" },
} as const;

const TYPE_LABEL: Record<string, string> = {
  eda: "EDA",
  anomaly_detection: "Anomaly",
  forecasting: "Forecast",
  classification: "Classify",
  regression: "Regression",
  clustering: "Cluster",
  correlation: "Correlation",
  custom_query: "Query",
  full_pipeline: "Pipeline",
};

export function RecentAnalysesList({ analyses }: { analyses: Analysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-8 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No analyses yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Run an analysis on any dataset to see results here.</p>
        <Link href="/chat" className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          Start querying <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <p className="text-[13px] font-semibold text-foreground">Recent Analyses</p>
        <Link href="/analysis" className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>
      <div className="divide-y divide-border">
        {analyses.slice(0, 8).map((a) => {
          const key = a.status as keyof typeof STATUS;
          const s = key in STATUS ? STATUS[key] : STATUS.queued;
          return (
            <Link
              key={a.id}
              href={`/analysis/${a.id}`}
              className="group flex items-center gap-3.5 px-5 py-3 hover:bg-muted/30 transition-colors"
            >
              <span className={cn("mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full", s.dot)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
                  {a.user_query ?? (TYPE_LABEL[a.analysis_type] ?? a.analysis_type.replace(/_/g, " "))}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {TYPE_LABEL[a.analysis_type] ?? a.analysis_type}
                  {a.duration_seconds != null && <> · {formatDuration(a.duration_seconds)}</>}
                  {a.step_count > 0 && <> · {a.step_count} steps</>}
                </p>
              </div>
              <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                {formatRelativeTime(a.created_at)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
