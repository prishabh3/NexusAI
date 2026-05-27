import { Suspense } from "react";
import { AnalysisListView } from "@/features/analysis/analysis-list-view";

export const metadata = { title: "Analysis — NexusAI" };

export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisListSkeleton />}>
      <AnalysisListView />
    </Suspense>
  );
}

function AnalysisListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg skeleton" />
      ))}
    </div>
  );
}
