import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { readCookie } from "../../common/http/cookies";
import {
  requestContext,
  type RequestContextStore
} from "../../common/request-context/request-context";
import { SESSION_COOKIE, SessionService } from "./session.service";

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly sessions: SessionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const store: RequestContextStore = {
      userId: null,
      isGuest: false,
      sessionToken: null
    };
    if (token) {
      const resolved = await this.sessions.resolve(token);
      if (resolved) {
        Object.assign(store, { ...resolved, sessionToken: token });
      } else {
        this.sessions.clearCookie(res);
      }
    }
    requestContext.run(store, () => next());
  }
}
