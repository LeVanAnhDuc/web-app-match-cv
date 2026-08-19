import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import "#/i18n/config";
import type { DocumentSummaryDto } from "#/types/Documents";
import DocumentInputStep from "../index";

function Wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function stubSavedDocs(docs: Array<DocumentSummaryDto>) {
  const fetchMock = vi.fn(
    async (_input?: RequestInfo | URL, _init?: RequestInit) =>
      ({ ok: true, status: 200, json: async () => docs }) as Response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentInputStep", () => {
  it("renders the Upload file / Paste text tabs", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    expect(await screen.findByText(/upload file/i)).toBeDefined();
    expect(screen.getByText(/paste text/i)).toBeDefined();
  });

  it("pins the footer actions to the viewport below lg and uses large hit-areas", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    const next = await screen.findByRole("button", { name: /next/i });
    expect(next.className).toContain("ant-btn-lg");

    const footer = next.parentElement;
    expect(footer?.className).toContain("sticky");
    expect(footer?.className).toContain("lg:static");
  });

  it("switches from Upload to Paste tab", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    fireEvent.click(await screen.findByText(/paste text/i));
    expect(
      await screen.findByPlaceholderText(/paste the text content here/i)
    ).toBeDefined();
  });

  it("shows the reuse empty-state when there are no saved documents", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="CV" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    expect(await screen.findByText(/no saved cvs yet/i)).toBeDefined();
  });

  it("enables Next once a saved document is selected from the reuse radio list", async () => {
    stubSavedDocs([
      {
        id: "jd-1",
        kind: "JD",
        title: "Senior Product Designer",
        sourceFormat: "pdf",
        parentId: null,
        createdAt: "2023-10-12T00:00:00.000Z"
      }
    ]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.click(await screen.findByText("Senior Product Designer"));
    await waitFor(() => expect(nextButton).not.toBeDisabled());
  });

  it("calls onNext with the saved document id, skipping the create request", async () => {
    const fetchMock = stubSavedDocs([
      {
        id: "jd-1",
        kind: "JD",
        title: "Senior Product Designer",
        sourceFormat: "pdf",
        parentId: null,
        createdAt: "2023-10-12T00:00:00.000Z"
      }
    ]);
    const onNext = vi.fn();
    render(<DocumentInputStep kind="JD" onNext={onNext} />, {
      wrapper: Wrapper
    });

    fireEvent.click(await screen.findByText("Senior Product Designer"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(onNext).toHaveBeenCalledWith("jd-1"));
    // Only the GET saved-list request should have happened, no POST create.
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method === undefined)
    ).toBe(true);
  });

  it("keeps Next disabled while the paste textarea is empty", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    fireEvent.click(await screen.findByText(/paste text/i));
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("disables the Back button when onBack is not provided (step 1)", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    expect(await screen.findByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("enables Back when onBack is provided (step 2)", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="CV" onNext={vi.fn()} onBack={vi.fn()} />, {
      wrapper: Wrapper
    });

    expect(
      await screen.findByRole("button", { name: /back/i })
    ).not.toBeDisabled();
  });
});
