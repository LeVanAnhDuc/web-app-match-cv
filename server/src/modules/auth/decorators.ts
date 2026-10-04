import { SetMetadata } from "@nestjs/common";

export const ACCESS_KEY = "access";
/** Default (no decorator) = a signed-in user only. */
export type Access = "public" | "guest" | "guest-create";

export const Public = () => SetMetadata(ACCESS_KEY, "public" satisfies Access);
/** Opens an endpoint to guests. `createGuest` also lets an anonymous caller in by creating one. */
export const AllowGuest = (opts?: { createGuest?: boolean }) =>
  SetMetadata(
    ACCESS_KEY,
    (opts?.createGuest ? "guest-create" : "guest") satisfies Access
  );
