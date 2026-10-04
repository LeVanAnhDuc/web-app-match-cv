/** Initials for the avatar: first + last word of the name, else the email. */
export const getInitials = (
  fullName: string | null,
  email: string | null
): string => {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  return (email?.trim()[0] ?? "?").toUpperCase();
};

/** Share of the free quota still available, 0-100. */
export const quotaLeftPercent = (limit: number, left: number): number =>
  limit > 0 ? Math.max(0, Math.min(100, (left / limit) * 100)) : 0;

/** Whole hours and minutes until `resetsAt` (minutes rounded up, never < 1). */
export const timeUntil = (
  resetsAt: string,
  now: number = Date.now()
): { hours: number; minutes: number } => {
  const minutesLeft = Math.ceil((new Date(resetsAt).getTime() - now) / 60_000);
  // An unparseable resetsAt gives NaN — fall back to the same 1-minute floor.
  const totalMinutes = Number.isFinite(minutesLeft)
    ? Math.max(1, minutesLeft)
    : 1;
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
};
