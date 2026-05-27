import { Suspense } from "react";
import { ModelsView } from "@/features/analysis/models-view";

export const metadata = { title: "Models — NexusAI" };

export default function ModelsPage() {
  return (
    <Suspense fallback={<ModelsSkeleton />}>
      <ModelsView />
    </Suspense>
  );
}

function ModelsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg skeleton" />
      ))}
    </div>
  );
}
