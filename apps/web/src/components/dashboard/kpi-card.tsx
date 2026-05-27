import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  trend: "up" | "down" | "neutral" | null;
  delta?: string;
  color?: "blue" | "green" | "orange" | "purple";
}

const ACCENT: Record<string, string> = {
  blue:   "border-t-blue-500",
  green:  "border-t-emerald-500",
  orange: "border-t-orange-500",
  purple: "border-t-violet-500",
};

const ICON_COLOR: Record<string, string> = {
  blue:   "text-blue-500",
  green:  "text-emerald-500",
  orange: "text-orange-500",
  purple: "text-violet-500",
};

export function KpiCard({ title, value, subtitle, icon: Icon, trend, delta, color = "blue" }: KpiCardProps) {
  return (
    <div className={cn(
      "rounded-xl border-t-2 bg-card p-5 shadow-card hover:shadow-card-hover transition-shadow",
      ACCENT[color]
    )}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
        <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", ICON_COLOR[color])} />
      </div>
      <p className="mt-3 text-[28px] font-bold tracking-tight tabular-nums text-foreground leading-none">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {trend && delta && (
          <span className={cn(
            "flex items-center gap-0.5 text-[11px] font-semibold",
            trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          )}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
