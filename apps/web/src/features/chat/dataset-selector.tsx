"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Database } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dataset } from "@/types/dataset";

export function DatasetSelector({
  datasets,
  selectedId,
}: {
  datasets: Dataset[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("dataset", value);
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <Select value={selectedId ?? undefined} onValueChange={handleChange}>
      <SelectTrigger className="w-56">
        <Database className="mr-2 h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Select dataset" />
      </SelectTrigger>
      <SelectContent>
        {datasets.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
