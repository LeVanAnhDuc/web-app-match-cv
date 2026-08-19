import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { useWizardStore } from "#/stores";
import Wizard from "../index";

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Wizard />
    </QueryClientProvider>
  );
}

function stubApi() {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string) as {
          kind: "JD" | "CV";
          sourceText: string;
          save: boolean;
          title?: string;
        };
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: `${body.kind.toLowerCase()}-1`,
            kind: body.kind,
            title: body.title ?? null,
            sourceFormat: "text",
            rawText: body.sourceText,
            isSaved: body.save,
            createdAt: "2023-10-12T00:00:00.000Z"
          })
        } as Response;
      }

      if (url.includes("/documents?kind=")) {
        return { ok: true, status: 200, json: async () => [] } as Response;
      }

      throw new Error(`Unhandled fetch in test: ${url}`);
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("wizard shell layout", () => {
  beforeEach(() => {
    useWizardStore.setState({ step: 1, jdDocId: null, cvDocId: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the stepper exactly once — single markup, no duplicated variants", async () => {
    stubApi();
    renderWizard();
    await screen.findByText(/input job description/i);

    // The wizard lives inside the app shell (which owns the sidebar/brand), so
    // it renders only the horizontal Stepper. Single-markup guard: each step
    // testid appears exactly once — the Playwright strict-mode locators rely on
    // there being no duplicated desktop/mobile stepper variants.
    expect(screen.getAllByTestId("stepper-step-1")).toHaveLength(1);
    expect(screen.getAllByTestId("stepper-step-4")).toHaveLength(1);
  });
});

describe("wizard flow: JD -> CV -> Back", () => {
  beforeEach(() => {
    useWizardStore.setState({ step: 1, jdDocId: null, cvDocId: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("advances from step 1 (JD) to step 2 (CV) after creating a document, and Back returns to step 1 keeping jdDocId", async () => {
    stubApi();
    renderWizard();

    // Step 1: switch to paste, enter text, Next → creates a transient (save:false) doc.
    await screen.findByText(/input job description/i);

    fireEvent.click(screen.getByText(/paste text/i));
    fireEvent.change(
      await screen.findByPlaceholderText(/paste the text content here/i),
      {
        target: { value: "We are hiring a senior engineer." }
      }
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(useWizardStore.getState().jdDocId).toBe("jd-1"));
    await waitFor(() => expect(useWizardStore.getState().step).toBe(2));

    // Step 2: CV title from mock, Back button enabled this time.
    await screen.findByText(/candidate cv/i);
    const backButton = screen.getByRole("button", { name: /back/i });
    expect(backButton).not.toBeDisabled();

    fireEvent.click(backButton);

    await waitFor(() => expect(useWizardStore.getState().step).toBe(1));
    // jdDocId must be preserved across Back navigation.
    expect(useWizardStore.getState().jdDocId).toBe("jd-1");
    await screen.findByText(/input job description/i);
  });
});
