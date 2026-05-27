"use client";

import Link from "next/link";
import { Database, ChevronRight } from "lucide-react";
import type { Dataset } from "@/types/dataset";
import { cn, formatBytes, formatNumber, formatRelativeTime } from "@/lib/utils";

interface DatasetHealthGridProps {
  datasets: Dataset[];
}

function QualityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function DatasetHealthGrid({ datasets }: DatasetHealthGridProps) {
  if (datasets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Database className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">No datasets yet. Upload one to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Dataset Health</h3>
        <Link href="/datasets" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all <ChevronRight className="inline h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {datasets.slice(0, 5).map((dataset) => (
          <Link
            key={dataset.id}
            href={`/datasets/${dataset.id}`}
            className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-muted">
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium text-foreground">{dataset.name}</p>
                <span className="ml-2 flex-shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(dataset.updated_at)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{formatNumber(dataset.row_count ?? 0)} rows</span>
                <span>·</span>
                <span>{dataset.column_count ?? 0} cols</span>
                <span>·</span>
                <span className="uppercase">{dataset.file_format}</span>
              </div>
              {dataset.data_quality_score != null && (
                <div className="mt-1.5">
                  <QualityBar score={dataset.data_quality_score} />
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
