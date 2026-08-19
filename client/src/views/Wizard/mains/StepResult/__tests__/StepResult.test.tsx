import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useMatchResult, useMatchRun, useRunMatch } from "#/hooks/useMatch";
import { useProviders } from "#/hooks/useAiCredentials";
import { useDocument } from "#/hooks/useDocuments";
import { useWizardStore } from "#/stores";
import type {
  CreateMatchInput,
  MatchResultDto,
  MatchRunDetailDto
} from "#/types/Matching";
import type { DocumentDto } from "#/types/Documents";
import type { ProviderInfoDto } from "#/types/AiCredentials";
import StepResult from "../index";

vi.mock("#/hooks/useMatch");
vi.mock("#/hooks/useAiCredentials");
// The card reads the CV only to learn whether it descends from an earlier
// version (Goal 9), so the comparison action can be offered.
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
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultChatModel: "gemini-2.5-flash",
    defaultEmbedModel: "gemini-embedding-001"
  }
];

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

const failed: MatchResultDto = {
  ...succeeded,
  id: "match-2",
  overallScore: 0,
  semanticScore: 0,
  keywordScore: 0,
  report: { strengths: [], gaps: [], suggestions: [] },
  status: "failed",
  errorCode: "no_quota",
  provider: "gemini",
  chatModel: "gemini-2.5-flash"
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

function mockRunMatch(behaviour: {
  isPending?: boolean;
  result?: MatchResultDto;
}) {
  const mutateAsync = vi.fn(async (_input: CreateMatchInput) => {
    // A pending card is modelled as a promise that never settles — that is
    // exactly what the skeleton branch is waiting on.
    if (behaviour.isPending)
      return new Promise<MatchResultDto>(() => undefined);
    return behaviour.result as MatchResultDto;
  });
  vi.mocked(useRunMatch).mockReturnValue({
    mutateAsync,
    isPending: false
  } as unknown as UseMutationResult<MatchResultDto, Error, CreateMatchInput>);
  return mutateAsync;
}

function setStore(over: Record<string, unknown>) {
  useWizardStore.setState({
    step: 4,
    cvDocId: CV_ID,
    jdDocId: JD_ID,
    runId: RUN_ID,
    credentialIds: [],
    pendingCredentialIds: [],
    matchId: null,
    ...over
  });
}

describe("StepResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useProviders).mockReturnValue(asQuery(providers));
    vi.mocked(useDocument).mockReturnValue(asQuery(originalCv));
    vi.mocked(useMatchRun).mockReturnValue(
      asQuery<MatchRunDetailDto>(undefined)
    );
    vi.mocked(useMatchResult).mockReturnValue(
      asQuery<MatchResultDto>(undefined)
    );
    useWizardStore.getState().reset();
  });

  it("renders one card per provider chosen for this run", () => {
    setStore({ pendingCredentialIds: ["cred-a", null] });
    mockRunMatch({ isPending: true });

    render(<StepResult />);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it("fires exactly one request per card", () => {
    setStore({ pendingCredentialIds: ["cred-a", "cred-b", null] });
    const mutate = mockRunMatch({ isPending: true });

    render(<StepResult />);

    expect(mutate).toHaveBeenCalledTimes(3);
    // The system-key card sends no credentialId at all — absent, not null.
    expect(mutate).toHaveBeenLastCalledWith({
      cvDocumentId: CV_ID,
      jdDocumentId: JD_ID,
      runId: RUN_ID,
      credentialId: undefined
    });
  });

  it("shows the scores and the report once a card resolves", async () => {
    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: succeeded });

    render(<StepResult />);

    expect(await screen.findByText("82%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    // Sole card → the report is expanded rather than hidden behind a toggle.
    expect(screen.getByText("Strong backend background")).toBeInTheDocument();
    expect(screen.queryByText("Show full report")).not.toBeInTheDocument();
  });

  it("collapses the report when several providers share the screen", async () => {
    setStore({ pendingCredentialIds: ["cred-a", "cred-b"] });
    mockRunMatch({ result: succeeded });

    render(<StepResult />);

    await waitFor(() =>
      expect(screen.getAllByText("Show full report").length).toBe(2)
    );
  });

  it("names the provider and model that produced each card", async () => {
    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: succeeded });

    render(<StepResult />);

    expect(
      await screen.findByText("OpenRouter · openai/gpt-4o-mini")
    ).toBeInTheDocument();
  });

  it("renders a failed card as an error, never as a 0% score", async () => {
    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: failed });

    render(<StepResult />);

    expect(
      await screen.findByText("This key has no quota left with the provider.")
    ).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("reads the run instead of firing when the page was reloaded", async () => {
    setStore({ pendingCredentialIds: [] });
    const mutate = mockRunMatch({});
    vi.mocked(useMatchRun).mockReturnValue(
      asQuery<MatchRunDetailDto>({
        id: RUN_ID,
        cvDocumentId: CV_ID,
        jdDocumentId: JD_ID,
        createdAt: "2026-08-08T00:00:00.000Z",
        results: [succeeded]
      })
    );

    render(<StepResult />);

    expect(await screen.findByText("82%")).toBeInTheDocument();
    // Re-firing would silently double the AI spend.
    expect(mutate).not.toHaveBeenCalled();
  });

  it("says so when a reloaded run has nothing in it yet", async () => {
    setStore({ pendingCredentialIds: [] });
    mockRunMatch({});
    vi.mocked(useMatchRun).mockReturnValue(
      asQuery<MatchRunDetailDto>({
        id: RUN_ID,
        cvDocumentId: CV_ID,
        jdDocumentId: JD_ID,
        createdAt: "2026-08-08T00:00:00.000Z",
        results: []
      })
    );

    render(<StepResult />);

    expect(await screen.findByText("Nothing finished yet")).toBeInTheDocument();
  });

  it("reopens a single stored result when history hands over a match id", async () => {
    // How Home's recent-matches widget arrives: a match id and nothing else.
    setStore({
      runId: null,
      cvDocId: null,
      jdDocId: null,
      matchId: succeeded.id,
      pendingCredentialIds: []
    });
    const mutate = mockRunMatch({});
    vi.mocked(useMatchResult).mockReturnValue(asQuery(succeeded));

    render(<StepResult />);

    expect(await screen.findByText("82%")).toBeInTheDocument();
    expect(screen.getByText("Strong backend background")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("offers the rewrite assistant on a succeeded card only", async () => {
    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: succeeded });

    const { unmount } = render(<StepResult />);
    expect(
      await screen.findByRole("button", { name: "Improve my CV" })
    ).toBeInTheDocument();
    unmount();

    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: failed });
    render(<StepResult />);

    expect(
      await screen.findByText("This key has no quota left with the provider.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Improve my CV" })
    ).not.toBeInTheDocument();
  });

  it("offers the version comparison only when the CV came from an earlier one", async () => {
    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: succeeded });

    const { unmount } = render(<StepResult />);
    expect(await screen.findByText("82%")).toBeInTheDocument();
    // An original CV has no previous version, so the action does not exist.
    expect(
      screen.queryByRole("button", { name: "Compare versions" })
    ).not.toBeInTheDocument();
    unmount();

    setStore({ pendingCredentialIds: ["cred-a"] });
    mockRunMatch({ result: succeeded });
    vi.mocked(useDocument).mockReturnValue(
      asQuery({ ...originalCv, parentId: "cv-0" })
    );
    render(<StepResult />);

    expect(
      await screen.findByRole("button", { name: "Compare versions" })
    ).toBeInTheDocument();
  });

  it("offers a way out when there is no run at all", () => {
    setStore({ runId: null, pendingCredentialIds: [] });
    mockRunMatch({});

    render(<StepResult />);

    expect(screen.getByRole("alert")).toHaveTextContent("No run to show");
    expect(
      screen.getByRole("button", { name: /Start over/i })
    ).toBeInTheDocument();
  });
});
