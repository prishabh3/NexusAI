import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnalysisListView } from "@/features/analysis/analysis-list-view";

export const metadata = { title: "Analysis — NexusAI" };

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analysis"
        description="View and manage all AI-powered analyses across your datasets."
      />
      <Suspense fallback={<AnalysisListSkeleton />}>
        <AnalysisListView />
      </Suspense>
    </div>
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
