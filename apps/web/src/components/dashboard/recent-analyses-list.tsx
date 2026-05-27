"use client";

import Link from "next/link";
import { Brain, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Analysis } from "@/types/dataset";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  running: { icon: Brain, color: "text-blue-500", label: "Running" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  queued: { icon: Clock, color: "text-yellow-500", label: "Queued" },
  cancelled: { icon: XCircle, color: "text-muted-foreground", label: "Cancelled" },
} as const;

const TYPE_LABELS: Record<string, string> = {
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

export function RecentAnalysesList({ analyses }: { analyses: Analysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Brain className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">No analyses yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Recent Analyses</h3>
      </div>
      <div className="divide-y divide-border">
        {analyses.slice(0, 8).map((analysis) => {
          const cfg = STATUS_CONFIG[analysis.status] ?? STATUS_CONFIG.queued;
          const Icon = cfg.icon;
          return (
            <Link
              key={analysis.id}
              href={`/analysis/${analysis.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", cfg.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm text-foreground">
                    {analysis.user_query ?? TYPE_LABELS[analysis.analysis_type] ?? analysis.analysis_type}
                  </p>
                  <span className="ml-2 flex-shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(analysis.created_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cfg.color}>{cfg.label}</span>
                  {analysis.duration_seconds != null && (
                    <>
                      <span>·</span>
                      <span>{formatDuration(analysis.duration_seconds)}</span>
                    </>
                  )}
                  {analysis.step_count > 0 && (
                    <>
                      <span>·</span>
                      <span>{analysis.step_count} steps</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
