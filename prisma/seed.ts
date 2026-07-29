import { PrismaClient, Role } from "@prisma/client";

export const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";

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
