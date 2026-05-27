"use client";

import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Insight } from "@/types/dataset";
import { cn, SEVERITY_BG_COLORS } from "@/lib/utils";

const CATEGORY_LABELS: Record<Insight["category"], string> = {
  anomaly: "Anomaly",
  trend: "Trend",
  correlation: "Correlation",
  forecast: "Forecast",
  recommendation: "Recommendation",
  data_quality: "Data Quality",
  business: "Business",
  statistical: "Statistical",
};

export function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "rounded-lg border bg-card shadow-card transition-colors",
      insight.severity === "critical" ? "border-red-200 dark:border-red-900/50" :
      insight.severity === "warning" ? "border-yellow-200 dark:border-yellow-900/50" :
      insight.severity === "opportunity" ? "border-purple-200 dark:border-purple-900/50" :
      "border-border"
    )}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                SEVERITY_BG_COLORS[insight.severity]
              )}>
                {insight.severity}
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted rounded-sm px-1.5 py-0.5">
                {CATEGORY_LABELS[insight.category]}
              </span>
              {insight.is_verified && (
                <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
            <h4 className="mt-1.5 text-sm font-medium text-foreground leading-snug">{insight.title}</h4>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-xs font-medium text-muted-foreground">
              {Math.round(insight.confidence_score * 100)}%
            </span>
            <p className="text-[10px] text-muted-foreground/60">confidence</p>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {expanded ? "Less" : "More detail"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-xs text-foreground/80 leading-relaxed">{insight.body}</p>

          {insight.business_impact && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Business Impact</p>
              <p className="text-xs text-foreground/70">{insight.business_impact}</p>
            </div>
          )}

          {insight.recommended_actions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Recommended Actions</p>
              <ul className="space-y-1">
                {insight.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.affected_columns.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {insight.affected_columns.map((col) => (
                <span key={col} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {col}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
