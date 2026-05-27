import { Suspense } from "react";
import { ForecastingView } from "@/features/forecasting/forecasting-view";

export const metadata = { title: "Forecasting — NexusAI" };

export default function ForecastingPage() {
  return (
    <Suspense fallback={<ForecastSkeleton />}>
      <ForecastingView />
    </Suspense>
  );
}

function ForecastSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 w-72 rounded-lg skeleton" />
      <div className="h-80 rounded-lg skeleton" />
    </div>
  );
}
