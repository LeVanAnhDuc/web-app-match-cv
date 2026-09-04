import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import Stepper from "../index";

describe("Stepper", () => {
  it("renders all 4 wizard steps with their labels", () => {
    render(<Stepper current={1} blockedFrom={5} onJump={vi.fn()} />);

    expect(screen.getByText(/job description/i)).toBeDefined();
    expect(screen.getByText(/cv \/ resume/i)).toBeDefined();
    expect(screen.getByText(/review/i)).toBeDefined();
    expect(screen.getByText(/result/i)).toBeDefined();
  });

  it('marks the current step active via aria-current="step"', () => {
    render(<Stepper current={2} blockedFrom={5} onJump={vi.fn()} />);

    const activeDot = screen.getByTestId("stepper-step-2");
    expect(activeDot.getAttribute("aria-current")).toBe("step");

    const idleDot = screen.getByTestId("stepper-step-1");
    expect(idleDot.getAttribute("aria-current")).toBeNull();
  });

  it("marks steps before current as done", () => {
    render(<Stepper current={3} blockedFrom={5} onJump={vi.fn()} />);

    const doneDot = screen.getByTestId("stepper-step-1");
    expect(doneDot.getAttribute("data-status")).toBe("done");
  });

  it("keeps step labels in the accessibility tree at mobile widths (sr-only, not hidden)", () => {
    render(<Stepper current={1} blockedFrom={5} onJump={vi.fn()} />);

    const label = screen.getByText(/job description/i);
    expect(label.className).toContain("sr-only");
    expect(label.className).toContain("md:not-sr-only");
    expect(label.className).not.toContain("hidden");
  });

  it("renders exactly one dot per step (no duplicated nav variants)", () => {
    render(<Stepper current={1} blockedFrom={5} onJump={vi.fn()} />);

    expect(screen.getAllByTestId("stepper-step-1")).toHaveLength(1);
    expect(screen.getAllByTestId("stepper-step-4")).toHaveLength(1);
  });

  it("marks steps at or beyond blockedFrom as disabled, steps before it are not", () => {
    render(<Stepper current={1} blockedFrom={3} onJump={vi.fn()} />);

    expect(
      screen.getByTestId("stepper-step-1").getAttribute("aria-disabled")
    ).toBeNull();
    expect(
      screen.getByTestId("stepper-step-2").getAttribute("aria-disabled")
    ).toBeNull();
    expect(
      screen.getByTestId("stepper-step-3").getAttribute("aria-disabled")
    ).toBe("true");
    expect(
      screen.getByTestId("stepper-step-4").getAttribute("aria-disabled")
    ).toBe("true");
  });

  it("a done step renders as a button and calls onJump when clicked", () => {
    const onJump = vi.fn();
    render(<Stepper current={3} blockedFrom={4} onJump={onJump} />);

    fireEvent.click(
      screen.getByRole("button", { name: /back to.*job description/i })
    );

    expect(onJump).toHaveBeenCalledWith(1);
  });

  it("the current step is not a button and carries aria-current", () => {
    render(<Stepper current={3} blockedFrom={4} onJump={vi.fn()} />);

    const dot = screen.getByTestId("stepper-step-3");
    expect(dot.getAttribute("aria-current")).toBe("step");
    expect(dot.tagName).not.toBe("BUTTON");
  });

  it("a blocked step is disabled and carries an explainer, not silently", () => {
    render(<Stepper current={3} blockedFrom={4} onJump={vi.fn()} />);

    const blocked = screen.getByTestId("stepper-step-4");
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    expect(blocked.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/run a match first/i)).toBeDefined();
  });

  it("clicking a blocked step does not call onJump", () => {
    const onJump = vi.fn();
    render(<Stepper current={3} blockedFrom={4} onJump={onJump} />);

    fireEvent.click(screen.getByTestId("stepper-step-4"));

    expect(onJump).not.toHaveBeenCalled();
  });

  it("no hard-coded blue/indigo color remains", () => {
    const { container } = render(
      <Stepper current={3} blockedFrom={4} onJump={vi.fn()} />
    );

    expect(container.innerHTML).not.toMatch(/blue-|indigo-/);
  });
});
