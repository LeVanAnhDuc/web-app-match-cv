import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import "#/i18n/config";
import { useSavedDocuments } from "#/hooks/useDocuments";
import { useMatchHistory } from "#/hooks/useMatch";
import type { DocumentSummaryDto } from "#/types/Documents";
import type { MatchSummaryDto } from "#/types/Matching";
import Home from "../index";

vi.mock("#/hooks/useDocuments");
vi.mock("#/hooks/useMatch");

function renderHome() {
  const rootRoute = createRootRoute({ component: Home });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  return render(<RouterProvider router={router} />);
}

function asQueryResult<T>(
  data: T | undefined,
  isLoading = false
): UseQueryResult<T> {
  return { data, isLoading, isError: false, error: null } as UseQueryResult<T>;
}

const cvDocs: Array<DocumentSummaryDto> = [
  {
    id: "cv-1",
    kind: "CV",
    title: "Resume",
    sourceFormat: "pdf",
    parentId: null,
    createdAt: "2023-10-10T00:00:00.000Z"
  },
  {
    id: "cv-2",
    kind: "CV",
    title: "Resume 2",
    sourceFormat: "pdf",
    parentId: null,
    createdAt: "2023-10-11T00:00:00.000Z"
  }
];

const jdDocs: Array<DocumentSummaryDto> = [
  {
    id: "jd-1",
    kind: "JD",
    title: "Senior Frontend Engineer",
    sourceFormat: "text",
    parentId: null,
    createdAt: "2023-10-09T00:00:00.000Z"
  }
];

const matchHistory: Array<MatchSummaryDto> = [
  {
    id: "match-1",
    cvTitle: "Resume",
    jdTitle: "Senior Frontend Engineer",
    overallScore: 80,
    createdAt: "2023-10-12T00:00:00.000Z"
  },
  {
    id: "match-2",
    cvTitle: "Resume",
    jdTitle: "Product Manager",
    overallScore: 60,
    createdAt: "2023-10-11T00:00:00.000Z"
  },
  {
    id: "match-3",
    cvTitle: "Resume 2",
    jdTitle: "Junior Designer",
    overallScore: 40,
    createdAt: "2023-10-10T00:00:00.000Z"
  }
];

function mockHooks({
  cv = cvDocs,
  jd = jdDocs,
  matches = matchHistory
}: {
  cv?: Array<DocumentSummaryDto>;
  jd?: Array<DocumentSummaryDto>;
  matches?: Array<MatchSummaryDto>;
} = {}) {
  vi.mocked(useSavedDocuments).mockImplementation((kind) =>
    asQueryResult(kind === "CV" ? cv : jd)
  );
  vi.mocked(useMatchHistory).mockReturnValue(asQueryResult(matches));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Home", () => {
  it("renders the hero CTA as a link to /wizard", async () => {
    mockHooks();
    renderHome();

    const link = await screen.findByRole("link", {
      name: /start matching now/i
    });
    expect(link).toHaveAttribute("href", "/wizard");
  });

  it("renders 4 statistics with the mocked counts", async () => {
    mockHooks();
    renderHome();

    expect(
      within(await screen.findByTestId("home-stat-saved-cvs")).getByText("2")
    ).toBeDefined();
    expect(
      within(screen.getByTestId("home-stat-saved-jds")).getByText("1")
    ).toBeDefined();
    expect(
      within(screen.getByTestId("home-stat-total-matches")).getByText("3")
    ).toBeDefined();
    const highestCard = screen.getByTestId("home-stat-highest");
    expect(within(highestCard).getByText("80%")).toBeDefined();
    expect(within(highestCard).getByText(/avg 60%/i)).toBeDefined();
  });

  it("shows 0 saved counts and a — highest score when there is no data", async () => {
    mockHooks({ cv: [], jd: [], matches: [] });
    renderHome();

    expect(
      within(await screen.findByTestId("home-stat-saved-cvs")).getByText("0")
    ).toBeDefined();
    expect(
      within(screen.getByTestId("home-stat-saved-jds")).getByText("0")
    ).toBeDefined();
    expect(
      within(screen.getByTestId("home-stat-total-matches")).getByText("0")
    ).toBeDefined();
    expect(
      within(screen.getByTestId("home-stat-highest")).getByText("—")
    ).toBeDefined();
  });

  it("renders recent match rows with band-colored score tags", async () => {
    mockHooks();
    renderHome();

    expect(await screen.findByText("Senior Frontend Engineer")).toBeDefined();
    expect(screen.getByText("Product Manager")).toBeDefined();
    expect(screen.getByText("Junior Designer")).toBeDefined();

    const highTag = screen.getByTestId("home-score-match-1");
    expect(highTag).toHaveTextContent("80%");
    expect(highTag).toHaveClass("ant-tag-success");

    const midTag = screen.getByTestId("home-score-match-2");
    expect(midTag).toHaveTextContent("60%");
    expect(midTag).toHaveClass("ant-tag-warning");

    const lowTag = screen.getByTestId("home-score-match-3");
    expect(lowTag).toHaveTextContent("40%");
    expect(lowTag).toHaveClass("ant-tag-error");
  });

  it("shows the empty state with a Match now CTA when there is no match history", async () => {
    mockHooks({ matches: [] });
    renderHome();

    expect(await screen.findByText(/no matches yet/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /match now/i })).toBeDefined();
  });

  describe("console output", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("renders without console errors", async () => {
      mockHooks();
      renderHome();
      await screen.findByRole("link", { name: /start matching now/i });
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
