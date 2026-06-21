import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentFeed } from "@/components/AgentFeed";
import { reduceAll, initialViewModel } from "@/lib/viewModel";
import { PARAMETRIC_SCRIPT } from "@/lib/mockStream";

describe("AgentFeed", () => {
  it("renders ported feed rows from a reduced parametric run", () => {
    const vm = reduceAll(initialViewModel, PARAMETRIC_SCRIPT.map((s) => s.event));
    render(<AgentFeed rows={vm.rows} engine="openscad" onPickEngine={() => {}} cleanInBlender={false} onToggleClean={() => {}} miniFrame={0} />);
    expect(screen.getByText("write_openscad")).toBeInTheDocument();
    expect(screen.getByText("cable slot intersects riser wall")).toBeInTheDocument();
    // the engine selector now exposes all four engines + Auto
    expect(screen.getByText("Quick Shape")).toBeInTheDocument();
    expect(screen.getByText("Pro Mechanical")).toBeInTheDocument();
    expect(screen.getByText("Premium 3D")).toBeInTheDocument();
    expect(screen.getByText("Auto")).toBeInTheDocument();
  });
});
