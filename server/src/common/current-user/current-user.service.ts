import { Injectable, UnauthorizedException } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import {
  requestContext,
  type RequestContextStore
} from "../request-context/request-context";

@Injectable()
export class CurrentUserService {
  getUserId(): string {
    const userId = requestContext.getStore()?.userId;
    if (!userId) {
      throw new UnauthorizedException({
        code: "SIGN_IN_REQUIRED",
        message:
          I18nContext.current()?.t("auth.errors.signInRequired" as never) ??
          "Sign in required."
      });
    }
    return userId;
  }

  isGuest(): boolean {
    return requestContext.getStore()?.isGuest ?? false;
  }

  peek(): RequestContextStore | undefined {
    return requestContext.getStore();
  }
}
