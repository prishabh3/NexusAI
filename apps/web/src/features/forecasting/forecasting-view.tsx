"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { analysesApi } from "@/lib/api/analyses";
import { ForecastChart } from "./forecast-chart";
import { useDatasetStore } from "@/stores/dataset-store";
import type { AnalysisDetail } from "@/types/dataset";

export function ForecastingView() {
  const { selectedDatasetId } = useDatasetStore();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["analyses", "dataset", selectedDatasetId, "forecasting"],
    queryFn: () =>
      selectedDatasetId
        ? analysesApi.getByDataset(selectedDatasetId)
        : analysesApi.getRecent(20),
    staleTime: 30_000,
  });

  const forecastAnalyses = analyses?.filter(
    (a) => a.analysis_type === "forecasting" && a.status === "completed"
  ) ?? [];

  const activeId = selectedAnalysisId ?? forecastAnalyses[0]?.id ?? null;

  const { data: detail } = useQuery<AnalysisDetail>({
    queryKey: ["analyses", activeId],
    queryFn: () => analysesApi.getById(activeId!),
    enabled: !!activeId,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  if (forecastAnalyses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No forecast analyses yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Ask the agent to "forecast the next 30 days" in the Query tab.
        </p>
      </div>
    );
  }

  const primaryMl = detail?.result?.ml_results?.[0];
  const forecastPoints = primaryMl?.forecast_points ?? [];

  return (
    <div className="space-y-5">
      {/* Analysis selector */}
      {forecastAnalyses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {forecastAnalyses.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAnalysisId(a.id)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                a.id === activeId
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {new Date(a.created_at).toLocaleDateString()} · {a.user_query?.slice(0, 40) ?? "Forecast"}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      {forecastPoints.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-5 shadow-card">
          <ForecastChart
            points={forecastPoints}
            metric={primaryMl?.model_name ?? "value"}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">No forecast data available for this analysis.</p>
        </div>
      )}

      {/* Metrics */}
      {primaryMl?.metrics && Object.keys(primaryMl.metrics).length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(primaryMl.metrics).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
              <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {typeof v === "number" ? v.toFixed(3) : String(v)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {detail?.result?.summary && (
        <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Interpretation</p>
          <p className="text-sm leading-relaxed text-foreground/80">{detail.result.summary}</p>
        </div>
      )}
    </div>
  );
}
