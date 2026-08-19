import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import * as documentHooks from "#/hooks/useDocuments";
import * as matchHooks from "#/hooks/useMatch";
import { useWizardStore } from "#/stores";
import type { DocumentDto } from "#/types/Documents";
import StepReview from "../index";

// DocumentPreview pulls react-pdf/docx-preview — stub it so the pane just
// reports which doc id it was asked to render.
vi.mock("#/components/DocumentPreview", () => ({
  default: ({ docId }: { docId: string }) => (
    <div data-testid="review-pane" data-docid={docId} />
  )
}));

function renderStep() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StepReview />
    </QueryClientProvider>
  );
}

const jdDto: DocumentDto = {
  id: "jd-1",
  kind: "JD",
  title: "Senior Product Designer",
  sourceFormat: "pdf",
  rawText: "We need a senior product designer with Figma experience.",
  isSaved: true,
  parentId: null,
  createdAt: "2023-10-12T00:00:00.000Z"
};

const cvDto: DocumentDto = {
  id: "cv-1",
  kind: "CV",
  title: "Sarah Johnson",
  sourceFormat: "docx",
  rawText: "Sarah Johnson — 6 years of product design experience.",
  isSaved: true,
  parentId: null,
  createdAt: "2023-10-12T00:00:00.000Z"
};

function mockDocs() {
  vi.spyOn(documentHooks, "useDocument").mockImplementation((id) => {
    const data = id === "jd-1" ? jdDto : id === "cv-1" ? cvDto : undefined;
    return { data, isLoading: false, isError: false } as ReturnType<
      typeof documentHooks.useDocument
    >;
  });
}

describe("StepReview", () => {
  beforeEach(() => {
    useWizardStore.setState({
      step: 3,
      jdDocId: "jd-1",
      cvDocId: "cv-1",
      matchId: null,
      credentialIds: ["cred-a"],
      runId: null,
      pendingCredentialIds: []
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders read-only preview panes for the selected CV and JD", async () => {
    mockDocs();
    vi.spyOn(matchHooks, "useCreateMatchRun").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as unknown as ReturnType<typeof matchHooks.useCreateMatchRun>);

    renderStep();

    const panes = await screen.findAllByTestId("review-pane");
    const docIds = panes.map((p) => p.getAttribute("data-docid"));
    expect(docIds).toContain("cv-1");
    expect(docIds).toContain("jd-1");
    // No editable textareas anymore.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("Back navigates to step 2", async () => {
    mockDocs();
    vi.spyOn(matchHooks, "useCreateMatchRun").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as unknown as ReturnType<typeof matchHooks.useCreateMatchRun>);

    renderStep();
    await screen.findAllByTestId("review-pane");

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    await waitFor(() => expect(useWizardStore.getState().step).toBe(2));
  });

  it("Run match opens a run, remembers the chosen providers and advances", async () => {
    mockDocs();
    const mutateAsync = vi.fn(async () => ({
      id: "run-1",
      cvDocumentId: "cv-1",
      jdDocumentId: "jd-1",
      createdAt: "2026-08-08T00:00:00.000Z"
    }));
    vi.spyOn(matchHooks, "useCreateMatchRun").mockReturnValue({
      mutateAsync,
      isPending: false
    } as unknown as ReturnType<typeof matchHooks.useCreateMatchRun>);

    renderStep();
    await screen.findAllByTestId("review-pane");

    fireEvent.click(screen.getByRole("button", { name: /run match/i }));

    // Only the run is opened here; the per-provider calls belong to the cards.
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        cvDocumentId: "cv-1",
        jdDocumentId: "jd-1"
      })
    );
    await waitFor(() => expect(useWizardStore.getState().runId).toBe("run-1"));
    expect(useWizardStore.getState().pendingCredentialIds).toEqual(["cred-a"]);
    await waitFor(() => expect(useWizardStore.getState().step).toBe(4));
  });

  it("refuses to run when no provider is selected", async () => {
    mockDocs();
    useWizardStore.setState({ credentialIds: [] });
    const mutateAsync = vi.fn();
    vi.spyOn(matchHooks, "useCreateMatchRun").mockReturnValue({
      mutateAsync,
      isPending: false
    } as unknown as ReturnType<typeof matchHooks.useCreateMatchRun>);

    renderStep();
    await screen.findAllByTestId("review-pane");

    expect(screen.getByRole("button", { name: /run match/i })).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
