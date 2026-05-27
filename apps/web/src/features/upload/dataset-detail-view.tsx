"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Brain, ChevronRight, Database, MessageSquare, TrendingUp, Zap } from "lucide-react";
import { datasetsApi, insightsApi } from "@/lib/api/datasets";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaTable } from "./schema-table";
import { CorrelationHeatmap } from "@/features/analysis/correlation-heatmap";
import { InsightCard } from "@/features/insights/insight-card";
import { formatBytes, formatNumber, formatRelativeTime } from "@/lib/utils";

export function DatasetDetailView({ datasetId }: { datasetId: string }) {
  const { data: dataset, isLoading } = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => datasetsApi.get(datasetId),
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["insights", datasetId],
    queryFn: () => insightsApi.listForDataset(datasetId, { limit: 20 }),
    enabled: !!dataset,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-1/3 rounded-lg skeleton" />
        <div className="h-64 rounded-lg skeleton" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Dataset not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/datasets" className="hover:text-foreground transition-colors">Datasets</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{dataset.name}</span>
      </div>

      <PageHeader
        title={dataset.name}
        description={dataset.description ?? `${dataset.file_format.toUpperCase()} · ${formatRelativeTime(dataset.updated_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/chat?dataset=${dataset.id}`}>
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Query
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/analysis?dataset=${dataset.id}`}>
                <Brain className="mr-1.5 h-4 w-4" />
                Run Analysis
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Rows", value: formatNumber(dataset.row_count ?? 0) },
          { label: "Columns", value: dataset.column_count ?? 0 },
          { label: "File Size", value: formatBytes(dataset.schema?.size_bytes ?? 0) },
          {
            label: "Data Quality",
            value: dataset.data_quality_score != null
              ? `${Math.round(dataset.data_quality_score * 100)}%`
              : "N/A",
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="schema">
        <TabsList>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="correlations">Correlations</TabsTrigger>
          <TabsTrigger value="insights">
            Insights {insights.length > 0 && `(${insights.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schema" className="mt-4">
          {dataset.schema ? (
            <SchemaTable columns={dataset.schema.columns} />
          ) : (
            <p className="text-sm text-muted-foreground">Schema not yet available.</p>
          )}
        </TabsContent>

        <TabsContent value="correlations" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <h3 className="mb-4 text-sm font-medium text-foreground">Correlation Matrix</h3>
            {dataset.schema?.correlation_matrix && Object.keys(dataset.schema.correlation_matrix).length > 0 ? (
              <CorrelationHeatmap matrix={dataset.schema.correlation_matrix} />
            ) : (
              <p className="text-sm text-muted-foreground">No numeric columns for correlation analysis.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">No insights generated yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">Run an analysis to generate AI-powered insights.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
