import { Suspense } from "react";
import { AnomaliesView } from "@/features/anomaly/anomalies-view";

export const metadata = { title: "Anomalies — NexusAI" };

export default function AnomaliesPage() {
  return (
    <Suspense fallback={<AnomalySkeleton />}>
      <AnomaliesView />
    </Suspense>
  );
}

function AnomalySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg skeleton" />
        ))}
      </div>
      <div className="h-64 rounded-lg skeleton" />
    </div>
  );
}
