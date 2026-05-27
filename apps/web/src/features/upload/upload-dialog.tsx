"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DatasetUploader } from "./dataset-uploader";

export function UploadDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Upload Dataset</DialogTitle>
          <DialogDescription>
            Upload a CSV, Parquet, or JSON file. NexusAI will automatically profile your data and
            make it available for analysis.
          </DialogDescription>
        </DialogHeader>
        <DatasetUploader onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
