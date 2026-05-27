import { Suspense } from "react";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Overview — NexusAI" };

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Monitor datasets, recent analyses, and key insights."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverview />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-lg skeleton" />
      ))}
    </div>
  );
}
