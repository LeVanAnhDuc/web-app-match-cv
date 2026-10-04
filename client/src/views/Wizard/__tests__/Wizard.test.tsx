import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from "@tanstack/react-router";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { useAuth } from "#/hooks/useAuth";
import { ApiError } from "#/libs/api";
import { fetchMatchRun } from "#/requests/match";
import { Route as WizardRoute } from "#/routes/_app/wizard";
import { useWizardStore } from "#/stores";
import type { MatchRunDetailDto } from "#/types/Matching";
import type * as MatchRequests from "#/requests/match";
import Wizard from "../index";

vi.mock("#/hooks/useAuth");
vi.mock("#/requests/match", async (importOriginal) => ({
  ...(await importOriginal<typeof MatchRequests>()),
  fetchMatchRun: vi.fn()
}));

const auth = (status: "guest" | "user") => ({
  status,
  user: null,
  guestQuota: null,
  isUser: status === "user"
});

// Mirrors the real tree (`/_app` pathless layout → `wizard`) so the view's
// `useSearch({ from: "/_app/wizard" })` resolves, and reuses the real
// `validateSearch` so what is tested is what ships.
function renderWizard(url = "/wizard") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_app",
    component: () => <Outlet />
  });
  const wizardRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "wizard",
    validateSearch: WizardRoute.options.validateSearch,
    component: Wizard
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([appRoute.addChildren([wizardRoute])]),
    history: createMemoryHistory({ initialEntries: [url] })
  });
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <RouterProvider router={router} />
      </App>
    </QueryClientProvider>
  );
  return router;
}

const storedRun: MatchRunDetailDto = {
  id: "r1",
  cvDocumentId: "cv-9",
  jdDocumentId: "jd-9",
  createdAt: "2026-10-04T00:00:00.000Z",
  results: []
};

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
    vi.mocked(useAuth).mockReturnValue(auth("user"));
    useWizardStore.getState().reset();
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
    vi.mocked(useAuth).mockReturnValue(auth("user"));
    useWizardStore.getState().reset();
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
    // Exact name, not /back/i: step 1 is now "done" in the stepper and renders
    // its own jump button. That button used to be labelled "Back to Job
    // Description", which made even Playwright's default substring matching
    // ambiguous; it is "Go to …" now, and Stepper.test.tsx guards that. Keep
    // the exact name anyway — the footer button is what this test means.
    await screen.findByText(/candidate cv/i);
    const backButton = screen.getByRole("button", { name: "Back" });
    expect(backButton).not.toBeDisabled();

    fireEvent.click(backButton);

    await waitFor(() => expect(useWizardStore.getState().step).toBe(1));
    // jdDocId must be preserved across Back navigation.
    expect(useWizardStore.getState().jdDocId).toBe("jd-1");
    await screen.findByText(/input job description/i);
  });
});

describe("reopening a run from the URL (design §6.3)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(auth("user"));
    vi.mocked(fetchMatchRun).mockReset();
    useWizardStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads ?runId=, lands on step 4 with that run's documents, then drops runId but keeps claimed", async () => {
    vi.mocked(fetchMatchRun).mockResolvedValue(storedRun);
    const router = renderWizard("/wizard?runId=r1&claimed=1");

    await waitFor(() => expect(useWizardStore.getState().step).toBe(4));
    expect(fetchMatchRun).toHaveBeenCalledWith("r1");
    const s = useWizardStore.getState();
    expect(s.runId).toBe("r1");
    expect(s.cvDocId).toBe("cv-9");
    expect(s.jdDocId).toBe("jd-9");
    expect(s.pendingCredentialIds).toEqual([]);

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ claimed: "1" })
    );
  });

  it("confirms the claim once to a signed-in user and forgets it on dismiss", async () => {
    vi.mocked(fetchMatchRun).mockResolvedValue(storedRun);
    const router = renderWizard("/wizard?runId=r1&claimed=1");

    expect(await screen.findAllByText("Saved to your account.")).toHaveLength(
      1
    );
    expect(
      screen.getByText(
        "This result, its CV and its JD moved over from your guest session."
      )
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await waitFor(() =>
      expect(screen.queryByText("Saved to your account.")).toBeNull()
    );
  });

  it("does not confirm a claim to a guest", async () => {
    vi.mocked(useAuth).mockReturnValue(auth("guest"));
    vi.mocked(fetchMatchRun).mockResolvedValue(storedRun);
    renderWizard("/wizard?runId=r1&claimed=1");

    await waitFor(() => expect(useWizardStore.getState().step).toBe(4));
    expect(screen.queryByText("Saved to your account.")).toBeNull();
  });

  it("falls back to step 1 and says so when the run is gone", async () => {
    vi.mocked(fetchMatchRun).mockRejectedValue(
      new ApiError(404, "Not found", "NOT_FOUND")
    );
    const router = renderWizard("/wizard?runId=gone");

    expect(
      await screen.findByText("No run to show. Start a new match.")
    ).toBeDefined();
    expect(useWizardStore.getState().step).toBe(1);
    expect(useWizardStore.getState().runId).toBeNull();
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it("does not refetch a run the store already holds", async () => {
    useWizardStore.setState({
      step: 4,
      runId: "r1",
      cvDocId: "cv-9",
      jdDocId: "jd-9"
    });
    vi.mocked(fetchMatchRun).mockResolvedValue(storedRun);
    const router = renderWizard("/wizard?runId=r1");

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    await act(async () => {});
    // StepResult reads the run itself; the reopen path must not add a call.
    expect(vi.mocked(fetchMatchRun).mock.calls.length).toBeLessThanOrEqual(1);
    expect(useWizardStore.getState().step).toBe(4);
  });
});
