import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  requestContext,
  type RequestContextStore
} from "../../common/request-context/request-context";
import { AuthGuard } from "./auth.guard";
import type { Access } from "./decorators";

const guests = {
  create: jest
    .fn()
    .mockResolvedValue({ userId: "g-new", token: "t", expiresAt: new Date() })
};
const sessions = { setCookie: jest.fn() };

function run(access: Access | undefined, store: RequestContextStore) {
  const reflector = { getAllAndOverride: () => access } as unknown as Reflector;
  const guard = new AuthGuard(reflector, guests as never, sessions as never);
  const ctx = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getResponse: () => ({}) })
  } as never;
  return requestContext.run(store, () => guard.canActivate(ctx));
}

const anon: RequestContextStore = {
  userId: null,
  isGuest: false,
  sessionToken: null
};
const guest: RequestContextStore = {
  userId: "g",
  isGuest: true,
  sessionToken: "t"
};
const user: RequestContextStore = {
  userId: "u",
  isGuest: false,
  sessionToken: "t"
};

describe("AuthGuard", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["public", anon, true],
    ["public", guest, true],
    ["public", user, true],
    [undefined, user, true],
    ["guest", user, true],
    ["guest-create", user, true],
    ["guest", guest, true],
    ["guest-create", guest, true]
  ] as const)("access=%s lets %o through", async (access, store, ok) => {
    await expect(run(access, { ...store })).resolves.toBe(ok);
  });

  it.each([
    [undefined, anon],
    [undefined, guest],
    ["guest", anon]
  ] as const)("access=%s rejects %o with 401", async (access, store) => {
    await expect(run(access, { ...store })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("guest-create turns an anonymous request into a guest and sets the cookie", async () => {
    const store = { ...anon };
    await expect(run("guest-create", store)).resolves.toBe(true);
    expect(store).toEqual({
      userId: "g-new",
      isGuest: true,
      sessionToken: "t"
    });
    expect(sessions.setCookie).toHaveBeenCalled();
  });
});
