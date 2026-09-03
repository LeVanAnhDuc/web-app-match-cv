import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SectionCard from "../index";

describe("SectionCard", () => {
  it("render eyebrow bằng text-muted, không phải text-faint", () => {
    render(
      <SectionCard eyebrow="Lịch sử" title="Ghép gần đây">
        body
      </SectionCard>
    );

    const eyebrow = screen.getByText("Lịch sử");
    expect(eyebrow.className).toContain("text-muted");
    expect(eyebrow.className).not.toContain("text-faint");
    expect(eyebrow.className).toContain("uppercase");
  });

  it("header xếp dọc ở mobile và thành hàng từ md", () => {
    render(
      <SectionCard title="T" extra={<button>A</button>}>
        body
      </SectionCard>
    );

    const header = screen
      .getByRole("heading", { level: 2 })
      .closest("div")?.parentElement;
    expect(header?.className).toContain("flex-col");
    expect(header?.className).toContain("md:flex-row");
    expect(header?.className).toContain("md:justify-between");
  });

  it("khối extra được co và wrap, không shrink-0", () => {
    render(
      <SectionCard title="T" extra={<button>A</button>}>
        body
      </SectionCard>
    );

    const extra = screen.getByRole("button", { name: "A" }).parentElement;
    expect(extra?.className).toContain("flex-wrap");
    expect(extra?.className).not.toContain("shrink-0");
  });

  it("không render header khi không có title, eyebrow lẫn extra", () => {
    render(<SectionCard>body</SectionCard>);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
