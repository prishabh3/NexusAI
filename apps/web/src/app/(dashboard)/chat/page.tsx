"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { datasetsApi } from "@/lib/api/datasets";
import { AgentChat } from "@/features/chat/agent-chat";
import { DatasetSelector } from "@/features/chat/dataset-selector";
import { MessageSquare } from "lucide-react";

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
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Ask questions in plain English — the AI analyst uses SQL, statistics, and ML to answer.
        </p>
        <DatasetSelector datasets={ready} selectedId={selected} />
      </div>
      {selected ? (
        <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <AgentChat datasetId={selected} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No datasets available</p>
          <p className="text-xs text-muted-foreground">Upload a dataset first, then come back to query it.</p>
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
