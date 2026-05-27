import { Suspense } from "react";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

export const metadata = { title: "Overview — NexusAI" };

export default function OverviewPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardOverview />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-lg skeleton" />
      ))}
    </div>
  );
}
