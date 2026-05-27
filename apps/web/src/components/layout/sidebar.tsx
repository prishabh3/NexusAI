"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Brain,
  Database,
  FlaskConical,
  LayoutDashboard,
  MessageSquare,
  Settings,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/",           icon: LayoutDashboard, label: "Overview" },
  { href: "/datasets",   icon: Database,         label: "Datasets" },
  { href: "/analysis",   icon: Brain,            label: "Analysis" },
  { href: "/chat",       icon: MessageSquare,    label: "Query" },
  { href: "/insights",   icon: Zap,              label: "Insights" },
  { href: "/forecasting",icon: TrendingUp,       label: "Forecasting" },
  { href: "/anomalies",  icon: FlaskConical,     label: "Anomalies" },
  { href: "/models",     icon: BarChart3,        label: "Models" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-52 flex-shrink-0 flex-col bg-[hsl(var(--sidebar))] border-r border-border">
      {/* Wordmark */}
      <div className="flex h-13 items-center gap-2.5 px-4 py-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary shadow-sm shadow-primary/30">
          <Brain className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">NexusAI</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 pt-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-100",
                active
                  ? "bg-background text-foreground shadow-sm shadow-black/5"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "h-[15px] w-[15px] flex-shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-100",
            pathname === "/settings"
              ? "bg-background text-foreground shadow-sm shadow-black/5"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          )}
        >
          <Settings className="h-[15px] w-[15px]" />
          Settings
        </Link>
        <div className="mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            R
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-medium text-foreground">Rishabh</span>
            <span className="text-[11px] text-muted-foreground">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
