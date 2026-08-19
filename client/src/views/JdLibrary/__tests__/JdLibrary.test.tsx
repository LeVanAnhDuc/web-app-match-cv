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
import type { DocumentDto, DocumentSummaryDto } from "#/types/Documents";
import JdLibrary from "../index";

vi.mock("#/hooks/useDocuments");
vi.mock("#/components/DocumentPreview", () => ({
  default: () => <div data-testid="doc-preview" />
}));

async function renderLibrary() {
  const rootRoute = createRootRoute({
    component: () => <JdLibrary />
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
    id: "jd-1",
    kind: "JD",
    title: "Senior Node Engineer",
    sourceFormat: "text",
    parentId: null,
    createdAt: "2023-10-10T00:00:00.000Z"
  }
];

const fullDoc: DocumentDto = {
  id: "jd-1",
  kind: "JD",
  title: "Senior Node Engineer",
  sourceFormat: "text",
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

describe("JdLibrary", () => {
  it("asks for the saved JDs and titles the page accordingly", async () => {
    await renderLibrary();
    expect(vi.mocked(useSavedDocuments)).toHaveBeenCalledWith("JD");
    expect(
      screen.getByRole("heading", { name: "Job Descriptions" })
    ).toBeDefined();
    expect(screen.getByText("1 saved")).toBeDefined();
  });

  it("renders a row per saved JD, without a download for pasted text", async () => {
    await renderLibrary();
    expect(screen.getByText("Senior Node Engineer")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Preview" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Rename" })).toHaveLength(1);
    // sourceFormat "text" has no original file to download
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("never offers version comparison, even on a JD that has a parent", async () => {
    // Comparison is CV-only server-side (400 notCv), so the JD library must
    // not surface the action at all.
    vi.mocked(useSavedDocuments).mockReturnValue(
      asQuery([{ ...docs[0], parentId: "jd-0" }])
    );
    await renderLibrary();
    expect(
      screen.queryByRole("button", { name: "Compare versions" })
    ).toBeNull();
  });

  it("shows the JD empty state with a CTA when nothing is saved", async () => {
    vi.mocked(useSavedDocuments).mockReturnValue(asQuery([]));
    await renderLibrary();
    expect(screen.getByText("No saved JDs yet")).toBeDefined();
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
    expect(screen.queryByText("No saved JDs yet")).toBeNull();
  });

  it("deletes a JD after confirming the popconfirm", async () => {
    await renderLibrary();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    // Popconfirm confirm button carries visible text "Delete" (icon button has none)
    const confirm = await screen.findByText("Delete");
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith("jd-1", expect.anything())
    );
  });
});
