import { seal, unseal } from "./sealed-cookie";

const SECRET = "x".repeat(32);

describe("sealed cookie", () => {
  it("round-trips", () => {
    expect(unseal(seal({ a: 1 }, SECRET), SECRET)).toEqual({ a: 1 });
  });
  it("rejects tampering", () => {
    const v = seal({ a: 1 }, SECRET);
    const flipped = v.slice(0, -2) + (v.endsWith("A") ? "BB" : "AA");
    expect(unseal(flipped, SECRET)).toBeNull();
  });
  it("rejects another secret", () => {
    expect(unseal(seal({ a: 1 }, SECRET), "y".repeat(32))).toBeNull();
  });
  it("rejects garbage", () => {
    expect(unseal("not-a-cookie", SECRET)).toBeNull();
  });
});
