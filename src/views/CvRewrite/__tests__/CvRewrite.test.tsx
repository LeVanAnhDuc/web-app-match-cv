import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useAiCredentials, useProviders } from "#/hooks/useAiCredentials";
import { useAcceptCvRewrite, useGenerateCvRewrite } from "#/hooks/useCvRewrite";
import { useDocument } from "#/hooks/useDocuments";
import { useMatchResult } from "#/hooks/useMatch";
import type { AiCredentialDto } from "#/types/AiCredentials";
import type {
  AcceptCvRewriteInput,
  CvRewriteProposalDto,
  GenerateCvRewriteInput
} from "#/types/CvRewrite";
import type { DocumentDto } from "#/types/Documents";
import type { MatchResultDto } from "#/types/Matching";
import CvRewrite from "../index";

vi.mock("#/hooks/useMatch");
vi.mock("#/hooks/useDocuments");
vi.mock("#/hooks/useCvRewrite");
vi.mock("#/hooks/useAiCredentials");

const MATCH_ID = "match-1";
const CV_ID = "cv-1";

const API_BULLET = "Built REST APIs with Node.js and Express.";

const match: MatchResultDto = {
  id: MATCH_ID,
  cvDocumentId: CV_ID,
  jdDocumentId: "jd-1",
  overallScore: 61,
  semanticScore: 70,
  keywordScore: 48,
  report: {
    strengths: ["Node.js"],
    gaps: ["No CI/CD experience"],
    suggestions: ["Mention pipelines"]
  },
  credentialId: null,
  runId: null,
  status: "succeeded",
  errorCode: null,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small",
  createdAt: "2026-08-09T00:00:00.000Z"
};

const cvDoc: DocumentDto = {
  id: CV_ID,
  kind: "CV",
  title: "Backend Resume",
  sourceFormat: "text",
  rawText: `EXPERIENCE\n- ${API_BULLET}\n- Led a monolith migration.`,
  isSaved: true,
  parentId: null,
  createdAt: "2026-08-09T00:00:00.000Z"
};

const proposal: CvRewriteProposalDto = {
  matchResultId: MATCH_ID,
  cvDocumentId: CV_ID,
  cvTitle: cvDoc.title,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  changes: [
    {
      id: "0",
      sectionHint: "Experience",
      original: API_BULLET,
      replacement: "Built, documented and deployed REST APIs.",
      rationale: "Names the delivery work the JD asks for.",
      addressesGap: "No CI/CD experience"
    },
    {
      id: "1",
      sectionHint: "Experience",
      original: "Led a monolith migration.",
      replacement: "Led a monolith migration with automated pipelines.",
      rationale: "Ties the migration to CI/CD.",
      addressesGap: null
    }
  ],
  unaddressedGaps: ["5 years of Kubernetes in production"]
};

function asQuery<T>(data: T | undefined, over = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: data !== undefined,
    error: null,
    ...over
  } as UseQueryResult<T>;
}

// Rendered without a RouterProvider, like the wizard step tests: navigation
// only happens after a successful save, and mounting a router here would make
// every assertion race the router's own async transition.
function renderPage() {
  return render(<CvRewrite matchResultId={MATCH_ID} />);
}

function mockGenerate(result: CvRewriteProposalDto | Error) {
  const mutateAsync = vi.fn(async (_input: GenerateCvRewriteInput) => {
    if (result instanceof Error) throw result;
    return result;
  });
  vi.mocked(useGenerateCvRewrite).mockReturnValue({
    mutateAsync,
    isPending: false
  } as unknown as UseMutationResult<
    CvRewriteProposalDto,
    Error,
    GenerateCvRewriteInput
  >);
  return mutateAsync;
}

function mockAccept() {
  const mutateAsync = vi.fn(async (_input: AcceptCvRewriteInput) => cvDoc);
  vi.mocked(useAcceptCvRewrite).mockReturnValue({
    mutateAsync,
    isPending: false
  } as unknown as UseMutationResult<DocumentDto, Error, AcceptCvRewriteInput>);
  return mutateAsync;
}

async function generate() {
  fireEvent.click(screen.getByRole("button", { name: "Generate suggestions" }));
  await screen.findByText("Suggested changes");
}

describe("CvRewrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMatchResult).mockReturnValue(asQuery(match));
    vi.mocked(useDocument).mockReturnValue(asQuery(cvDoc));
    vi.mocked(useAiCredentials).mockReturnValue(
      asQuery<Array<AiCredentialDto>>([])
    );
    vi.mocked(useProviders).mockReturnValue(asQuery([]));
    mockAccept();
  });

  it("does not generate anything until the user asks for it", () => {
    const mutate = mockGenerate(proposal);

    renderPage();

    expect(screen.getByText("No CI/CD experience")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText("Suggested changes")).not.toBeInTheDocument();
  });

  it("lists the changes with nothing pre-approved", async () => {
    mockGenerate(proposal);

    renderPage();
    await generate();

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(API_BULLET)).toBeInTheDocument();
    expect(
      screen.getByText("Built, documented and deployed REST APIs.")
    ).toBeInTheDocument();
    // Saving is impossible until something is approved.
    expect(
      screen.getByRole("button", { name: /Save as new CV/ })
    ).toBeDisabled();
  });

  it("reports gaps it refused to close instead of inventing them", async () => {
    mockGenerate(proposal);

    renderPage();
    await generate();

    expect(
      screen.getByText("These gaps need real experience")
    ).toBeInTheDocument();
    expect(
      screen.getByText("5 years of Kubernetes in production")
    ).toBeInTheDocument();
  });

  it("sends only the approved changes when saving", async () => {
    mockGenerate(proposal);
    const accept = mockAccept();

    renderPage();
    await generate();

    fireEvent.click(screen.getAllByRole("checkbox")[1]); // first change only
    fireEvent.click(screen.getByRole("button", { name: /Save as new CV/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    expect(accept).toHaveBeenCalledWith({
      matchResultId: MATCH_ID,
      title: "Backend Resume (improved)",
      changes: [
        {
          original: API_BULLET,
          replacement: "Built, documented and deployed REST APIs."
        }
      ]
    });
  });

  it("clears previous approvals when the suggestions are regenerated", async () => {
    mockGenerate(proposal);

    renderPage();
    await generate();

    fireEvent.click(screen.getAllByRole("checkbox")[0]); // select all
    expect(
      screen.getByRole("button", { name: /Save as new CV/ })
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Generate again" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Save as new CV/ })
      ).toBeDisabled()
    );
  });

  it("surfaces a generation failure without losing the page", async () => {
    mockGenerate(new Error("boom"));

    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate suggestions" })
    );

    expect(
      await screen.findByText(
        "Couldn't generate suggestions. Please try again."
      )
    ).toBeInTheDocument();
  });

  it("says so when the model had nothing safe to suggest", async () => {
    mockGenerate({ ...proposal, changes: [], unaddressedGaps: [] });

    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Generate suggestions" })
    );

    expect(
      await screen.findByText("No changes to suggest")
    ).toBeInTheDocument();
  });
});
