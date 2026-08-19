import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useAiCredentials, useProviders } from "#/hooks/useAiCredentials";
import type { AiCredentialDto, ProviderInfoDto } from "#/types/AiCredentials";
import RunWithSelector from "../index";

vi.mock("#/hooks/useAiCredentials");
vi.mock("#/components/CredentialFormModal", () => ({
  default: () => <div data-testid="credential-form-modal" />
}));

function asQuery<T>(data: T) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null
  } as UseQueryResult<T>;
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

const base: AiCredentialDto = {
  id: "cred-1",
  provider: "openrouter",
  label: "Mine",
  keyLast4: "1234",
  chatModel: null,
  embedModel: null,
  lastTestStatus: "ok",
  lastTestedAt: "2026-08-01T00:00:00.000Z",
  lastUsedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z"
};

function mockCredentials(credentials: Array<AiCredentialDto>) {
  vi.mocked(useAiCredentials).mockReturnValue(asQuery(credentials));
  vi.mocked(useProviders).mockReturnValue(asQuery(providers));
}

describe("RunWithSelector", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to the most recently used credential", async () => {
    mockCredentials([
      { ...base, id: "a", label: "Older", lastUsedAt: "2026-08-01T00:00:00Z" },
      { ...base, id: "b", label: "Newer", lastUsedAt: "2026-08-05T00:00:00Z" }
    ]);
    const onChange = vi.fn();
    render(<RunWithSelector value={[]} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["b"]));
  });

  it("defaults to the system key when the user has no credentials", async () => {
    mockCredentials([]);
    const onChange = vi.fn();
    render(<RunWithSelector value={[]} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([null]));
  });

  it("drops a selection whose credential no longer exists", async () => {
    mockCredentials([{ ...base, id: "a" }]);
    const onChange = vi.fn();
    render(<RunWithSelector value={["a", "deleted-id"]} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["a"]));
  });

  it("keeps an unchanged multi-selection alone", async () => {
    mockCredentials([
      { ...base, id: "a" },
      { ...base, id: "b", label: "Second" }
    ]);
    const onChange = vi.fn();
    render(<RunWithSelector value={["a", "b"]} onChange={onChange} />);
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a provider when its checkbox is ticked", async () => {
    mockCredentials([
      { ...base, id: "a" },
      { ...base, id: "b", label: "Second" }
    ]);
    const onChange = vi.fn();
    render(<RunWithSelector value={["a"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Second/ }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(["a", "b"]))
    );
  });

  it("offers the system key as its own choice", () => {
    mockCredentials([{ ...base, id: "a" }]);
    render(<RunWithSelector value={["a"]} onChange={vi.fn()} />);
    expect(
      screen.getByRole("checkbox", { name: /System key/ })
    ).toBeInTheDocument();
  });

  it("names every selected provider in the privacy notice", () => {
    mockCredentials([
      { ...base, id: "a", provider: "gemini" },
      { ...base, id: "b", provider: "openrouter", label: "Second" }
    ]);
    render(<RunWithSelector value={["a", "b", null]} onChange={vi.fn()} />);

    expect(
      screen.getByText(
        "Your CV and JD text will be sent to: Google Gemini, OpenRouter, System key."
      )
    ).toBeInTheDocument();
  });

  it("asks for a selection when nothing is ticked", () => {
    mockCredentials([{ ...base, id: "a" }]);
    render(<RunWithSelector value={[]} onChange={vi.fn()} />);
    expect(
      screen.getByText("Select at least one key to run the match.")
    ).toBeInTheDocument();
  });

  it("warns about untested selections without blocking them", () => {
    mockCredentials([
      { ...base, id: "a", lastTestStatus: null },
      { ...base, id: "b", label: "Second", lastTestStatus: "no_quota" }
    ]);
    render(<RunWithSelector value={["a", "b"]} onChange={vi.fn()} />);

    expect(
      screen.getByText(
        "2 selected credentials have not passed a connection test."
      )
    ).toBeInTheDocument();
  });

  it("stays quiet when every selection passed its test", () => {
    mockCredentials([{ ...base, id: "a", lastTestStatus: "ok" }]);
    render(<RunWithSelector value={["a"]} onChange={vi.fn()} />);
    expect(
      screen.queryByText(/have not passed a connection test/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/has not passed a connection test/)
    ).not.toBeInTheDocument();
  });

  it("gives the group an accessible name", () => {
    mockCredentials([{ ...base, id: "a" }]);
    render(<RunWithSelector value={["a"]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Run with")).toBeInTheDocument();
  });
});
