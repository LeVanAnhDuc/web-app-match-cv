import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import UploadPasteTabs from "../index";

function renderTabs(mode: "upload" | "paste") {
  return render(
    <UploadPasteTabs
      mode={mode}
      onModeChange={vi.fn()}
      file={null}
      onFileChange={vi.fn()}
      pastedText=""
      onPastedTextChange={vi.fn()}
      maxSizeLabel="5MB"
    />
  );
}

const hasMargin = (el: Element) => /(^|\s)(md:)?mb-\d/.test(el.className);

// design §6.4: antd's cssinjs sets `margin: 0` on `.ant-segmented` and beats a
// Tailwind `mb-*`, so the tabs sat flush against the drop zone. The spacing has
// to come from a flex gap on the wrapper, which nothing in antd overrides.
describe("UploadPasteTabs spacing", () => {
  it("spaces the tabs from the drop zone with a flex gap, not margins", () => {
    const { container } = renderTabs("upload");

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("flex", "flex-col", "gap-4");
    expect(hasMargin(root)).toBe(false);

    const segmented = container.querySelector(".ant-segmented")!;
    expect(hasMargin(segmented)).toBe(false);
    const dragger = container.querySelector(".ant-upload-wrapper")!;
    expect(hasMargin(dragger)).toBe(false);
  });

  it("keeps the paste box margin-free too", () => {
    const { container } = renderTabs("paste");

    expect(hasMargin(container.querySelector("textarea")!)).toBe(false);
  });

  it("uses a large pill whose items are 40px tall", () => {
    const { container } = renderTabs("upload");

    const segmented = container.querySelector(".ant-segmented")!;
    expect(segmented).toHaveClass("ant-segmented-lg");
    expect(segmented.className).toContain(
      "[&_.ant-segmented-item-label]:!min-h-10"
    );
    expect(segmented.className).toContain(
      "[&_.ant-segmented-item-label]:!leading-10"
    );
  });
});
