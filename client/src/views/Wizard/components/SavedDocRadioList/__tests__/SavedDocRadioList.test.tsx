import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { useSavedDocuments } from "#/hooks/useDocuments";
import SavedDocRadioList from "../index";

vi.mock("#/hooks/useDocuments");

function mockList(state: Partial<ReturnType<typeof useSavedDocuments>>) {
  vi.mocked(useSavedDocuments).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...state
  } as unknown as ReturnType<typeof useSavedDocuments>);
}

describe("SavedDocRadioList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the empty state when nothing is saved", () => {
    mockList({ data: [] });

    render(<SavedDocRadioList kind="JD" selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByText("No saved job descriptions yet")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports a failed load with a retry instead of pretending nothing is saved", () => {
    const refetch = vi.fn();
    mockList({ isError: true, refetch });

    render(<SavedDocRadioList kind="JD" selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't load your saved documents."
    );
    expect(screen.queryByText("No saved job descriptions yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
