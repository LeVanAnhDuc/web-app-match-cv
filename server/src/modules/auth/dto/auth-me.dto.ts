import { ApiProperty } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import type { GuestQuota } from "../guest-usage.service";

export type AuthStatus = "anonymous" | "guest" | "user";

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) fullName: string | null;
  @ApiProperty({ type: String, nullable: true }) avatar: string | null;

  static fromEntity(user: User): AuthUserDto {
    const dto = new AuthUserDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.fullName = user.fullName;
    dto.avatar = user.avatar;
    return dto;
  }
}

export class GuestQuotaDto {
  @ApiProperty() limit: number;
  @ApiProperty() used: number;
  @ApiProperty() resetsAt: Date;

  static fromEntity(quota: GuestQuota): GuestQuotaDto {
    const dto = new GuestQuotaDto();
    dto.limit = quota.limit;
    dto.used = quota.used;
    dto.resetsAt = quota.resetsAt;
    return dto;
  }
}

export class AuthMeDto {
  @ApiProperty({ enum: ["anonymous", "guest", "user"] }) status: AuthStatus;

  @ApiProperty({ type: AuthUserDto, nullable: true })
  user: AuthUserDto | null;

  @ApiProperty({
    type: GuestQuotaDto,
    nullable: true,
    description:
      "Free system-key matches left today for this IP; null for a signed-in user."
  })
  guestQuota: GuestQuotaDto | null;

  static of(
    status: AuthStatus,
    user: User | null,
    quota: GuestQuota | null
  ): AuthMeDto {
    const dto = new AuthMeDto();
    dto.status = status;
    dto.user = user ? AuthUserDto.fromEntity(user) : null;
    dto.guestQuota = quota ? GuestQuotaDto.fromEntity(quota) : null;
    return dto;
  }
}
