"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, MoreHorizontal, Trash2 } from "lucide-react";
import { datasetsApi } from "@/lib/api/datasets";
import { cn, formatBytes, formatNumber, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Dataset } from "@/types/dataset";

const STATUS_BADGE: Record<Dataset["status"], { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  processing: { label: "Processing", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  uploading: { label: "Uploading", className: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
};

export function DatasetListView() {
  const queryClient = useQueryClient();
  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetsApi.list({ limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => datasetsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["datasets"] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg skeleton" />
        ))}
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 text-center">
        <Database className="h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm font-medium text-foreground">No datasets uploaded yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Upload a CSV, Parquet, or JSON file to begin analysis.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] items-center gap-4 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>Name</span>
        <span>Size</span>
        <span>Quality</span>
        <span>Updated</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {datasets.map((dataset) => {
          const badge = STATUS_BADGE[dataset.status];
          const quality = dataset.data_quality_score;
          return (
            <div
              key={dataset.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <Link href={`/datasets/${dataset.id}`} className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-muted">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{dataset.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase">{dataset.file_format}</span>
                    {dataset.row_count != null && (
                      <span className="text-xs text-muted-foreground">{formatNumber(dataset.row_count)} rows</span>
                    )}
                  </div>
                </div>
              </Link>

              <span className="text-sm text-muted-foreground">
                {dataset.column_count != null ? `${dataset.column_count} cols` : "—"}
              </span>

              <div>
                {quality != null ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          quality >= 0.8 ? "bg-green-500" : quality >= 0.6 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${quality * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(quality * 100)}%</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              <span className="text-sm text-muted-foreground">{formatRelativeTime(dataset.updated_at)}</span>

              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/datasets/${dataset.id}`}>View details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/chat?dataset=${dataset.id}`}>Run query</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete "${dataset.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(dataset.id);
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
