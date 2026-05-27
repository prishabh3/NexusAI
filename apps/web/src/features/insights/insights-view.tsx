"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { insightsApi } from "@/lib/api/insights";
import { InsightCard } from "./insight-card";
import { useDatasetStore } from "@/stores/dataset-store";
import type { Insight } from "@/types/dataset";

const CATEGORY_OPTIONS = [
  "all",
  "anomaly",
  "trend",
  "correlation",
  "forecast",
  "recommendation",
  "data_quality",
  "business",
  "statistical",
] as const;

const SEVERITY_OPTIONS = ["all", "critical", "warning", "opportunity", "info"] as const;

export function InsightsView() {
  const { selectedDatasetId } = useDatasetStore();
  const [category, setCategory] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");

  const { data: insights, isLoading, isError } = useQuery({
    queryKey: ["insights", selectedDatasetId],
    queryFn: () =>
      selectedDatasetId
        ? insightsApi.getByDataset(selectedDatasetId)
        : insightsApi.getRecent(50),
    staleTime: 30_000,
  });

  const filtered = insights?.filter((ins: Insight) => {
    const matchesCat = category === "all" || ins.category === category;
    const matchesSev = severity === "all" || ins.severity === severity;
    return matchesCat && matchesSev;
  }) ?? [];

  if (isLoading) return null;

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
        <p className="text-sm text-destructive">Failed to load insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? "All Categories" : c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SEVERITY_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                severity === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All Severities" : s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} insight{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Insights grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No insights yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Run an analysis to generate AI-powered insights.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((insight: Insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
