import { contentDisposition } from "./content-disposition";

describe("contentDisposition", () => {
  it("is the plain ASCII form when there is no UTF-8 name", () => {
    expect(contentDisposition("inline", "CV_one.pdf", null)).toBe(
      'inline; filename="CV_one.pdf"'
    );
  });

  // RFC 6266 / 5987: browsers prefer filename* and fall back to filename.
  it("adds the RFC 5987 filename* next to the ASCII fallback", () => {
    expect(
      contentDisposition("attachment", "S_y_u_L_l_ch.pdf", "Sơ yếu Lý lịch.pdf")
    ).toBe(
      "attachment; filename=\"S_y_u_L_l_ch.pdf\"; filename*=UTF-8''S%C6%A1%20y%E1%BA%BFu%20L%C3%BD%20l%E1%BB%8Bch.pdf"
    );
  });

  // ' ( ) * are not attr-chars, and CR/LF must never reach the header raw.
  it("percent-encodes characters outside the RFC 5987 attr-char set", () => {
    expect(contentDisposition("inline", "a.pdf", "Đ'(x)*\r\n.pdf")).toBe(
      "inline; filename=\"a.pdf\"; filename*=UTF-8''%C4%90%27%28x%29%2A%0D%0A.pdf"
    );
  });
});
