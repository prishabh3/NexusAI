"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { analysesApi } from "@/lib/api/analyses";
import { AgentStepTrace } from "@/features/chat/agent-step-trace";
import { AnomalyTimeline } from "@/features/anomaly/anomaly-timeline";
import { ForecastChart } from "@/features/forecasting/forecast-chart";
import { FeatureImportanceChart } from "@/features/analysis/feature-importance-chart";
import { cn, formatDuration } from "@/lib/utils";
import type { AnalysisDetail, MLResult } from "@/types/dataset";

interface Props {
  analysisId: string;
}

export function AnalysisDetailView({ analysisId }: Props) {
  const { data: analysis, isLoading, isError } = useQuery<AnalysisDetail>({
    queryKey: ["analyses", analysisId],
    queryFn: () => analysesApi.getById(analysisId),
    staleTime: 30_000,
  });

  if (isLoading) return null;

  if (isError || !analysis) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive/60" />
        <p className="mt-2 text-sm text-destructive">Analysis not found.</p>
      </div>
    );
  }

  const durationSec = analysis.duration_seconds;
  const mlResults: MLResult[] = analysis.result?.ml_results ?? [];

  // Aggregate across all ML results for display
  const allAnomalies = mlResults.flatMap((r) => r.anomalies ?? []);
  const allForecastPoints = mlResults.flatMap((r) => r.forecast_points ?? []);
  const primaryModel = mlResults[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {analysis.analysis_type.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-sm text-foreground leading-relaxed">
              {analysis.user_query || "Full automated pipeline"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {analysis.status === "running" && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
            {analysis.status === "completed" && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {analysis.status === "failed" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className={cn(
              "text-xs font-medium capitalize",
              analysis.status === "completed" ? "text-green-600 dark:text-green-400" :
              analysis.status === "failed" ? "text-red-600 dark:text-red-400" :
              analysis.status === "running" ? "text-blue-600 dark:text-blue-400" :
              "text-muted-foreground"
            )}>
              {analysis.status}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{new Date(analysis.created_at).toLocaleString()}</span>
          {durationSec !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(durationSec)}
            </span>
          )}
          {analysis.step_count > 0 && (
            <span>{analysis.step_count} agent steps</span>
          )}
        </div>
        {analysis.error_message && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {analysis.error_message}
          </p>
        )}
      </div>

      {/* Agent step trace */}
      {analysis.agent_steps.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-foreground">Agent Trace</h3>
          <div className="space-y-1">
            {analysis.agent_steps.map((step, i) => (
              <AgentStepTrace key={i} step={step} />
            ))}
          </div>
        </section>
      )}

      {/* ML results */}
      {analysis.result && (
        <>
          {/* Anomalies */}
          {allAnomalies.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">Detected Anomalies</h3>
              <div className="rounded-lg border border-border bg-card p-4 shadow-card">
                <AnomalyTimeline anomalies={allAnomalies} totalRows={1000} />
              </div>
            </section>
          )}

          {/* Forecast */}
          {allForecastPoints.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">Forecast</h3>
              <div className="rounded-lg border border-border bg-card p-4 shadow-card">
                <ForecastChart points={allForecastPoints} metric={primaryModel?.model_name ?? "value"} />
              </div>
            </section>
          )}

          {/* Feature importance */}
          {primaryModel?.feature_importance && Object.keys(primaryModel.feature_importance).length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">Feature Importance (SHAP)</h3>
              <div className="rounded-lg border border-border bg-card p-4 shadow-card">
                <FeatureImportanceChart importance={primaryModel.feature_importance} />
              </div>
            </section>
          )}

          {/* Model metrics */}
          {primaryModel?.metrics && Object.keys(primaryModel.metrics).length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">Model Metrics</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(primaryModel.metrics).map(([key, val]) => (
                  <div key={key} className="rounded-lg border border-border bg-card px-4 py-3 shadow-card">
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      {typeof val === "number" ? val.toFixed(4) : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Key findings */}
          {analysis.result.key_findings.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">Key Findings</h3>
              <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-card">
                <ul className="space-y-2">
                  {analysis.result.key_findings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Summary */}
          {analysis.result.summary && (
            <section>
              <h3 className="mb-3 text-sm font-medium text-foreground">Analysis Summary</h3>
              <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-card">
                <p className="text-sm leading-relaxed text-foreground/80">{analysis.result.summary}</p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
