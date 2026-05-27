import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  formatDuration,
  truncate,
  cn,
} from "@/lib/utils";

describe("formatBytes", () => {
  it("formats 0 as '0 B'", () => expect(formatBytes(0)).toBe("0 B"));
  it("formats 1024 as '1.0 KB'", () => expect(formatBytes(1024)).toBe("1.0 KB"));
  it("formats 1048576 as '1.0 MB'", () => expect(formatBytes(1048576)).toBe("1.0 MB"));
  it("formats 1073741824 as '1.0 GB'", () => expect(formatBytes(1073741824)).toBe("1.0 GB"));
});

describe("formatNumber", () => {
  it("returns plain number for <1000", () => expect(formatNumber(999)).toBe("999"));
  it("formats thousands as K", () => expect(formatNumber(1500)).toBe("1.5K"));
  it("formats millions as M", () => expect(formatNumber(1_500_000)).toBe("1.5M"));
});

describe("formatPercent", () => {
  it("formats 0 as 0.0%", () => expect(formatPercent(0)).toBe("0.0%"));
  it("formats 0.5 as 50.0%", () => expect(formatPercent(0.5)).toBe("50.0%"));
  it("formats 1 as 100.0%", () => expect(formatPercent(1)).toBe("100.0%"));
});

describe("formatDuration", () => {
  it("formats sub-second as ms", () => {
    const result = formatDuration(0.5);
    expect(result).toMatch(/ms/);
  });
  it("formats seconds", () => {
    const result = formatDuration(45);
    expect(result).toMatch(/s/);
  });
  it("formats minutes", () => {
    const result = formatDuration(130);
    expect(result).toMatch(/m/);
  });
});

describe("truncate", () => {
  it("returns string unchanged if shorter than max", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates and adds ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("deduplicates tailwind classes", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });
  it("handles conditional classes", () => {
    const result = cn("base", false && "excluded", "included");
    expect(result).toContain("included");
    expect(result).not.toContain("excluded");
  });
});
