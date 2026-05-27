import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnalysisDetailView } from "@/features/analysis/analysis-detail-view";

export const metadata = { title: "Analysis Detail — NexusAI" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnalysisDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analysis Detail"
        description="Step-by-step agent trace, SQL executions, and ML results."
        backHref="/analysis"
        backLabel="All Analyses"
      />
      <Suspense fallback={<DetailSkeleton />}>
        <AnalysisDetailView analysisId={id} />
      </Suspense>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 rounded-lg skeleton" />
      <div className="h-64 rounded-lg skeleton" />
    </div>
  );
}
