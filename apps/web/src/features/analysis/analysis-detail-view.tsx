"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { analysesApi } from "@/lib/api/analyses";
import { datasetsApi } from "@/lib/api/datasets";
import { AgentStepTrace } from "@/features/chat/agent-step-trace";
import { AnomalyTimeline } from "@/features/anomaly/anomaly-timeline";
import { ForecastChart } from "@/features/forecasting/forecast-chart";
import { FeatureImportanceChart } from "@/features/analysis/feature-importance-chart";
import { cn, formatDuration } from "@/lib/utils";
import type { AnalysisDetail, MLResult } from "@/types/dataset";

interface Props {
  analysisId: string;
}

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Completed" },
  running:   { icon: Loader2,      color: "text-blue-500",    label: "Running",   spin: true },
  failed:    { icon: AlertCircle,  color: "text-red-500",     label: "Failed" },
  queued:    { icon: Clock,        color: "text-amber-500",   label: "Queued" },
} as const;

export function AnalysisDetailView({ analysisId }: Props) {
  const { data: analysis, isLoading, isError } = useQuery<AnalysisDetail>({
    queryKey: ["analyses", analysisId],
    queryFn: () => analysesApi.getById(analysisId),
    staleTime: 30_000,
  });

  const { data: dataset } = useQuery({
    queryKey: ["datasets", analysis?.dataset_id],
    queryFn: () => datasetsApi.get(analysis!.dataset_id),
    enabled: !!analysis?.dataset_id,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  if (isError || !analysis) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
        <AlertCircle className="mx-auto h-7 w-7 text-destructive/50" />
        <p className="mt-2 text-sm text-destructive/80">Analysis not found.</p>
      </div>
    );
  }

  const mlResults: MLResult[] = analysis.result?.ml_results ?? [];
  const allAnomalies = mlResults.flatMap((r) => r.anomalies ?? []);
  const allForecastPoints = mlResults.flatMap((r) => r.forecast_points ?? []);
  const primaryModel = mlResults[0] ?? null;

  const statusCfg = STATUS_CONFIG[analysis.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.queued;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {analysis.analysis_type.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground leading-relaxed">
              {analysis.user_query || "Automated pipeline"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatusIcon
              className={cn("h-3.5 w-3.5", statusCfg.color, "spin" in statusCfg && "animate-spin")}
            />
            <span className={cn("text-[12px] font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{new Date(analysis.created_at).toLocaleString()}</span>
          {analysis.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(analysis.duration_seconds)}
            </span>
          )}
          {analysis.step_count > 0 && <span>{analysis.step_count} agent steps</span>}
        </div>
        {analysis.error_message && (
          <p className="mt-3 rounded-md bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {analysis.error_message}
          </p>
        )}
      </div>

      {/* Agent trace */}
      {(analysis.agent_steps?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Agent Trace
          </p>
          <div className="space-y-1">
            {analysis.agent_steps.map((step, i) => (
              <AgentStepTrace key={i} step={step} />
            ))}
          </div>
        </div>
      )}

      {analysis.result && (
        <div className="space-y-5">
          {/* Summary — most important, put first */}
          {analysis.result.summary && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Summary</p>
              <p className="text-[13.5px] leading-relaxed text-foreground/85">{analysis.result.summary}</p>
            </div>
          )}

          {/* Key findings */}
          {analysis.result.key_findings.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Key Findings</p>
              <ul className="space-y-2.5">
                {analysis.result.key_findings.map((finding, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/80">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Model metrics */}
          {primaryModel?.metrics && Object.keys(primaryModel.metrics).length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Model Metrics
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(primaryModel.metrics).map(([key, val]) => (
                  <div key={key} className="rounded-lg border border-border bg-card px-4 py-3">
                    <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                      {typeof val === "number" ? val.toFixed(4) : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {allAnomalies.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Detected Anomalies
              </p>
              <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                <AnomalyTimeline
                  anomalies={allAnomalies}
                  totalRows={dataset?.row_count ?? (allAnomalies.length > 0 ? Math.max(...allAnomalies.map(a => a.row_index)) + 1 : 1)}
                />
              </div>
            </div>
          )}

          {/* Forecast */}
          {allForecastPoints.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Forecast
              </p>
              <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                <ForecastChart points={allForecastPoints} metric={primaryModel?.model_name ?? "value"} />
              </div>
            </div>
          )}

          {/* Feature importance */}
          {primaryModel?.feature_importance && Object.keys(primaryModel.feature_importance).length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Feature Importance
              </p>
              <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                <FeatureImportanceChart importance={primaryModel.feature_importance} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
