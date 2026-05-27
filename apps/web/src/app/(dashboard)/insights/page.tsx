import { Suspense } from "react";
import { InsightsView } from "@/features/insights/insights-view";

export const metadata = { title: "Insights — NexusAI" };

export default function InsightsPage() {
  return (
    <Suspense fallback={<InsightsSkeleton />}>
      <InsightsView />
    </Suspense>
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
