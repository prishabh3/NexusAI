"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Brain, ChevronRight, Clock } from "lucide-react";
import { analysesApi } from "@/lib/api/analyses";
import { cn } from "@/lib/utils";
import type { Analysis } from "@/types/dataset";

const STATUS_STYLES: Record<Analysis["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const TYPE_LABELS: Record<string, string> = {
  eda: "Exploratory Data Analysis",
  anomaly_detection: "Anomaly Detection",
  forecasting: "Forecasting",
  clustering: "Clustering",
  classification: "Classification",
  regression: "Regression",
  correlation: "Correlation",
  custom_query: "Custom Query",
  full_pipeline: "Full Pipeline",
};

export function AnalysisListView() {
  const { data: analyses, isLoading, isError } = useQuery({
    queryKey: ["analyses", "recent"],
    queryFn: () => analysesApi.getRecent(50),
    staleTime: 30_000,
  });

  if (isLoading) return null;

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
        <p className="text-sm text-destructive">Failed to load analyses. Is the API running?</p>
      </div>
    );
  }

  if (!analyses?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <Brain className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No analyses yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Start a conversation in the Query tab to run your first analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {analyses.map((analysis) => (
        <AnalysisRow key={analysis.id} analysis={analysis} />
      ))}
    </div>
  );
}

function AnalysisRow({ analysis }: { analysis: Analysis }) {
  return (
    <Link
      href={`/analysis/${analysis.id}`}
      className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-card transition-colors hover:bg-accent/40"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-medium capitalize",
            STATUS_STYLES[analysis.status]
          )}>
            {analysis.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABELS[analysis.analysis_type] ?? analysis.analysis_type}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-foreground truncate">
          {analysis.user_query || "Full pipeline analysis"}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
        {analysis.duration_seconds !== null && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {analysis.duration_seconds.toFixed(1)}s
          </span>
        )}
        <span>{new Date(analysis.created_at).toLocaleDateString()}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
