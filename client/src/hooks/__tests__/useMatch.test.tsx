import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { useMatchHistory, useMatchResult, useRunMatch } from "#/hooks/useMatch";
import type { MatchResultDto, MatchSummaryDto } from "#/types/Matching";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const sampleResult: MatchResultDto = {
  id: "match-1",
  cvDocumentId: "cv-1",
  jdDocumentId: "jd-1",
  overallScore: 75,
  semanticScore: 88,
  keywordScore: 62,
  report: {
    strengths: ["Figma mastery"],
    gaps: ["Accessibility standards"],
    suggestions: ["Quantify design impact with metrics."]
  },
  credentialId: null,
  runId: null,
  status: "succeeded",
  errorCode: null,
  provider: "openrouter",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small",
  createdAt: "2023-10-12T00:00:00.000Z"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useRunMatch", () => {
  it("POSTs {cvDocumentId, jdDocumentId} and returns the MatchResultDto", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({ ok: true, status: 201, json: async () => sampleResult }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRunMatch(), {
      wrapper: createWrapper()
    });

    result.current.mutate({ cvDocumentId: "cv-1", jdDocumentId: "jd-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleResult);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/match");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      cvDocumentId: "cv-1",
      jdDocumentId: "jd-1"
    });
  });

  it("rejects with the server message on a non-2xx response (e.g. 503 OpenRouter unavailable)", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          json: async () => ({
            message: "AI matching is temporarily unavailable"
          })
        }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRunMatch(), {
      wrapper: createWrapper()
    });
    result.current.mutate({ cvDocumentId: "cv-1", jdDocumentId: "jd-1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "AI matching is temporarily unavailable"
    );
  });
});

describe("useMatchResult", () => {
  it("GETs /match/:id and returns the MatchResultDto", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({ ok: true, status: 200, json: async () => sampleResult }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMatchResult("match-1"), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleResult);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/match/match-1"),
      undefined
    );
  });

  it("stays disabled (no fetch) when id is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMatchResult(null), {
      wrapper: createWrapper()
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useMatchHistory", () => {
  it("GETs /match and returns the MatchSummaryDto list, newest-first", async () => {
    const history: Array<MatchSummaryDto> = [
      {
        id: "match-2",
        cvTitle: "Resume",
        jdTitle: "Senior Product Designer",
        overallScore: 82,
        createdAt: "2023-10-13T00:00:00.000Z"
      },
      {
        id: "match-1",
        cvTitle: "Resume",
        jdTitle: "Marketing Manager",
        overallScore: 61,
        createdAt: "2023-10-12T00:00:00.000Z"
      }
    ];
    const fetchMock = vi.fn(
      async () =>
        ({ ok: true, status: 200, json: async () => history }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMatchHistory(), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(history);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/match"),
      undefined
    );
  });
});
