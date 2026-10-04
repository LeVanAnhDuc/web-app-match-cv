import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { App } from "supertest/types";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";

export async function createTestApp(): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, prisma: moduleRef.get(PrismaService) };
}
