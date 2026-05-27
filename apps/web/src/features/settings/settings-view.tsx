"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { systemApi } from "@/lib/api/system";

interface SettingSection {
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SettingSection) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const [model, setModel] = useState("qwen2.5:14b");
  const [maxIterations, setMaxIterations] = useState(15);
  const [temperature, setTemperature] = useState(0.1);
  const [rowLimit, setRowLimit] = useState(10000);

  const { data: health } = useQuery({
    queryKey: ["system", "health"],
    queryFn: () => systemApi.health(),
    staleTime: 15_000,
    retry: false,
  });

  const MODEL_OPTIONS = [
    "qwen2.5:7b",
    "qwen2.5:14b",
    "deepseek-r1:14b",
    "llama3.1:8b",
  ];

  return (
    <div className="max-w-2xl space-y-5">
      {/* System status */}
      <Section title="System Status" description="Live connectivity to backend services.">
        <div className="space-y-2">
          {[
            { label: "API", ok: !!health },
            { label: "Ollama", ok: health?.ollama === "ok" },
            { label: "Database", ok: health?.database === "ok" },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{label}</span>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
                {ok ? "Connected" : "Disconnected"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* AI Model */}
      <Section title="AI Model" description="Configure the Ollama model used for agentic analysis.">
        <FieldRow label="Default Model" hint="Used for SQL generation and insight synthesis.">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Max Iterations" hint="Maximum agentic loop steps before forcing completion.">
          <input
            type="number"
            min={5}
            max={30}
            value={maxIterations}
            onChange={(e) => setMaxIterations(Number(e.target.value))}
            className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </FieldRow>
        <FieldRow label="Temperature" hint="Lower = more deterministic SQL generation (recommended: 0.1).">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </FieldRow>
      </Section>

      {/* Query Engine */}
      <Section title="Query Engine" description="DuckDB query execution settings.">
        <FieldRow label="Row Limit" hint="Maximum rows returned per SQL query to prevent memory issues.">
          <input
            type="number"
            min={100}
            max={100000}
            step={1000}
            value={rowLimit}
            onChange={(e) => setRowLimit(Number(e.target.value))}
            className="w-28 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </FieldRow>
      </Section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => {/* Settings are persisted server-side in a future release */}}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
