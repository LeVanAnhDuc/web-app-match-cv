import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { ApiError } from "#/libs/api";
import {
  useCreateCredential,
  useProviders,
  useTestCredential,
  useUpdateCredential
} from "#/hooks/useAiCredentials";
import type {
  AiCredentialDto,
  CreateCredentialInput,
  ProviderInfoDto,
  TestResultDto,
  UpdateCredentialInput
} from "#/types/AiCredentials";
import CredentialFormModal from "../index";

vi.mock("#/hooks/useAiCredentials");

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

const existing: AiCredentialDto = {
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

const VALID_KEY = "sk-abcdefghijklmnop9876";

const createSpy = vi.fn();
const updateSpy = vi.fn();
const testSpy = vi.fn();

/** Only `mutateAsync` and `isPending` are read by the component under test. */
function asMutation<TData, TVars>(
  mutateAsync: typeof createSpy,
  isPending = false
) {
  return { mutateAsync, isPending } as unknown as UseMutationResult<
    TData,
    Error,
    TVars
  >;
}

function setup(credential: AiCredentialDto | null, onSaved = vi.fn()) {
  vi.mocked(useProviders).mockReturnValue({
    data: providers,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null
  } as UseQueryResult<Array<ProviderInfoDto>>);
  vi.mocked(useCreateCredential).mockReturnValue(
    asMutation<AiCredentialDto, CreateCredentialInput>(createSpy)
  );
  vi.mocked(useUpdateCredential).mockReturnValue(
    asMutation<AiCredentialDto, { id: string; input: UpdateCredentialInput }>(
      updateSpy
    )
  );
  vi.mocked(useTestCredential).mockReturnValue(
    asMutation<TestResultDto, string>(testSpy)
  );

  render(
    <CredentialFormModal
      open
      credential={credential}
      onClose={vi.fn()}
      onSaved={onSaved}
    />
  );
}

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValidForm() {
  typeInto("Name", "Mine");
  typeInto("API key", VALID_KEY);
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

const okResult: TestResultDto = {
  status: "ok",
  chat: "ok",
  embed: "ok",
  testedAt: "2026-08-08T00:00:00.000Z"
};

describe("CredentialFormModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSpy.mockResolvedValue(existing);
    updateSpy.mockResolvedValue(existing);
    testSpy.mockResolvedValue(okResult);
  });

  it("rejects a key shorter than 20 characters without calling the API", async () => {
    setup(null);
    typeInto("Name", "Mine");
    typeInto("API key", "x".repeat(19));
    save();

    expect(
      await screen.findByText("The key must be at least 20 characters")
    ).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects a key containing whitespace", async () => {
    setup(null);
    typeInto("Name", "Mine");
    typeInto("API key", "sk-with a space 12345678");
    save();

    expect(await screen.findByText("No spaces allowed")).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("requires a key when creating but not when editing", async () => {
    setup(null);
    typeInto("Name", "Mine");
    save();
    expect(
      await screen.findByText("This field is required")
    ).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("omits apiKey when editing and the key field is left blank", async () => {
    setup(existing);
    typeInto("Name", "Renamed");
    save();

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const [{ input }] = updateSpy.mock.calls[0] as [
      { input: Record<string, unknown> }
    ];
    expect(input.apiKey).toBeUndefined();
    expect(input.label).toBe("Renamed");
  });

  it("shows the provider default as the model placeholder", () => {
    setup(null);
    expect(screen.getByLabelText("Chat model")).toHaveAttribute(
      "placeholder",
      "openai/gpt-4o-mini"
    );
    expect(screen.getByLabelText("Embedding model")).toHaveAttribute(
      "placeholder",
      "openai/text-embedding-3-small"
    );
  });

  it("reports chat and embeddings separately after saving", async () => {
    testSpy.mockResolvedValue({
      status: "model_unavailable",
      chat: "ok",
      embed: "model_unavailable",
      testedAt: "2026-08-08T00:00:00.000Z"
    });
    setup(null);
    fillValidForm();
    save();

    expect(await screen.findByText("Chat: Tested OK")).toBeInTheDocument();
    expect(
      await screen.findByText("Embeddings: Model unavailable")
    ).toBeInTheDocument();
  });

  it("surfaces a 409 on the label field rather than as a generic failure", async () => {
    createSpy.mockRejectedValue(new ApiError(409, "duplicate"));
    setup(null);
    fillValidForm();
    save();

    expect(
      await screen.findByText("You already have a credential with this name")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Could not save the credential")
    ).not.toBeInTheDocument();
  });

  it("hands the saved credential back so a caller can select it", async () => {
    const onSaved = vi.fn();
    setup(null, onSaved);
    fillValidForm();
    save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(existing));
  });

  it("never pre-fills the key when editing", () => {
    setup(existing);
    expect(screen.getByLabelText("API key")).toHaveValue("");
  });

  it("locks the provider when editing", () => {
    setup(existing);
    expect(
      screen.getByText(
        "Provider cannot be changed. Create another credential to switch."
      )
    ).toBeInTheDocument();
  });
});
