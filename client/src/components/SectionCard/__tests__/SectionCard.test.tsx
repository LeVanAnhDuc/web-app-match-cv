import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SectionCard from "../index";

describe("SectionCard", () => {
  it("renders title as a level-2 heading with the shared type scale", () => {
    render(<SectionCard title="Recent matches">body</SectionCard>);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Recent matches");
    expect(heading.className).toContain("text-xl");
    expect(heading.className).toContain("font-bold");
  });

  it("omits the header when there is no title and no extra", () => {
    render(<SectionCard>body</SectionCard>);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders description, extra and footer when provided", () => {
    render(
      <SectionCard
        title="Title"
        description="Sub"
        extra={<span>Extra</span>}
        footer={<span>Foot</span>}
      >
        body
      </SectionCard>
    );

    expect(screen.getByText("Sub")).toBeDefined();
    expect(screen.getByText("Extra")).toBeDefined();
    expect(screen.getByText("Foot")).toBeDefined();
  });

  it("uses the shared surface and border tokens", () => {
    const { container } = render(<SectionCard>body</SectionCard>);

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("bg-surface");
    expect(card.className).toContain("border-line");
    expect(card.className).toContain("rounded-xl");
  });

  it("bodyClassName replaces the default body padding", () => {
    render(<SectionCard bodyClassName="p-0">body</SectionCard>);

    const body = screen.getByText("body");
    expect(body.className).toContain("p-0");
    expect(body.className).not.toContain("md:p-6");
  });

  it("fill adds the desktop internal-scroll classes", () => {
    const { container } = render(<SectionCard fill>body</SectionCard>);

    expect((container.firstElementChild as HTMLElement).className).toContain(
      "lg:h-full"
    );
    expect(screen.getByText("body").className).toContain("lg:overflow-y-auto");
  });

  it("stickyFooter pins the footer below lg only", () => {
    render(
      <SectionCard stickyFooter footer={<span>Foot</span>}>
        body
      </SectionCard>
    );

    const footer = screen.getByText("Foot").parentElement as HTMLElement;
    expect(footer.className).toContain("sticky");
    expect(footer.className).toContain("lg:static");
  });
});
