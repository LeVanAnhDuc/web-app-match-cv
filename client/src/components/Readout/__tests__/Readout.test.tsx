import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "#/i18n/config";
import Readout from "../index";

describe("Readout", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("vi");
  });

  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("biến thể plain KHÔNG vẽ thang — số đếm không có dải 0-100", () => {
    render(<Readout label="Sơ yếu lý lịch" value={12} />);

    expect(screen.getByText("12")).toBeDefined();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.queryByText("100")).toBeNull();
  });

  it("biến thể scale vẽ thang với aria-valuenow", () => {
    render(<Readout label="Độ khớp tổng" value={73} unit="%" scale />);

    const meter = screen.getByRole("meter", { name: "Độ khớp tổng" });
    expect(meter.getAttribute("aria-valuenow")).toBe("73");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("số dùng mono + tabular-nums", () => {
    render(<Readout label="L" value={73} unit="%" />);

    const el = screen.getByText("73");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("tabular-nums");
  });

  it("label là eyebrow text-muted, không bao giờ text-faint", () => {
    render(<Readout label="Độ khớp tổng" value={73} />);

    const label = screen.getByText("Độ khớp tổng");
    expect(label.className).toContain("text-muted");
    expect(label.className).not.toContain("text-faint");
  });

  // Nhãn thang "0" / "100" là CHỮ, nên `faint` (zinc-500) bị cấm ở đây y như ở
  // eyebrow: trên nền dark nó chỉ đạt 3.67:1, dưới ngưỡng NFR-A11Y-01 (4.5:1).
  // Cỡ chữ phải là vai trò `text-xs` của MASTER §3, không phải một giá trị tuỳ ý.
  it("nhãn thang dùng text-muted và cỡ text-xs, không faint, không cỡ tuỳ ý", () => {
    render(<Readout label="Độ khớp tổng" value={73} unit="%" scale />);

    const scaleRow = screen.getByText("0").parentElement;
    expect(scaleRow).not.toBeNull();
    expect(scaleRow!.className).toContain("text-muted");
    expect(scaleRow!.className).not.toContain("text-faint");
    expect(scaleRow!.className).toContain("text-xs");
    expect(scaleRow!.className).not.toMatch(/text-\[\d+px\]/);
  });

  it("delta na hiện 'không so được', không hiện mũi tên hay con số", () => {
    render(
      <Readout
        label="L"
        value={59}
        unit="%"
        scale
        delta={{ direction: "na" }}
        deltaValue={7}
      />
    );

    expect(screen.getByText(/không so được/i)).toBeDefined();
    expect(screen.queryByText("+7")).toBeNull();
  });

  it("delta up hiện dấu + và tô success", () => {
    render(
      <Readout
        label="L"
        value={73}
        unit="%"
        scale
        delta={{ direction: "up" }}
        deltaValue={8}
      />
    );

    const delta = screen.getByTestId("delta-value");
    expect(delta.parentElement?.className).toContain("text-success");
  });

  it("delta down giữ dấu âm và tô error", () => {
    render(
      <Readout
        label="L"
        value={65}
        unit="%"
        scale
        delta={{ direction: "down" }}
        deltaValue={-4}
      />
    );

    const delta = screen.getByTestId("delta-value");
    expect(delta.parentElement?.className).toContain("text-error");
  });

  it("delta flat hiện 0 và tô muted", () => {
    render(
      <Readout
        label="L"
        value={73}
        unit="%"
        scale
        delta={{ direction: "flat" }}
        deltaValue={0}
      />
    );

    const delta = screen.getByTestId("delta-value");
    expect(delta.parentElement?.className).toContain("text-muted");
  });

  it("có deltaLabel thì thêm một cụm sr-only nói rõ chiều hướng, cạnh nội dung hiện có", () => {
    render(
      <Readout
        label="L"
        value={73}
        unit="%"
        scale
        delta={{ direction: "up" }}
        deltaValue={8}
        deltaLabel="tốt hơn phiên bản trước"
      />
    );

    expect(screen.getByText("tốt hơn phiên bản trước")).toHaveClass("sr-only");
    expect(screen.getByTestId("delta-value")).toHaveTextContent("+8");
  });

  it("không có deltaLabel thì không render thêm node nào ngoài icon và con số", () => {
    render(
      <Readout
        label="L"
        value={73}
        unit="%"
        scale
        delta={{ direction: "up" }}
        deltaValue={8}
      />
    );

    const delta = screen.getByTestId("delta-value");
    expect(delta.parentElement?.childNodes.length).toBe(2);
  });

  it("deltaLabel bị bỏ qua khi direction là na — tránh lặp với 'không so được'", () => {
    render(
      <Readout
        label="L"
        value={59}
        unit="%"
        scale
        delta={{ direction: "na" }}
        deltaValue={7}
        deltaLabel="tốt hơn phiên bản trước"
      />
    );

    expect(screen.queryByText("tốt hơn phiên bản trước")).toBeNull();
  });
});
