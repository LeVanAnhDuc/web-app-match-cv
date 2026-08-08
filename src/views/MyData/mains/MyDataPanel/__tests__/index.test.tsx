import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { downloadMyData } from "#/requests/myData";
import MyDataPanel from "../index";

vi.mock("#/requests/myData", () => ({
  downloadMyData: vi.fn()
}));

const mockedDownloadMyData = vi.mocked(downloadMyData);

/** Resolves/rejects on demand, so a test can assert the in-flight state. */
function deferred<T>() {
  let outerResolve!: (value: T) => void;
  let outerReject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    outerResolve = resolve;
    outerReject = reject;
  });
  return { promise, resolve: outerResolve, reject: outerReject };
}

describe("MyDataPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title, description and all three contents items", () => {
    render(<MyDataPanel />);

    expect(
      screen.getByRole("heading", { level: 1, name: "My data" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Download a copy of everything this app stores about you."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your CV and job description files/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Every match you have run/)).toBeInTheDocument();
    expect(screen.getByText(/Your AI credential settings/)).toBeInTheDocument();
  });

  it("calls downloadMyData once on click and disables the button while pending", async () => {
    const { promise, resolve } = deferred<void>();
    mockedDownloadMyData.mockReturnValue(promise);

    render(<MyDataPanel />);
    const button = screen.getByRole("button", { name: "Download my data" });
    fireEvent.click(button);

    expect(mockedDownloadMyData).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button).toBeDisabled());

    resolve();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("does not call downloadMyData a second time when clicked again while pending", async () => {
    const { promise, resolve } = deferred<void>();
    mockedDownloadMyData.mockReturnValue(promise);

    render(<MyDataPanel />);
    const button = screen.getByRole("button", { name: "Download my data" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    fireEvent.click(button);

    expect(mockedDownloadMyData).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("shows an alert and re-enables the button when the download fails", async () => {
    const { promise, reject } = deferred<void>();
    mockedDownloadMyData.mockReturnValue(promise);

    render(<MyDataPanel />);
    const button = screen.getByRole("button", { name: "Download my data" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());

    reject(new Error("network error"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not prepare your archive. Please try again."
    );
    expect(button).not.toBeDisabled();
  });

  it("shows the success message when the download resolves", async () => {
    mockedDownloadMyData.mockResolvedValue(undefined);

    render(<MyDataPanel />);
    const button = screen.getByRole("button", { name: "Download my data" });
    fireEvent.click(button);

    expect(
      await screen.findByText("Your archive has been downloaded.")
    ).toBeInTheDocument();
  });
});
