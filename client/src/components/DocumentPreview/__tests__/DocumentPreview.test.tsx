import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { pdfjs } from "react-pdf";
import { fetchDocumentFile } from "#/requests/documents";
import DocumentPreview from "../index";

vi.mock("#/requests/documents", () => ({
  fetchDocumentFile: vi.fn()
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "/assets/pdf.worker.min-hashed.mjs"
}));

// Page count the mocked pdf.js reports once the document has loaded.
const pdfPages = vi.hoisted(() => ({ count: 1 }));

vi.mock("react-pdf", async () => {
  const { useEffect } = await import("react");
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({
      children,
      onLoadSuccess
    }: {
      children?: React.ReactNode;
      onLoadSuccess?: (pdf: { numPages: number }) => void;
    }) => {
      useEffect(() => {
        onLoadSuccess?.({ numPages: pdfPages.count });
      }, [onLoadSuccess]);
      return <div data-testid="mock-react-pdf-document">{children}</div>;
    },
    Page: ({ pageNumber }: { pageNumber: number }) => (
      <div data-testid="mock-react-pdf-page" data-page={pageNumber} />
    )
  };
});

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined)
}));

const mockedFetchDocumentFile = vi.mocked(fetchDocumentFile);

describe("DocumentPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfPages.count = 1;
  });

  it("pdf — renders every page, not just the first", async () => {
    pdfPages.count = 3;
    mockedFetchDocumentFile.mockResolvedValue(new ArrayBuffer(8));

    render(<DocumentPreview docId="doc-7" sourceFormat="pdf" rawText="" />);

    const pages = await screen.findAllByTestId("mock-react-pdf-page");
    await waitFor(() =>
      expect(screen.getAllByTestId("mock-react-pdf-page")).toHaveLength(3)
    );
    expect(pages[0].getAttribute("data-page")).toBe("1");
    expect(
      screen
        .getAllByTestId("mock-react-pdf-page")
        .map((page) => page.getAttribute("data-page"))
    ).toEqual(["1", "2", "3"]);
  });

  it("text — renders rawText directly, no fetch", () => {
    render(
      <DocumentPreview docId="doc-1" sourceFormat="text" rawText="hello" />
    );

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(mockedFetchDocumentFile).not.toHaveBeenCalled();
  });

  it("pdf — fetches the file and renders the mocked react-pdf Document/Page", async () => {
    mockedFetchDocumentFile.mockResolvedValue(new ArrayBuffer(8));

    render(<DocumentPreview docId="doc-2" sourceFormat="pdf" rawText="" />);

    await waitFor(() =>
      expect(mockedFetchDocumentFile).toHaveBeenCalledWith("doc-2")
    );
    expect(
      await screen.findByTestId("mock-react-pdf-document")
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-react-pdf-page")).toBeInTheDocument();
  });

  it("pdf — points the pdf.js worker at the URL Vite emits for the bundled worker", async () => {
    mockedFetchDocumentFile.mockResolvedValue(new ArrayBuffer(8));

    render(<DocumentPreview docId="doc-6" sourceFormat="pdf" rawText="" />);

    await screen.findByTestId("mock-react-pdf-document");
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toBe(
      "/assets/pdf.worker.min-hashed.mjs"
    );
  });

  it("docx — fetches the file and triggers docx-preview renderAsync", async () => {
    mockedFetchDocumentFile.mockResolvedValue(new ArrayBuffer(8));
    const { renderAsync } = await import("docx-preview");

    render(<DocumentPreview docId="doc-3" sourceFormat="docx" rawText="" />);

    await waitFor(() =>
      expect(mockedFetchDocumentFile).toHaveBeenCalledWith("doc-3")
    );
    await waitFor(() => expect(renderAsync).toHaveBeenCalled());
  });

  it("pdf — shows an error message when the file fetch fails", async () => {
    mockedFetchDocumentFile.mockRejectedValue(new Error("network error"));

    render(<DocumentPreview docId="doc-4" sourceFormat="pdf" rawText="" />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("docx — shows an error message when renderAsync fails", async () => {
    mockedFetchDocumentFile.mockResolvedValue(new ArrayBuffer(8));
    const { renderAsync } = await import("docx-preview");
    vi.mocked(renderAsync).mockRejectedValueOnce(new Error("bad docx"));

    render(<DocumentPreview docId="doc-5" sourceFormat="docx" rawText="" />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
