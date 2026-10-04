import { UnauthorizedException } from "@nestjs/common";
import { requestContext } from "../request-context/request-context";
import { CurrentUserService } from "./current-user.service";

describe("CurrentUserService", () => {
  const service = new CurrentUserService();

  it("returns the user id bound to the current request", () => {
    requestContext.run(
      { userId: "u-1", isGuest: false, sessionToken: "t" },
      () => {
        expect(service.getUserId()).toBe("u-1");
        expect(service.isGuest()).toBe(false);
      }
    );
  });

  it("reports a guest", () => {
    requestContext.run(
      { userId: "g-1", isGuest: true, sessionToken: "t" },
      () => expect(service.isGuest()).toBe(true)
    );
  });

  it("throws 401 SIGN_IN_REQUIRED when nobody is bound", () => {
    requestContext.run(
      { userId: null, isGuest: false, sessionToken: null },
      () => expect(() => service.getUserId()).toThrow(UnauthorizedException)
    );
  });

  it("throws 401 outside any request", () => {
    expect(() => service.getUserId()).toThrow(UnauthorizedException);
  });
});
