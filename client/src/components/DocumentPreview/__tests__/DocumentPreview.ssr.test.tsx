// @vitest-environment node
//
// Runs in a plain Node environment (no jsdom `window`/`document`) to prove
// that importing/rendering DocumentPreview never touches a browser-only API
// at module load or during a server render — the exact failure mode
// (react-pdf/docx-preview executing during SSR) that made `yarn build` hang
// in a prior attempt. react-pdf/docx-preview are intentionally NOT mocked
// here: they must never be reached, since real SSR (renderToStaticMarkup)
// never runs effects, so a correctly-guarded component won't import them.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import DocumentPreview from "../index";

vi.mock("#/requests/documents", () => ({
  fetchDocumentFile: vi.fn()
}));

describe("DocumentPreview — SSR safety", () => {
  it("renders the text variant server-side without touching window/document", () => {
    expect(typeof window).toBe("undefined");

    const html = renderToStaticMarkup(
      <DocumentPreview docId="doc-1" sourceFormat="text" rawText="hello" />
    );

    expect(html).toContain("hello");
  });

  it("renders a pdf placeholder server-side without importing react-pdf", () => {
    const html = renderToStaticMarkup(
      <DocumentPreview docId="doc-2" sourceFormat="pdf" rawText="" />
    );

    expect(html).toContain("pdf-preview");
  });

  it("renders a docx placeholder server-side without importing docx-preview", () => {
    const html = renderToStaticMarkup(
      <DocumentPreview docId="doc-3" sourceFormat="docx" rawText="" />
    );

    expect(html).toContain("docx-preview");
  });
});
