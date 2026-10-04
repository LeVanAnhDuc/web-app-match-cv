import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import "#/i18n/config";
import { useAuth } from "#/hooks/useAuth";
import { signInUrl } from "#/libs/api";
import type { DocumentSummaryDto } from "#/types/Documents";
import DocumentInputStep from "../index";

vi.mock("#/hooks/useAuth");

const auth = (status: "guest" | "user") => ({
  status,
  user: null,
  guestQuota: null,
  isUser: status === "user"
});

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

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(auth("user"));
});

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

  it("card locks height at desktop and footer sticky on mobile", async () => {
    stubSavedDocs([]);
    const { container } = render(
      <DocumentInputStep kind="JD" onNext={vi.fn()} />,
      { wrapper: Wrapper }
    );

    const card = container.querySelector(".rounded-xl");
    expect(card?.className).toContain("lg:h-full");
    expect(card?.className).toContain("lg:overflow-hidden");

    const footer = await screen.findByRole("button", { name: /next/i });
    const footerContainer = footer.parentElement;
    expect(footerContainer?.className).toContain("sticky");
    expect(footerContainer?.className).toContain("bottom-0");
  });

  it("eyebrow of saved list uses text-muted", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    const heading = await screen.findByRole("heading", { name: /saved/i });
    expect(heading.className).toContain("text-muted");
    expect(heading.className).not.toContain("text-faint");
  });

  it("touch-sizes both footer buttons and stretches them below md", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="CV" onNext={vi.fn()} onBack={vi.fn()} />, {
      wrapper: Wrapper
    });

    for (const name of [/next/i, /back/i]) {
      const button = await screen.findByRole("button", { name });
      expect(button.className).toContain("!h-11");
      expect(button.className).toContain("max-md:w-full");
    }
  });
});

describe("DocumentInputStep as a guest", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(auth("guest"));
  });

  it("offers upload/paste only — no saved list, no save-for-reuse, no library request", async () => {
    const fetchMock = stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    fireEvent.click(await screen.findByText(/paste text/i));
    fireEvent.change(
      await screen.findByPlaceholderText(/paste the text content here/i),
      { target: { value: "We are hiring." } }
    );

    expect(screen.queryByRole("heading", { name: /saved/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /save for reuse/i })
    ).toBeNull();
    // GET /documents (the library) 401s for a guest, so it must never fire.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the document is kept for 24 hours and links to sign in", async () => {
    stubSavedDocs([]);
    render(<DocumentInputStep kind="JD" onNext={vi.fn()} />, {
      wrapper: Wrapper
    });

    expect(
      await screen.findByText(/As a guest, this document is kept for 24 hours/)
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      signInUrl("/wizard")
    );
  });
});
