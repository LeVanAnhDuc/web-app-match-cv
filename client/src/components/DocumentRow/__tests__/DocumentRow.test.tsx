import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import type { DocumentSummaryDto } from "#/types/Documents";
import DocumentRow from "../index";

const baseDoc: DocumentSummaryDto = {
  id: "doc-1",
  kind: "CV",
  title: "Alice Nguyen CV",
  sourceFormat: "pdf",
  parentId: null,
  createdAt: "2026-01-01T00:00:00.000Z"
};

function renderRow(
  doc: Partial<DocumentSummaryDto> = {},
  overrides: Partial<{
    onPreview: () => void;
    onRename: () => void;
    onDelete: () => void;
    onCompare: () => void;
    onSetLineage: () => void;
    deleting: boolean;
  }> = {}
) {
  const onPreview = overrides.onPreview ?? vi.fn();
  const onRename = overrides.onRename ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn();
  const onCompare = overrides.onCompare ?? vi.fn();
  const onSetLineage = overrides.onSetLineage ?? vi.fn();
  render(
    <ul>
      <DocumentRow
        doc={{ ...baseDoc, ...doc }}
        onPreview={onPreview}
        onRename={onRename}
        onDelete={onDelete}
        onCompare={onCompare}
        onSetLineage={onSetLineage}
        deleting={overrides.deleting ?? false}
      />
    </ul>
  );
  return { onPreview, onRename, onDelete, onCompare, onSetLineage };
}

describe("DocumentRow", () => {
  it("collapses actions into a single menu, not six row buttons", () => {
    renderRow({ parentId: "doc-0" });

    expect(screen.getByRole("button", { name: "Actions" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("opens the menu and fires the matching callback for each action", () => {
    const { onPreview, onRename, onCompare, onSetLineage } = renderRow({
      parentId: "doc-0"
    });
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Preview" }));
    expect(onPreview).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Compare versions" }));
    expect(onCompare).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Mark as a new version of…" })
    );
    expect(onSetLineage).toHaveBeenCalledTimes(1);
  });

  it("hides compare when the document has no parent", () => {
    renderRow({ parentId: null });
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(
      screen.queryByRole("menuitem", { name: "Compare versions" })
    ).toBeNull();
  });

  it("hides download when the source format is plain text", () => {
    renderRow({ sourceFormat: "text" });
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.queryByRole("menuitem", { name: "Download" })).toBeNull();
  });

  it("shows download when the source format is not plain text", () => {
    renderRow({ sourceFormat: "pdf" });
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByRole("menuitem", { name: "Download" })).toBeDefined();
  });

  it("keeps the delete confirmation: menu item opens a Popconfirm before deleting", () => {
    const { onDelete } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByText("Delete"));

    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
