import { PrismaClient, Role } from "@prisma/client";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";

// Re-exported for backwards compatibility. The value is OWNED by
// CurrentUserService — seeding a different id than the one the app resolves to
// would produce a database where every request 500s on a missing owner, so the
// two must not be able to drift.
export { STUB_USER_ID };

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { id: STUB_USER_ID },
    update: {},
    create: {
      id: STUB_USER_ID,
      role: Role.candidate
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
