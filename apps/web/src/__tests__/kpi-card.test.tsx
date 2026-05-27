import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Database } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";

describe("KpiCard", () => {
  it("renders title and value", () => {
    render(
      <KpiCard
        title="Datasets"
        value="42"
        subtitle="total"
        icon={Database}
        trend={null}
      />
    );
    expect(screen.getByText("Datasets")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("total")).toBeInTheDocument();
  });

  it("renders delta with trend up", () => {
    render(
      <KpiCard
        title="Revenue"
        value="$1.2M"
        subtitle="this month"
        icon={Database}
        trend="up"
        delta="+12% vs last month"
      />
    );
    expect(screen.getByText("+12% vs last month")).toBeInTheDocument();
  });

  it("does not render delta when not provided", () => {
    render(
      <KpiCard
        title="Test"
        value="0"
        subtitle="sub"
        icon={Database}
        trend={null}
      />
    );
    expect(screen.queryByText(/vs/)).not.toBeInTheDocument();
  });
});
