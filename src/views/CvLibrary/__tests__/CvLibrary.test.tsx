import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import {
  useDeleteDocument,
  useDocument,
  useRenameDocument,
  useSavedDocuments,
  useSetDocumentParent
} from "#/hooks/useDocuments";
import { ApiError } from "#/libs/api";
import type { DocumentDto, DocumentSummaryDto } from "#/types/Documents";
import CvLibrary from "../index";

vi.mock("#/hooks/useDocuments");
vi.mock("#/components/DocumentPreview", () => ({
  default: () => <div data-testid="doc-preview" />
}));

async function renderLibrary() {
  const rootRoute = createRootRoute({
    component: () => <CvLibrary />
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  const result = render(<RouterProvider router={router} />);
  // RouterProvider resolves the route asynchronously — wait for first paint.
  await screen.findByRole("heading");
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
    error: null,
    ...over
  } as UseQueryResult<T>;
}

const renameSpy = vi.fn();
const deleteSpy = vi.fn();
const lineageSpy = vi.fn();

const docs: Array<DocumentSummaryDto> = [
  {
    id: "cv-1",
    kind: "CV",
    title: "Backend Resume",
    sourceFormat: "pdf",
    parentId: null,
    createdAt: "2023-10-10T00:00:00.000Z"
  },
  {
    id: "cv-2",
    kind: "CV",
    title: "Frontend Resume",
    sourceFormat: "docx",
    parentId: null,
    createdAt: "2023-10-11T00:00:00.000Z"
  }
];

const fullDoc: DocumentDto = {
  id: "cv-1",
  kind: "CV",
  title: "Backend Resume",
  sourceFormat: "pdf",
  rawText: "hello",
  isSaved: true,
  parentId: null,
  createdAt: "2023-10-10T00:00:00.000Z"
};

beforeEach(() => {
  renameSpy.mockReset();
  deleteSpy.mockReset();
  lineageSpy.mockReset();
  lineageSpy.mockResolvedValue(fullDoc);
  vi.mocked(useSetDocumentParent).mockReturnValue({
    mutateAsync: lineageSpy,
    isPending: false
  } as unknown as ReturnType<typeof useSetDocumentParent>);
  vi.mocked(useSavedDocuments).mockReturnValue(asQuery(docs));
  vi.mocked(useDocument).mockReturnValue(asQuery(fullDoc));
  vi.mocked(useRenameDocument).mockReturnValue({
    mutate: renameSpy,
    isPending: false
  } as unknown as ReturnType<typeof useRenameDocument>);
  vi.mocked(useDeleteDocument).mockReturnValue({
    mutate: deleteSpy,
    isPending: false
  } as unknown as ReturnType<typeof useDeleteDocument>);
});

describe("CvLibrary", () => {
  it("asks for the saved CVs and titles the page accordingly", async () => {
    await renderLibrary();
    expect(vi.mocked(useSavedDocuments)).toHaveBeenCalledWith("CV");
    expect(
      screen.getByRole("heading", { name: "Curriculum Vitae" })
    ).toBeDefined();
  });

  it("renders a row per saved document with its actions", async () => {
    await renderLibrary();
    expect(screen.getByText("Backend Resume")).toBeDefined();
    expect(screen.getByText("Frontend Resume")).toBeDefined();
    // pdf doc → download present, docx too; text would hide it
    expect(screen.getAllByRole("button", { name: "Preview" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Mark as a new version of…" })
    ).toHaveLength(2);
    // antd Button with href renders an <a> → role "link", not "button"
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(2);
  });

  it("only offers the comparison on a document that has a previous version", async () => {
    const { unmount } = await renderLibrary();
    // Both fixtures are originals — there is nothing to compare them with.
    expect(
      screen.queryByRole("button", { name: "Compare versions" })
    ).toBeNull();
    // Unmounted before the second render: two live trees would double every
    // query in this file.
    unmount();

    vi.mocked(useSavedDocuments).mockReturnValue(
      asQuery([{ ...docs[0], parentId: "cv-0" }, docs[1]])
    );
    await renderLibrary();

    expect(
      screen.getAllByRole("button", { name: "Compare versions" })
    ).toHaveLength(1);
  });

  it("declares a previous version through the lineage modal", async () => {
    await renderLibrary();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark as a new version of…" })[0]
    );

    const select = await screen.findByRole("combobox", {
      name: "Previous version"
    });
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByTitle("Frontend Resume"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(lineageSpy).toHaveBeenCalledWith({ id: "cv-1", parentId: "cv-2" })
    );
  });

  it("keeps the lineage modal open and reports why a link was rejected", async () => {
    lineageSpy.mockRejectedValue(new ApiError(400, "cycle"));
    await renderLibrary();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark as a new version of…" })[0]
    );

    const select = await screen.findByRole("combobox", {
      name: "Previous version"
    });
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByTitle("Frontend Resume"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/isn't allowed/)).toBeDefined();
  });

  it("shows an empty state with a CTA when there are no saved documents", async () => {
    vi.mocked(useSavedDocuments).mockReturnValue(asQuery([]));
    await renderLibrary();
    expect(screen.getByText("No saved CVs yet")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Start matching" })
    ).toBeDefined();
  });

  it("reports a failed load instead of an empty library", async () => {
    vi.mocked(useSavedDocuments).mockReturnValue(
      asQuery<Array<DocumentSummaryDto>>(undefined, { isError: true })
    );
    await renderLibrary();
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("No saved CVs yet")).toBeNull();
  });

  it("opens the preview modal rendering DocumentPreview", async () => {
    await renderLibrary();
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]);
    expect(await screen.findByTestId("doc-preview")).toBeDefined();
  });

  it("renames a document through the rename modal", async () => {
    await renderLibrary();
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    const input = await screen.findByDisplayValue("Backend Resume");
    fireEvent.change(input, { target: { value: "Renamed CV" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(renameSpy).toHaveBeenCalledWith(
      { id: "cv-1", title: "Renamed CV" },
      expect.anything()
    );
  });

  it("deletes a document after confirming the popconfirm", async () => {
    await renderLibrary();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    // Popconfirm confirm button carries visible text "Delete" (icon button has none)
    const confirm = await screen.findByText("Delete");
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith("cv-1", expect.anything())
    );
  });
});
