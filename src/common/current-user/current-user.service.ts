import { Injectable } from '@nestjs/common';

// Stub current-user: auth deferred (see Plan 1 Global Constraints).
// TODO(auth): replace with real SSO-derived userId once auth is implemented.
export const STUB_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class CurrentUserService {
  getUserId(): string {
    return STUB_USER_ID;
  }
}
