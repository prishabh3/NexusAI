"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, File, Loader2, Upload, X } from "lucide-react";
import { datasetsApi } from "@/lib/api/datasets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatBytes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_TYPES = {
  "text/csv": [".csv"],
  "application/octet-stream": [".parquet"],
  "application/json": [".json", ".jsonl"],
};

interface UploadState {
  file: File | null;
  name: string;
  description: string;
  tags: string;
}

export function DatasetUploader({ onSuccess }: { onSuccess?: (id: string) => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [state, setState] = useState<UploadState>({
    file: null,
    name: "",
    description: "",
    tags: "",
  });

  const mutation = useMutation({
    mutationFn: datasetsApi.upload,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast({ title: "Dataset uploaded", description: `${data.name} is ready for analysis.` });
      onSuccess?.(data.id);
      router.push(`/datasets/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const inferredName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setState((s) => ({ ...s, file, name: s.name || inferredName }));
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500 MB
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.file || !state.name.trim()) return;
    mutation.mutate({
      file: state.file,
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      tags: state.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
  };

  const isSubmitting = mutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
          isDragActive && !isDragReject ? "border-primary bg-primary/5" : "border-border",
          isDragReject ? "border-destructive bg-destructive/5" : "",
          state.file ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "hover:border-muted-foreground/40",
          isSubmitting ? "pointer-events-none opacity-60" : ""
        )}
      >
        <input {...getInputProps()} />
        <AnimatePresence mode="wait">
          {state.file ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <File className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{state.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(state.file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setState((s) => ({ ...s, file: null }));
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? "Drop it here" : "Drag & drop or click to upload"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">CSV, Parquet, JSON — up to 500 MB</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Metadata fields */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Dataset name <span className="text-destructive">*</span></Label>
          <Input
            id="name"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Q4 Sales Data"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            placeholder="Optional — describe the data source, date range, business context..."
            className="mt-1 resize-none"
            rows={2}
          />
        </div>
        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={state.tags}
            onChange={(e) => setState((s) => ({ ...s, tags: e.target.value }))}
            placeholder="sales, q4, revenue (comma-separated)"
            className="mt-1"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={!state.file || !state.name.trim() || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading & profiling...
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Upload Dataset
          </>
        )}
      </Button>
    </form>
  );
}
