import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useAiCredentials, useProviders } from "#/hooks/useAiCredentials";
import {
  useCoverLetters,
  useDeleteCoverLetter,
  useGenerateCoverLetter,
  useUpdateCoverLetter
} from "#/hooks/useCoverLetters";
import type { CoverLetterDto } from "#/types/CoverLetters";
import CoverLetterModal from "../index";

vi.mock("#/hooks/useAiCredentials");
vi.mock("#/hooks/useCoverLetters");

const MATCH_ID = "match-1";

function asQuery<T>(data: T, over: Partial<UseQueryResult<T>> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null,
    ...over
  } as UseQueryResult<T>;
}

/** Minimal mutation stand-in; the component only reads these two members. */
function asMutation(mutateAsync: unknown = vi.fn(), isPending = false): never {
  return { mutateAsync, isPending } as never;
}

const letter: CoverLetterDto = {
  id: "letter-1",
  matchResultId: MATCH_ID,
  tone: "formal",
  length: "standard",
  language: "en",
  content: "Dear hiring manager,\n\nI am writing to apply.",
  omittedRequirements: [],
  status: "succeeded",
  errorCode: null,
  edited: false,
  credentialId: null,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z"
};

function setup(
  letters: Array<CoverLetterDto>,
  over: {
    listOver?: Partial<UseQueryResult<Array<CoverLetterDto>>>;
    generate?: unknown;
    update?: unknown;
    remove?: unknown;
    generating?: boolean;
  } = {}
) {
  vi.mocked(useAiCredentials).mockReturnValue(asQuery([]));
  vi.mocked(useProviders).mockReturnValue(asQuery([]));
  vi.mocked(useCoverLetters).mockReturnValue(
    asQuery(letters, over.listOver) as ReturnType<typeof useCoverLetters>
  );
  vi.mocked(useGenerateCoverLetter).mockReturnValue(
    asMutation(over.generate, over.generating)
  );
  vi.mocked(useUpdateCoverLetter).mockReturnValue(asMutation(over.update));
  vi.mocked(useDeleteCoverLetter).mockReturnValue(asMutation(over.remove));

  return render(
    <CoverLetterModal
      open
      matchResultId={MATCH_ID}
      defaultCredentialId={null}
      onClose={vi.fn()}
    />
  );
}

describe("CoverLetterModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an empty state before anything is generated", () => {
    setup([]);
    expect(
      screen.getByText(
        "No drafts yet. Pick a tone and length, then generate one."
      )
    ).toBeInTheDocument();
  });

  it("opens the newest draft in an editable field", async () => {
    setup([letter]);
    await waitFor(() =>
      expect(screen.getByLabelText("Draft")).toHaveValue(letter.content)
    );
  });

  // The visible half of ADR #13.
  it("lists what the letter refused to claim", async () => {
    setup([{ ...letter, omittedRequirements: ["Kubernetes", "Leadership"] }]);
    await waitFor(() =>
      expect(screen.getByText("This letter does not claim")).toBeInTheDocument()
    );
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Leadership")).toBeInTheDocument();
  });

  it("hides the omissions block entirely when there are none", async () => {
    setup([letter]);
    await waitFor(() =>
      expect(screen.getByLabelText("Draft")).toBeInTheDocument()
    );
    expect(
      screen.queryByText("This letter does not claim")
    ).not.toBeInTheDocument();
  });

  it("renders a failed draft as an error, not as a blank letter", async () => {
    setup([
      {
        ...letter,
        status: "failed",
        errorCode: "no_quota",
        content: ""
      }
    ]);
    await waitFor(() =>
      expect(
        screen.getByText("This key has no quota left with the provider.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("Draft")).not.toBeInTheDocument();
  });

  it("keeps Save disabled until the text actually changes", async () => {
    setup([letter]);
    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "My own words." }
    });
    await waitFor(() => expect(save).toBeEnabled());
  });

  it("keeps Save disabled when the draft is emptied", async () => {
    setup([letter]);
    const save = await screen.findByRole("button", { name: "Save changes" });
    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "   " }
    });
    await waitFor(() => expect(save).toBeDisabled());
  });

  // Four interactions, each re-rendering an antd Segmented, is the heaviest
  // test in this file — it needs more than the 5s default once jsdom has the
  // other cases' DOM behind it.
  it("generates with the options currently selected", async () => {
    const generate = vi.fn().mockResolvedValue({ ...letter, id: "new" });
    setup([], { generate });

    fireEvent.click(screen.getByRole("radio", { name: "Friendly" }));
    fireEvent.click(screen.getByRole("radio", { name: "Short" }));
    fireEvent.click(screen.getByRole("radio", { name: "Vietnamese" }));
    fireEvent.click(screen.getByRole("button", { name: /Generate/ }));

    await waitFor(
      () =>
        expect(generate).toHaveBeenCalledWith({
          matchResultId: MATCH_ID,
          tone: "friendly",
          length: "short",
          language: "vi",
          credentialId: undefined
        }),
      { timeout: 15_000 }
    );
  }, 30_000);

  it("switching drafts loads that draft's own text", async () => {
    const second: CoverLetterDto = {
      ...letter,
      id: "letter-2",
      tone: "friendly",
      length: "short",
      language: "vi",
      content: "Kính gửi nhà tuyển dụng,"
    };
    setup([letter, second]);

    await waitFor(() =>
      expect(screen.getByLabelText("Draft")).toHaveValue(letter.content)
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Friendly · Short · Vietnamese" })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Draft")).toHaveValue(second.content)
    );
  });

  it("marks a hand-edited draft in the list", () => {
    setup([{ ...letter, edited: true }]);
    expect(screen.getByText("Edited")).toBeInTheDocument();
  });

  it("keeps the typed text when saving fails", async () => {
    const update = vi.fn().mockRejectedValue(new Error("boom"));
    setup([letter], { update });

    const field = await screen.findByLabelText("Draft");
    fireEvent.change(field, { target: { value: "My own words." } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Could not save your changes. Your text is still here — try again."
        )
      ).toBeInTheDocument()
    );
    expect(field).toHaveValue("My own words.");
  });

  it("reports a failed list load instead of showing nothing", () => {
    setup([], {
      listOver: { isError: true, isLoading: false, data: undefined }
    });
    expect(screen.getByText("Could not load your drafts.")).toBeInTheDocument();
  });

  it("marks the draft region busy while generating", () => {
    setup([], { generating: true });
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
