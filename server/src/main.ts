import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.enableCors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5300",
    credentials: true
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swagger = new DocumentBuilder()
    .setTitle("match-cv API")
    .setVersion("0.0.1")
    .build();
  SwaggerModule.setup(
    "api/v1/docs",
    app,
    SwaggerModule.createDocument(app, swagger)
  );

  await app.listen(process.env.PORT ?? 5200);
}
void bootstrap();
