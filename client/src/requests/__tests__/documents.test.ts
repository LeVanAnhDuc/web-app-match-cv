import { afterEach, describe, expect, it, vi } from "vitest";
import { documentFileUrl, fetchDocumentFile } from "#/requests/documents";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("documentFileUrl", () => {
  it("builds the full URL from VITE_API_BASE_URL, inline by default", () => {
    expect(documentFileUrl("jd-1")).toBe(
      "http://localhost:5200/api/v1/documents/jd-1/file"
    );
  });

  it("appends ?download=1 when download is requested", () => {
    expect(documentFileUrl("jd-1", true)).toBe(
      "http://localhost:5200/api/v1/documents/jd-1/file?download=1"
    );
  });
});

describe("fetchDocumentFile", () => {
  it("GETs the file endpoint through apiFetchBinary and resolves with the ArrayBuffer", async () => {
    const buffer = new ArrayBuffer(4);
    const fetchMock = vi.fn(
      async () =>
        ({ ok: true, status: 200, arrayBuffer: async () => buffer }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDocumentFile("jd-1");

    expect(result).toBe(buffer);
    // Routed through apiFetchBinary → same base URL, no ad-hoc credentials flag.
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:5200/api/v1/documents/jd-1/file"
    );
  });

  it("throws an ApiError with the response status on a non-2xx response", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 404 }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDocumentFile("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404
    });
  });
});
