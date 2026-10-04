import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "#/i18n/config";
import { useWizardStore } from "#/stores";
import ResultActionBar from "../index";

describe("ResultActionBar", () => {
  // Debt #8: "Save report" never did anything — a result is already stored
  // the moment it lands. The bar keeps only the action that works.
  it("offers Start over only — no inert Save report button", () => {
    render(<ResultActionBar />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /save report/i })).toBeNull();
  });

  it("Start over is touch-sized, full width below md, and resets the wizard", () => {
    useWizardStore.setState({ step: 4, runId: "run-1" });
    render(<ResultActionBar />);

    const startOver = screen.getByRole("button", { name: "Start over" });
    expect(startOver.className).toContain("!h-11");
    expect(startOver.className).toContain("max-md:w-full");

    fireEvent.click(startOver);
    expect(useWizardStore.getState().step).toBe(1);
    expect(useWizardStore.getState().runId).toBeNull();
  });
});
