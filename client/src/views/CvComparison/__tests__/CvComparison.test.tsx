import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useComparison } from "#/hooks/useComparison";
import { ApiError } from "#/libs/api";
import type { CvComparisonDto } from "#/types/Comparison";
import CvComparison from "../index";

vi.mock("#/hooks/useComparison");

const DOC_ID = "cv-2";
const JD_ID = "jd-1";

function asQuery(
  data: CvComparisonDto | undefined,
  over: Partial<UseQueryResult<CvComparisonDto>> = {}
) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    ...over
  } as UseQueryResult<CvComparisonDto>;
}

function comparison(over: Partial<CvComparisonDto> = {}): CvComparisonDto {
  return {
    base: {
      id: "cv-1",
      title: "Backend Resume",
      version: 1,
      createdAt: "2026-08-08T00:00:00.000Z"
    },
    revision: {
      id: DOC_ID,
      title: "Backend Resume (improved)",
      version: 2,
      createdAt: "2026-08-09T00:00:00.000Z"
    },
    jdDocumentId: JD_ID,
    jdOptions: [
      {
        id: JD_ID,
        title: "Senior Backend Engineer",
        hasBase: true,
        hasRevision: true
      },
      {
        id: "jd-2",
        title: "Platform Engineer",
        hasBase: true,
        hasRevision: false
      }
    ],
    baseResult: {
      matchResultId: "m1",
      overallScore: 61,
      semanticScore: 70,
      keywordScore: 48,
      provider: "openrouter",
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small",
      gaps: ["No CI/CD experience mentioned"],
      createdAt: "2026-08-08T00:00:00.000Z"
    },
    revisionResult: {
      matchResultId: "m2",
      overallScore: 75,
      semanticScore: 78,
      keywordScore: 71,
      provider: "openrouter",
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small",
      gaps: ["CI/CD exposure is still thin"],
      createdAt: "2026-08-09T00:00:00.000Z"
    },
    delta: { overall: 14, semantic: 8, keyword: 23 },
    gapDiff: {
      closed: ["Kubernetes not mentioned"],
      persisted: [
        {
          base: "No CI/CD experience mentioned",
          revision: "CI/CD exposure is still thin"
        }
      ],
      introduced: ["No Terraform"]
    },
    sameChatModel: true,
    sameEmbedModel: true,
    ...over
  };
}

async function renderPage() {
  const rootRoute = createRootRoute({
    component: () => <CvComparison documentId={DOC_ID} />
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  const result = render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Version comparison" });
  return result;
}

beforeEach(() => {
  vi.mocked(useComparison).mockReturnValue(asQuery(comparison()));
});

describe("CvComparison", () => {
  it("leads with the score delta of both versions", async () => {
    await renderPage();

    expect(screen.getByText("Version 1")).toBeDefined();
    expect(screen.getByText("Version 2")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined();
    expect(screen.getByText("+14")).toBeDefined();
    expect(screen.getByText("+8")).toBeDefined();
    expect(screen.getByText("+23")).toBeDefined();
  });

  it("prints a drop as a negative number and zero without a plus sign", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(comparison({ delta: { overall: -6, semantic: 0, keyword: 1 } }))
    );
    await renderPage();

    expect(screen.getByText("-6")).toBeDefined();
    // A rewrite that changed nothing must not read as an improvement.
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.queryByText("+0")).toBeNull();
    expect(screen.getByText("+1")).toBeDefined();
  });

  it("shows every gap verbatim, including both wordings of a persisting one", async () => {
    await renderPage();

    expect(screen.getByText("Kubernetes not mentioned")).toBeDefined();
    expect(screen.getByText("No CI/CD experience mentioned")).toBeDefined();
    expect(screen.getByText("CI/CD exposure is still thin")).toBeDefined();
    expect(screen.getByText("No Terraform")).toBeDefined();
    // The classification is an estimate, and the page says so.
    expect(screen.getByText(/matched by topic overlap/)).toBeDefined();
  });

  it("labels an empty gap bucket instead of leaving a blank column", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(
        comparison({
          gapDiff: { closed: [], persisted: [], introduced: [] }
        })
      )
    );
    await renderPage();

    expect(screen.getAllByText("None")).toHaveLength(3);
  });

  it("asks for a match instead of inventing zeroes when a side is missing", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(comparison({ revisionResult: null, delta: null, gapDiff: null }))
    );
    await renderPage();

    expect(
      screen.getByRole("button", { name: /Match this version/ })
    ).toBeDefined();
    // No delta tiles at all — a zeroed table would read as "no improvement".
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText("+14")).toBeNull();
  });

  it("warns when the two matches ran on different models", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(comparison({ sameEmbedModel: false }))
    );
    await renderPage();

    expect(
      screen.getByText("The two matches used different AI models")
    ).toBeDefined();
  });

  it("offers the wizard when neither version has ever been matched", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(
        comparison({
          jdOptions: [],
          jdDocumentId: null,
          baseResult: null,
          revisionResult: null,
          delta: null,
          gapDiff: null
        })
      )
    );
    await renderPage();

    expect(
      screen.getByText("Neither version has been matched yet")
    ).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("lets the job description be switched", async () => {
    await renderPage();

    const select = screen.getByRole("combobox", { name: "Job description" });
    fireEvent.mouseDown(select);
    expect(await screen.findByTitle("Platform Engineer")).toBeDefined();
  });

  it("names a CV with no declared previous version rather than failing blankly", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(undefined, {
        isError: true,
        error: new ApiError(400, "no parent")
      })
    );
    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      /not marked as a new version/
    );
  });

  it("distinguishes a missing CV from a broken request", async () => {
    vi.mocked(useComparison).mockReturnValue(
      asQuery(undefined, { isError: true, error: new ApiError(404, "gone") })
    );
    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't exist/);
  });
});
