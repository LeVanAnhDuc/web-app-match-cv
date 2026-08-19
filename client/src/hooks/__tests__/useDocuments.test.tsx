import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import {
  useCreateDocument,
  useDeleteDocument,
  useDocument,
  useRenameDocument,
  useSavedDocuments
} from "#/hooks/useDocuments";
import type { DocumentDto, DocumentSummaryDto } from "#/types/Documents";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSavedDocuments", () => {
  it("returns the saved documents for a kind, without rawText", async () => {
    const summaries: Array<DocumentSummaryDto> = [
      {
        id: "1",
        kind: "JD",
        title: "Senior Product Designer",
        sourceFormat: "pdf",
        parentId: null,
        createdAt: "2023-10-12T00:00:00.000Z"
      }
    ];
    const fetchMock = vi.fn(
      async () =>
        ({ ok: true, status: 200, json: async () => summaries }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSavedDocuments("JD"), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summaries);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/documents?kind=JD&saved=true"),
      undefined
    );
  });
});

describe("useCreateDocument", () => {
  it("creates a document from pasted text as a JSON body", async () => {
    const dto: DocumentDto = {
      id: "2",
      kind: "JD",
      title: "Marketing Manager",
      sourceFormat: "text",
      rawText: "some jd text",
      isSaved: true,
      parentId: null,
      createdAt: "2023-10-12T00:00:00.000Z"
    };
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 201, json: async () => dto }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateDocument(), {
      wrapper: createWrapper()
    });

    result.current.mutate({
      mode: "paste",
      kind: "JD",
      sourceText: "some jd text",
      save: true,
      title: "Marketing Manager"
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dto);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/documents");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      kind: "JD",
      sourceText: "some jd text",
      save: true,
      title: "Marketing Manager"
    });
  });

  it("creates a document from a file as multipart FormData", async () => {
    const dto: DocumentDto = {
      id: "3",
      kind: "CV",
      title: "Resume",
      sourceFormat: "pdf",
      rawText: "parsed text",
      isSaved: false,
      parentId: null,
      createdAt: "2023-10-12T00:00:00.000Z"
    };
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 201, json: async () => dto }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["%PDF-1.4"], "resume.pdf", {
      type: "application/pdf"
    });
    const { result } = renderHook(() => useCreateDocument(), {
      wrapper: createWrapper()
    });

    result.current.mutate({ mode: "file", kind: "CV", file, save: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("kind")).toBe("CV");
    expect(body.get("save")).toBe("false");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("rejects with the server message on a non-2xx response", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({ message: "Only PDF or DOCX files are allowed" })
        }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCreateDocument(), {
      wrapper: createWrapper()
    });
    result.current.mutate({
      mode: "paste",
      kind: "JD",
      sourceText: "",
      save: false
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "Only PDF or DOCX files are allowed"
    );
  });
});

describe("useDocument", () => {
  it("GETs /documents/:id and returns the DocumentDto (rawText included)", async () => {
    const dto: DocumentDto = {
      id: "jd-1",
      kind: "JD",
      title: "Senior Product Designer",
      sourceFormat: "pdf",
      rawText: "We are hiring a senior product designer.",
      isSaved: true,
      parentId: null,
      createdAt: "2023-10-12T00:00:00.000Z"
    };
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => dto }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDocument("jd-1"), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dto);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/documents/jd-1"),
      undefined
    );
  });

  it("stays disabled (no fetch) when id is null", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDocument(null), {
      wrapper: createWrapper()
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useRenameDocument", () => {
  it("PATCHes /documents/:id with a JSON {title} body and returns the DocumentDto", async () => {
    const dto: DocumentDto = {
      id: "jd-1",
      kind: "JD",
      title: "Renamed JD",
      sourceFormat: "pdf",
      rawText: "some jd text",
      isSaved: true,
      parentId: null,
      createdAt: "2023-10-12T00:00:00.000Z"
    };
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => dto }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRenameDocument(), {
      wrapper: createWrapper()
    });

    result.current.mutate({ id: "jd-1", title: "Renamed JD" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dto);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/documents/jd-1");
    expect(init.method).toBe("PATCH");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ title: "Renamed JD" });
  });
});

describe("useDeleteDocument", () => {
  it("DELETEs /documents/:id and resolves with no data on 204", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({ ok: true, status: 204, json: async () => ({}) }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: createWrapper()
    });

    result.current.mutate("jd-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ];
    expect(url).toContain("/documents/jd-1");
    expect(init.method).toBe("DELETE");
  });

  it("rejects with the server message on a 409 (used by a match)", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 409,
          statusText: "Conflict",
          json: async () => ({
            message: "Cannot delete: used in a match history."
          })
        }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: createWrapper()
    });

    result.current.mutate("jd-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe(
      "Cannot delete: used in a match history."
    );
  });
});
