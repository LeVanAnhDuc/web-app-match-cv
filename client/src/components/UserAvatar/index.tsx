import { getInitials } from "#/utils";

const UserAvatar = ({
  fullName,
  email
}: {
  fullName: string | null;
  email: string | null;
}) => (
  <span
    aria-hidden="true"
    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-accent"
  >
    {getInitials(fullName, email)}
  </span>
);

export default UserAvatar;
