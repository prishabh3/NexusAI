"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { analysesApi } from "@/lib/api/analyses";
import { FeatureImportanceChart } from "./feature-importance-chart";
import { useDatasetStore } from "@/stores/dataset-store";
import { cn } from "@/lib/utils";
import type { AnalysisDetail } from "@/types/dataset";

const ML_TYPES = ["classification", "regression", "clustering"] as const;

export function ModelsView() {
  const { selectedDatasetId } = useDatasetStore();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["analyses", "dataset", selectedDatasetId, "models"],
    queryFn: () =>
      selectedDatasetId
        ? analysesApi.getByDataset(selectedDatasetId)
        : analysesApi.getRecent(30),
    staleTime: 30_000,
  });

  const mlAnalyses = analyses?.filter(
    (a) => ML_TYPES.includes(a.analysis_type as typeof ML_TYPES[number]) && a.status === "completed"
  ) ?? [];

  const activeId = selectedAnalysisId ?? mlAnalyses[0]?.id ?? null;

  const { data: detail } = useQuery<AnalysisDetail>({
    queryKey: ["analyses", activeId],
    queryFn: () => analysesApi.getById(activeId!),
    enabled: !!activeId,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  if (mlAnalyses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No ML models trained yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Ask the agent to "classify" or "predict" a column in the Query tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Model selector */}
      <div className="space-y-2">
        {mlAnalyses.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedAnalysisId(a.id)}
            className={cn(
              "w-full rounded-lg border px-4 py-3 text-left transition-colors",
              a.id === activeId
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:bg-accent/40"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {a.analysis_type}
                </span>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {a.user_query?.slice(0, 70) ?? "AutoML Pipeline"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString()}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      {detail?.result && (() => {
        const ml = detail.result.ml_results?.[0];
        return (
          <div className="space-y-4">
            {/* Model name */}
            {ml?.model_name && (
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {ml.model_name}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{ml.task_type}</span>
              </div>
            )}

            {/* Metrics */}
            {ml?.metrics && Object.keys(ml.metrics).length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(ml.metrics).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
                    <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      {typeof v === "number" ? (v > 1 ? v.toFixed(2) : v.toFixed(4)) : String(v)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Feature importance */}
            {ml?.feature_importance && Object.keys(ml.feature_importance).length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                <h4 className="mb-3 text-sm font-medium text-foreground">Feature Importance (SHAP)</h4>
                <FeatureImportanceChart importance={ml.feature_importance} />
              </div>
            )}

            {/* Summary */}
            {detail.result.summary && (
              <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-card">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Model Summary</p>
                <p className="text-sm leading-relaxed text-foreground/80">{detail.result.summary}</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
