import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageContainer from "../index";

describe("PageContainer", () => {
  it("applies the shared page frame classes", () => {
    render(<PageContainer>body</PageContainer>);

    const frame = screen.getByText("body");
    expect(frame.className).toContain("mx-auto");
    expect(frame.className).toContain("max-w-[1600px]");
    expect(frame.className).toContain("p-4");
    expect(frame.className).toContain("md:p-6");
  });

  it("appends caller classes after the frame classes", () => {
    render(<PageContainer className="space-y-6">body</PageContainer>);

    expect(screen.getByText("body").className).toContain("space-y-6");
  });
});
