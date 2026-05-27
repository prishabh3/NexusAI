"use client";

import { cn } from "@/lib/utils";

export function SQLResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {columns.map((col) => (
              <th key={col} className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-1.5 text-foreground/80 whitespace-nowrap font-mono">
                  {String(row[col] ?? "null")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
