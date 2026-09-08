import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useProviders } from "#/hooks/useAiCredentials";
import { useDocument } from "#/hooks/useDocuments";
import { useRunMatch } from "#/hooks/useMatch";
import type { DocumentDto } from "#/types/Documents";
import type { ProviderInfoDto } from "#/types/AiCredentials";
import type { CreateMatchInput, MatchResultDto } from "#/types/Matching";
import MatchResultCard from "../index";

vi.mock("#/hooks/useMatch");
vi.mock("#/hooks/useAiCredentials");
vi.mock("#/hooks/useDocuments");

const RUN_ID = "run-1";
const CV_ID = "cv-1";
const JD_ID = "jd-1";

const providers: Array<ProviderInfoDto> = [
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultChatModel: "openai/gpt-4o-mini",
    defaultEmbedModel: "openai/text-embedding-3-small"
  }
];

const originalCv: DocumentDto = {
  id: CV_ID,
  kind: "CV",
  title: "Backend Resume",
  sourceFormat: "text",
  rawText: "…",
  isSaved: true,
  parentId: null,
  createdAt: "2026-08-08T00:00:00.000Z"
};

const succeeded: MatchResultDto = {
  id: "match-1",
  cvDocumentId: CV_ID,
  jdDocumentId: JD_ID,
  overallScore: 82,
  semanticScore: 90,
  keywordScore: 74,
  report: {
    strengths: ["Strong backend background"],
    gaps: ["No GraphQL experience"],
    suggestions: ["Quantify API impact"]
  },
  credentialId: null,
  runId: RUN_ID,
  status: "succeeded",
  errorCode: null,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small",
  createdAt: "2026-08-08T00:00:00.000Z"
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

function mockRunMatch() {
  const mutateAsync = vi.fn(async (_input: CreateMatchInput) => succeeded);
  vi.mocked(useRunMatch).mockReturnValue({
    mutateAsync,
    isPending: false
  } as unknown as UseMutationResult<MatchResultDto, Error, CreateMatchInput>);
  return mutateAsync;
}

function renderCard(over: Partial<MatchResultDto> = {}) {
  return render(
    <MatchResultCard
      runId={RUN_ID}
      cvDocumentId={CV_ID}
      jdDocumentId={JD_ID}
      credentialId={null}
      autoRun={false}
      initialResult={{ ...succeeded, ...over }}
      expanded
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useProviders).mockReturnValue(asQuery(providers));
  vi.mocked(useDocument).mockReturnValue(asQuery(originalCv));
  mockRunMatch();
});

describe("MatchResultCard", () => {
  it("shows overall/semantic/keyword as three Readout meters, not a gauge", () => {
    renderCard();

    expect(
      screen.getByRole("meter", { name: "Overall match" })
    ).toHaveAttribute("aria-valuenow", "82");
    expect(
      screen.getByRole("meter", { name: "Semantic match" })
    ).toHaveAttribute("aria-valuenow", "90");
    expect(
      screen.getByRole("meter", { name: "Keyword / Skills match" })
    ).toHaveAttribute("aria-valuenow", "74");
    // The old gauge rendered the number and the % sign as one text node.
    expect(screen.queryByText("82%")).toBeNull();
  });

  it("keeps the three scores as one grid, 3 columns from md up", () => {
    renderCard();

    const grid = screen
      .getByRole("meter", { name: "Overall match" })
      .closest("div.grid");
    expect(grid).toHaveClass("md:grid-cols-3");
  });

  // design.md §7 claims these actions reach the NFR-A11Y-03 touch target by
  // going full-width on mobile. antd's default Button is 32px high, so the
  // claim only holds if the card asks for the tall size and full width below
  // `md`. Measured on the running app at 390px they were 157x32 — hence this
  // test.
  it("header actions are full-width and touch-sized below md, inline from md up", () => {
    renderCard();

    const improve = screen.getByRole("button", { name: /Improve my CV/ });
    expect(improve.className).toContain("w-full");
    expect(improve.className).toContain("md:w-auto");
    // 44px below md (NFR-A11Y-03), back to the compact 32px from md up.
    expect(improve.className).toContain("!h-11");
    expect(improve.className).toContain("md:!h-8");

    // The row itself has to stack, or w-full buttons still sit side by side.
    const row = improve.parentElement;
    expect(row).not.toBeNull();
    expect(row!.className).toContain("flex-col");
    expect(row!.className).toContain("md:flex-row");
  });

  it("shows a skeleton instead of scores while the match is running", () => {
    render(
      <MatchResultCard
        runId={RUN_ID}
        cvDocumentId={CV_ID}
        jdDocumentId={JD_ID}
        credentialId={null}
        autoRun={false}
        expanded
      />
    );

    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("shows an error alert instead of scores when the run failed", () => {
    renderCard({ status: "failed", errorCode: "no_quota" });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This key has no quota left with the provider."
    );
    expect(screen.queryByRole("meter")).toBeNull();
  });
});
