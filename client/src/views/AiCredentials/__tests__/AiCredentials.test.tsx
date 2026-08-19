import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { ApiError } from "#/libs/api";
import {
  useAiCredentials,
  useDeleteCredential,
  useProviders,
  useTestCredential
} from "#/hooks/useAiCredentials";
import type { AiCredentialDto, ProviderInfoDto } from "#/types/AiCredentials";
import AiCredentials from "../index";

vi.mock("#/hooks/useAiCredentials");
// The dialog owns its own mutations and has its own spec; stub it out so this
// one only exercises the list.
vi.mock("#/components/CredentialFormModal", () => ({
  default: () => <div data-testid="credential-form-modal" />
}));

async function renderPage() {
  const rootRoute = createRootRoute({ component: () => <AiCredentials /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  const result = render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1 });
  return result;
}

function asQuery<T>(
  data: T | undefined,
  over: Partial<UseQueryResult<T>> = {}
) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: data !== undefined,
    error: null,
    ...over
  } as UseQueryResult<T>;
}

function asMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false
  } as unknown as UseMutationResult<never, Error, string>;
}

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

const baseCredential: AiCredentialDto = {
  id: "cred-1",
  provider: "gemini",
  label: "My Gemini key",
  keyLast4: "5821",
  chatModel: null,
  embedModel: null,
  lastTestStatus: null,
  lastTestedAt: null,
  lastUsedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z"
};

function mockHooks(
  credentials: Array<AiCredentialDto> | undefined,
  over: Partial<UseQueryResult<Array<AiCredentialDto>>> = {}
) {
  vi.mocked(useAiCredentials).mockReturnValue(
    asQuery<Array<AiCredentialDto>>(credentials, over)
  );
  vi.mocked(useProviders).mockReturnValue(asQuery(providers));
  vi.mocked(useTestCredential).mockReturnValue(asMutation());
  vi.mocked(useDeleteCredential).mockReturnValue(asMutation());
}

describe("AiCredentials page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state and says matching falls back to the system key", async () => {
    mockHooks([]);
    await renderPage();
    expect(screen.getByText("No credentials yet")).toBeInTheDocument();
    expect(screen.getAllByText(/system key/i).length).toBeGreaterThan(0);
  });

  it("renders a human provider label, never the raw enum value", async () => {
    mockHooks([baseCredential]);
    await renderPage();
    expect(screen.getByText("Google Gemini")).toBeInTheDocument();
    expect(screen.queryByText("gemini")).not.toBeInTheDocument();
  });

  it("masks the key and never renders anything but the last four characters", async () => {
    mockHooks([baseCredential]);
    const { container } = await renderPage();
    expect(screen.getByText("••••5821")).toBeInTheDocument();
    expect(container.textContent).not.toContain("sk-");
  });

  it("says 'Default' for both models when no override is stored", async () => {
    mockHooks([baseCredential]);
    await renderPage();
    expect(screen.getByText("Default · Default")).toBeInTheDocument();
  });

  it("shows 'Not tested' rather than a blank or an Invalid Date", async () => {
    mockHooks([baseCredential]);
    const { container } = await renderPage();
    expect(screen.getByText("Not tested")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Invalid Date");
  });

  it("renders the stored verdict as a human label", async () => {
    mockHooks([
      {
        ...baseCredential,
        lastTestStatus: "invalid_key",
        lastTestedAt: "2026-08-01T00:00:00.000Z"
      }
    ]);
    await renderPage();
    expect(screen.getByText("Invalid key")).toBeInTheDocument();
    expect(screen.queryByText("invalid_key")).not.toBeInTheDocument();
  });

  it("reports a generic failure when the list request errors", async () => {
    mockHooks(undefined, {
      isError: true,
      isSuccess: false,
      error: new ApiError(500, "boom")
    });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load your credentials"
    );
  });

  it("explains a 503 as unconfigured storage, not a generic failure", async () => {
    mockHooks(undefined, {
      isError: true,
      isSuccess: false,
      error: new ApiError(503, "not configured")
    });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Credential storage is not configured on the server."
    );
  });

  it("offers Test, Edit and Delete in that order on each row", async () => {
    mockHooks([baseCredential]);
    await renderPage();
    const buttons = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    const testIndex = buttons.indexOf("Test");
    const editIndex = buttons.indexOf("Edit");
    const deleteIndex = buttons.indexOf("Delete");
    expect(testIndex).toBeGreaterThan(-1);
    expect(editIndex).toBeGreaterThan(testIndex);
    expect(deleteIndex).toBeGreaterThan(editIndex);
  });
});
