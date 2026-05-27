"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { analysesApi } from "@/lib/api/analyses";
import { AnomalyTimeline } from "./anomaly-timeline";
import { useDatasetStore } from "@/stores/dataset-store";
import type { AnalysisDetail } from "@/types/dataset";

export function AnomaliesView() {
  const { selectedDatasetId } = useDatasetStore();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["analyses", "dataset", selectedDatasetId, "anomalies"],
    queryFn: () =>
      selectedDatasetId
        ? analysesApi.getByDataset(selectedDatasetId)
        : analysesApi.getRecent(20),
    staleTime: 30_000,
  });

  const anomalyAnalyses = analyses?.filter(
    (a) => a.analysis_type === "anomaly_detection" && a.status === "completed"
  ) ?? [];

  const activeId = selectedAnalysisId ?? anomalyAnalyses[0]?.id ?? null;

  const { data: detail } = useQuery<AnalysisDetail>({
    queryKey: ["analyses", activeId],
    queryFn: () => analysesApi.getById(activeId!),
    enabled: !!activeId,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  if (anomalyAnalyses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No anomaly analyses yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Ask the agent to &quot;detect anomalies&quot; in the Query tab.
        </p>
      </div>
    );
  }

  const anomalies = detail?.result?.ml_results?.flatMap((r) => r.anomalies ?? []) ?? [];
  const totalRows = 1000;

  return (
    <div className="space-y-5">
      {anomalyAnalyses.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {anomalyAnalyses.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAnalysisId(a.id)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                a.id === activeId
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {new Date(a.created_at).toLocaleDateString()} · {a.user_query?.slice(0, 40) ?? "Anomaly Detection"}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5 shadow-card">
        <AnomalyTimeline anomalies={anomalies} totalRows={totalRows} />
      </div>

      {detail?.result?.summary && (
        <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Analysis Summary</p>
          <p className="text-sm leading-relaxed text-foreground/80">{detail.result.summary}</p>
        </div>
      )}
    </div>
  );
}
