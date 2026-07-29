import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";

describe("App config (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");

    const swagger = new DocumentBuilder()
      .setTitle("match-cv API")
      .setVersion("0.0.1")
      .build();
    SwaggerModule.setup(
      "api/v1/docs",
      app,
      SwaggerModule.createDocument(app, swagger)
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("Swagger docs served", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/docs")
      .redirects(1);
    expect([200, 301]).toContain(res.status);
  });
});
