export type AuthStatus = "anonymous" | "guest" | "user";

export interface AuthUserDto {
  id: string;
  email: string | null;
  fullName: string | null;
  avatar: string | null;
}

export interface GuestQuotaDto {
  limit: number;
  used: number;
  /** ISO timestamp — start of the next UTC day. */
  resetsAt: string;
}

/** GET /auth/me — guestQuota is set for anonymous and guest, null for user. */
export interface AuthMeDto {
  status: AuthStatus;
  user: AuthUserDto | null;
  guestQuota: GuestQuotaDto | null;
}
