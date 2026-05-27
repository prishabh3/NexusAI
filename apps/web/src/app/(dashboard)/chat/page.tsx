"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { datasetsApi } from "@/lib/api/datasets";
import { AgentChat } from "@/features/chat/agent-chat";
import { PageHeader } from "@/components/layout/page-header";
import { DatasetSelector } from "@/features/chat/dataset-selector";

function ChatContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset");

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetsApi.list({ limit: 50 }),
  });

  const ready = datasets.filter((d) => d.status === "ready");
  const selected = datasetId ?? ready[0]?.id ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Query"
          description="Ask natural language questions — the AI analyst will investigate with SQL and ML."
        />
        <DatasetSelector datasets={ready} selectedId={selected} />
      </div>
      {selected ? (
        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <AgentChat datasetId={selected} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No datasets available. Upload a dataset to begin.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
