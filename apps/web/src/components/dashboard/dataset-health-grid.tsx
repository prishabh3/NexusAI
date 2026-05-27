"use client";

import Link from "next/link";
import { ArrowRight, UploadCloud } from "lucide-react";
import type { Dataset } from "@/types/dataset";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";

const FORMAT_COLOR: Record<string, string> = {
  csv:     "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  parquet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  json:    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  jsonl:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function QualityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-[10px] font-semibold tabular-nums w-7 text-right",
        pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-amber-500" : "text-red-500"
      )}>
        {pct}%
      </span>
    </div>
  );
}

export function DatasetHealthGrid({ datasets }: { datasets: Dataset[] }) {
  if (datasets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-8 py-12 text-center">
        <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-foreground">No datasets yet</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
          Upload a CSV, Parquet, or JSON file to begin.
        </p>
        <Link
          href="/datasets"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Upload dataset <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-[13px] font-semibold text-foreground">
          Datasets
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">{datasets.length} ready</span>
        </p>
        <Link href="/datasets" className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>
      <div className="divide-y divide-border">
        {datasets.slice(0, 5).map((d) => (
          <Link
            key={d.id}
            href={`/datasets/${d.id}`}
            className="group flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
                  {d.name}
                </p>
                {d.file_format && (
                  <span className={cn(
                    "flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                    FORMAT_COLOR[d.file_format] ?? "bg-muted text-muted-foreground"
                  )}>
                    {d.file_format}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatNumber(d.row_count ?? 0)} rows · {d.column_count ?? 0} cols · {formatRelativeTime(d.updated_at)}
              </p>
              {d.data_quality_score != null && <QualityBar score={d.data_quality_score} />}
            </div>
          </Link>
        ))}
      </div>
      {datasets.length > 5 && (
        <div className="border-t border-border px-5 py-2.5 text-center">
          <Link href="/datasets" className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            +{datasets.length - 5} more
          </Link>
        </div>
      )}
    </div>
  );
}
