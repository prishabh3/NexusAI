"use client";

import { Brain, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Analysis } from "@/types/dataset";
import { cn, formatRelativeTime } from "@/lib/utils";

export function ActivityTimeline({ analyses }: { analyses: Analysis[] }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Activity</h3>
      </div>
      <div className="px-4 py-3">
        {analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-4">
            {analyses.slice(0, 12).map((analysis) => (
              <li key={analysis.id} className="relative">
                <span className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-border">
                  {analysis.status === "completed" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : analysis.status === "failed" ? (
                    <XCircle className="h-3 w-3 text-red-500" />
                  ) : analysis.status === "running" ? (
                    <Brain className="h-3 w-3 text-blue-500 animate-pulse" />
                  ) : (
                    <Clock className="h-3 w-3 text-yellow-500" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-medium text-foreground line-clamp-1">
                    {analysis.user_query ?? analysis.analysis_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(analysis.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
