"use client";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(({ id, title, description, variant }) => (
        <div
          key={id}
          className={cn(
            "w-80 rounded-lg border p-4 shadow-elevated animate-slide-up",
            variant === "destructive"
              ? "border-destructive/50 bg-destructive text-destructive-foreground"
              : "border-border bg-card text-card-foreground"
          )}
        >
          {title && <p className="text-sm font-medium">{title}</p>}
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
      ))}
    </div>
  );
}
