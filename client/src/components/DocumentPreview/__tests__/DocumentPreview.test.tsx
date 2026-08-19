import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { fetchDocumentFile } from "#/requests/documents";
import DocumentPreview from "../index";

vi.mock("#/requests/documents", () => ({
  fetchDocumentFile: vi.fn()
}));

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
  Document: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-react-pdf-document">{children}</div>
  ),
  Page: () => <div data-testid="mock-react-pdf-page" />
}));

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn().mockResolvedValue(undefined)
}));

const mockedFetchDocumentFile = vi.mocked(fetchDocumentFile);

describe("DocumentPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
