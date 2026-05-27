"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Code2, Database, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/types/dataset";
import { SQLResultTable } from "./sql-result-table";

export function AgentStepTrace({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);
  const hasSqlResults = step.sql_executions?.some((e) => e.result_preview?.length > 0);

  return (
    <div className="rounded-md border border-border bg-card/50 text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <StepIcon toolName={step.tool_name} />
        <span className="font-medium text-foreground">
          Step {step.step_number + 1}: {step.tool_name ?? step.action}
        </span>
        {step.sql_executions?.[0] && (
          <span className="ml-auto text-muted-foreground/70">
            {step.sql_executions[0].row_count} rows · {step.sql_executions[0].execution_time_ms.toFixed(0)}ms
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5 space-y-3">
          {step.reasoning && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Reasoning</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{step.reasoning}</p>
            </div>
          )}

          {step.sql_executions?.map((exec, i) => (
            <div key={i}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                SQL Query {exec.error ? "(failed)" : `· ${exec.row_count} rows`}
              </p>
              <pre className="overflow-x-auto rounded bg-nexus-slate-950 p-2 text-[11px] text-nexus-slate-100 font-mono leading-relaxed">
                {exec.query}
              </pre>
              {exec.error && (
                <p className="mt-1 text-xs text-destructive">{exec.error}</p>
              )}
              {exec.result_preview?.length > 0 && (
                <div className="mt-2">
                  <SQLResultTable rows={exec.result_preview.slice(0, 10)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepIcon({ toolName }: { toolName: string | null }) {
  if (toolName === "execute_sql") return <Code2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
  if (toolName === "inspect_schema") return <Database className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />;
  if (toolName === "sample_data") return <Layers className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />;
  return <Code2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />;
}
