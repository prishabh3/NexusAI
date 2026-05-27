import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { InsightsView } from "@/features/insights/insights-view";

export const metadata = { title: "Insights — NexusAI" };

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="AI-generated business insights with statistical evidence and recommended actions."
      />
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsView />
      </Suspense>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-lg skeleton" />
      ))}
    </div>
  );
}
