import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ForecastingView } from "@/features/forecasting/forecasting-view";

export const metadata = { title: "Forecasting — NexusAI" };

export default function ForecastingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecasting"
        description="Time-series forecasts powered by Prophet and XGBoost with confidence intervals."
      />
      <Suspense fallback={<ForecastSkeleton />}>
        <ForecastingView />
      </Suspense>
    </div>
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
