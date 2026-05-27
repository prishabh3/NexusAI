"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ActivitySquare,
  AlertTriangle,
  Database,
  Lightbulb,
} from "lucide-react";
import { datasetsApi, analysesApi } from "@/lib/api/datasets";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RecentAnalysesList } from "@/components/dashboard/recent-analyses-list";
import { DatasetHealthGrid } from "@/components/dashboard/dataset-health-grid";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { formatNumber } from "@/lib/utils";

export function DashboardOverview() {
  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetsApi.list({ limit: 50 }),
  });

  const { data: recentAnalyses = [] } = useQuery({
    queryKey: ["analyses", "recent"],
    queryFn: () => analysesApi.recent(10),
  });

  const readyDatasets = datasets.filter((d) => d.status === "ready");
  const totalRows = readyDatasets.reduce((s, d) => s + (d.row_count ?? 0), 0);
  const completedAnalyses = recentAnalyses.filter((a: { status: string }) => a.status === "completed");
  const avgQuality =
    readyDatasets.length > 0
      ? readyDatasets.reduce((s, d) => s + (d.data_quality_score ?? 0), 0) / readyDatasets.length
      : 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          title="Datasets"
          value={formatNumber(readyDatasets.length)}
          subtitle={`${datasets.length} total`}
          icon={Database}
          trend={null}
        />
        <KpiCard
          title="Total Rows"
          value={formatNumber(totalRows)}
          subtitle="across all datasets"
          icon={ActivitySquare}
          trend={null}
        />
        <KpiCard
          title="Analyses Run"
          value={formatNumber(recentAnalyses.length)}
          subtitle={`${completedAnalyses.length} completed`}
          icon={Lightbulb}
          trend={null}
        />
        <KpiCard
          title="Avg. Quality"
          value={`${(avgQuality * 100).toFixed(0)}%`}
          subtitle="data quality score"
          icon={AlertTriangle}
          trend={avgQuality > 0.8 ? "up" : avgQuality > 0.6 ? "neutral" : "down"}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <DatasetHealthGrid datasets={readyDatasets} />
          <RecentAnalysesList analyses={recentAnalyses} />
        </div>
        <div className="col-span-1">
          <ActivityTimeline analyses={recentAnalyses} />
        </div>
      </div>
    </div>
  );
}
