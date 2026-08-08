import { join } from "path";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { I18nModule, QueryResolver, AcceptLanguageResolver } from "nestjs-i18n";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CurrentUserModule } from "./common/current-user/current-user.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { AiCredentialsModule } from "./modules/ai-credentials/ai-credentials.module";
import { CoverLettersModule } from "./modules/cover-letters/cover-letters.module";
import { CvRewriteModule } from "./modules/cv-rewrite/cv-rewrite.module";
import { MeModule } from "./modules/me/me.module";
import { validateEnv } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    I18nModule.forRoot({
      fallbackLanguage: "en",
      loaderOptions: { path: join(__dirname, "/i18n/"), watch: true },
      resolvers: [
        { use: QueryResolver, options: ["lang"] },
        AcceptLanguageResolver
      ]
    }),
    PrismaModule,
    CurrentUserModule,
    HealthModule,
    DocumentsModule,
    MatchingModule,
    AiCredentialsModule,
    CoverLettersModule,
    CvRewriteModule,
    MeModule
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
