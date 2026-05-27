"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/":            { title: "Overview" },
  "/datasets":    { title: "Datasets" },
  "/analysis":    { title: "Analysis" },
  "/chat":        { title: "Query" },
  "/insights":    { title: "Insights" },
  "/forecasting": { title: "Forecasting" },
  "/anomalies":   { title: "Anomalies" },
  "/models":      { title: "Models" },
  "/settings":    { title: "Settings" },
};

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  const segment = "/" + pathname.split("/")[1];
  const meta = PAGE_META[segment] ?? PAGE_META["/"]!;

  return (
    <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <h1 className="text-sm font-semibold text-foreground">{meta.title}</h1>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-md"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
    </header>
  );
}
