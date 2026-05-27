"use client";

import { useState } from "react";
import { ArrowUpDown, Info } from "lucide-react";
import type { ColumnProfile, ColumnType } from "@/types/dataset";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

const TYPE_COLORS: Record<ColumnType, string> = {
  integer: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400",
  float: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400",
  string: "text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400",
  boolean: "text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400",
  datetime: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400",
  date: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400",
  unknown: "text-muted-foreground bg-muted",
};

export function SchemaTable({ columns }: { columns: ColumnProfile[] }) {
  const [sortField, setSortField] = useState<"name" | "null_pct" | "cardinality">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...columns].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left">
              <button
                onClick={() => toggleSort("name")}
                className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Column <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</th>
            <th className="px-4 py-2.5 text-right">
              <button
                onClick={() => toggleSort("null_pct")}
                className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ml-auto"
              >
                Nulls <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-2.5 text-right">
              <button
                onClick={() => toggleSort("cardinality")}
                className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ml-auto"
              >
                Cardinality <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Range</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Sample Values</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((col) => (
            <tr key={col.name} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 font-mono text-sm font-medium text-foreground">{col.name}</td>
              <td className="px-4 py-2.5">
                <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", TYPE_COLORS[col.dtype])}>
                  {col.dtype}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">
                <span className={col.null_pct > 0.2 ? "text-red-500" : ""}>
                  {formatPercent(col.null_pct)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">
                {formatNumber(col.unique_count)}
              </td>
              <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-xs">
                {col.min_value != null && col.max_value != null
                  ? `${col.min_value} – ${col.max_value}`
                  : "—"}
              </td>
              <td className="px-4 py-2.5 max-w-[200px]">
                <div className="flex flex-wrap gap-1">
                  {col.sample_values.slice(0, 4).map((v, i) => (
                    <span key={i} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate max-w-[60px]">
                      {String(v)}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
