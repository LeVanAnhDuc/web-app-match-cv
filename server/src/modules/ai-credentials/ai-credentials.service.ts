import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { AiCredential, AiProvider, Prisma } from "@prisma/client";
import { CredentialCryptoService } from "../../common/crypto/credential-crypto.service";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService, worstStatus } from "../ai/ai.service";
import { AiRuntimeConfig, PROVIDERS, resolveModels } from "../ai/providers";
import { AiCredentialDto } from "./dto/ai-credential.dto";
import { CreateAiCredentialDto } from "./dto/create-ai-credential.dto";
import { ProviderInfoDto } from "./dto/provider-info.dto";
import { TestResultDto } from "./dto/test-result.dto";
import { UpdateAiCredentialDto } from "./dto/update-ai-credential.dto";
import { tCred } from "./i18n-messages";

const KEY_LAST4_LENGTH = 4;
const UNIQUE_VIOLATION = "P2002";

// Display names for the whitelist. The enum value is the API contract; this is
// only what a human reads.
const PROVIDER_LABELS: Record<AiProvider, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  gemini: "Google Gemini"
};

/** Blank / whitespace-only means "use the provider default", stored as null. */
function normaliseOverride(
  value: string | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class AiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly ai: AiService,
    private readonly currentUser: CurrentUserService
  ) {}

  private requireCrypto(): void {
    if (!this.crypto.isConfigured()) {
      throw new ServiceUnavailableException(
        tCred(
          "aiCredentials.errors.cryptoNotConfigured",
          "Credential storage is not configured. Please contact the administrator."
        )
      );
    }
  }

  private async findOwned(id: string): Promise<AiCredential> {
    const userId = this.currentUser.getUserId();
    const found = await this.prisma.aiCredential.findFirst({
      where: { id, userId }
    });
    if (!found) {
      throw new NotFoundException(
        tCred("aiCredentials.errors.notFound", "Credential not found.")
      );
    }
    return found;
  }

  /** Static whitelist — no crypto and no DB involved, so it works before setup. */
  listProviders(): ProviderInfoDto[] {
    return (Object.keys(PROVIDERS) as AiProvider[]).map((id) => ({
      id,
      label: PROVIDER_LABELS[id],
      defaultChatModel: PROVIDERS[id].defaultChatModel,
      defaultEmbedModel: PROVIDERS[id].defaultEmbedModel
    }));
  }

  async list(): Promise<AiCredentialDto[]> {
    this.requireCrypto();
    const userId = this.currentUser.getUserId();
    const rows = await this.prisma.aiCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => AiCredentialDto.fromEntity(row));
  }

  async create(dto: CreateAiCredentialDto): Promise<AiCredentialDto> {
    this.requireCrypto();
    const userId = this.currentUser.getUserId();
    const { ciphertext, iv, tag } = this.crypto.encrypt(dto.apiKey);
    try {
      const created = await this.prisma.aiCredential.create({
        data: {
          userId,
          provider: dto.provider,
          label: dto.label.trim(),
          encryptedKey: ciphertext,
          keyIv: iv,
          keyTag: tag,
          keyLast4: dto.apiKey.slice(-KEY_LAST4_LENGTH),
          chatModel: normaliseOverride(dto.chatModel) ?? null,
          embedModel: normaliseOverride(dto.embedModel) ?? null
        }
      });
      return AiCredentialDto.fromEntity(created);
    } catch (error) {
      throw this.asDomainError(error);
    }
  }

  async update(
    id: string,
    dto: UpdateAiCredentialDto
  ): Promise<AiCredentialDto> {
    this.requireCrypto();
    await this.findOwned(id);

    const data: Prisma.AiCredentialUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label.trim();

    const chatModel = normaliseOverride(dto.chatModel);
    const embedModel = normaliseOverride(dto.embedModel);
    if (chatModel !== undefined) data.chatModel = chatModel;
    if (embedModel !== undefined) data.embedModel = embedModel;

    if (dto.apiKey !== undefined) {
      const { ciphertext, iv, tag } = this.crypto.encrypt(dto.apiKey);
      data.encryptedKey = ciphertext;
      data.keyIv = iv;
      data.keyTag = tag;
      data.keyLast4 = dto.apiKey.slice(-KEY_LAST4_LENGTH);
    }

    // A new key or a different model means the stored verdict no longer
    // describes what would actually run — clear it rather than show a stale OK.
    if (
      dto.apiKey !== undefined ||
      chatModel !== undefined ||
      embedModel !== undefined
    ) {
      data.lastTestStatus = null;
      data.lastTestedAt = null;
    }

    try {
      const updated = await this.prisma.aiCredential.update({
        where: { id },
        data
      });
      return AiCredentialDto.fromEntity(updated);
    } catch (error) {
      throw this.asDomainError(error);
    }
  }

  async remove(id: string): Promise<void> {
    this.requireCrypto();
    await this.findOwned(id);
    await this.prisma.aiCredential.delete({ where: { id } });
  }

  async test(id: string): Promise<TestResultDto> {
    this.requireCrypto();
    const cfg = await this.getRuntimeConfig(id);
    const { chat, embed } = await this.ai.ping(cfg);
    const status = worstStatus(chat, embed);
    const testedAt = new Date();
    await this.prisma.aiCredential.update({
      where: { id },
      data: { lastTestStatus: status, lastTestedAt: testedAt }
    });
    return { status, chat, embed, testedAt };
  }

  /**
   * The ONLY place a plaintext key is materialised. The returned object is an
   * internal runtime type: never return it from a controller, never serialise
   * it into a response, never log it.
   */
  async getRuntimeConfig(id: string): Promise<AiRuntimeConfig> {
    this.requireCrypto();
    const credential = await this.findOwned(id);
    const apiKey = this.crypto.decrypt({
      ciphertext: credential.encryptedKey,
      iv: credential.keyIv,
      tag: credential.keyTag
    });
    const { baseUrl, chatModel, embedModel } = resolveModels(
      credential.provider,
      credential.chatModel,
      credential.embedModel
    );
    return {
      provider: credential.provider,
      apiKey,
      baseUrl,
      chatModel,
      embedModel
    };
  }

  /** Audit stamp: which credential last ran a match, and when. */
  async markUsed(id: string): Promise<void> {
    await this.prisma.aiCredential.update({
      where: { id },
      data: { lastUsedAt: new Date() }
    });
  }

  /**
   * Let the database decide uniqueness. Checking first and inserting after
   * would race two concurrent creates into the same label.
   */
  private asDomainError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        tCred(
          "aiCredentials.errors.labelTaken",
          "You already have a credential with this name."
        )
      );
    }
    return error;
  }
}
