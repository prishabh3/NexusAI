import { Suspense } from "react";
import { DatasetDetailView } from "@/features/upload/dataset-detail-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DatasetPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-96 rounded-lg skeleton" />}>
      <DatasetDetailView datasetId={id} />
    </Suspense>
  );
}
