import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import type { DocumentSummaryDto } from "#/types/Documents";
import DocumentLineageModal from "../index";

const doc: DocumentSummaryDto = {
  id: "cv-2",
  kind: "CV",
  title: "Backend Resume (improved)",
  sourceFormat: "text",
  parentId: null,
  createdAt: "2026-08-09T00:00:00.000Z"
};

describe("DocumentLineageModal", () => {
  it("puts focus in the Previous version select when it opens", async () => {
    render(
      <DocumentLineageModal
        open
        doc={doc}
        candidates={[doc]}
        confirmLoading={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const select = screen.getByRole("combobox", { name: "Previous version" });
    await waitFor(() => expect(document.activeElement).toBe(select));
  });
});
