# Đăng nhập qua Ducker ID + chế độ khách

Liên quan: FR-18 · FR-21 · US-09 · NFR-SEC-01 · NFR-SEC-12 · NFR-SEC-13 · NFR-COST-04 ·
NFR-DATA-04 · NFR-A11Y-03 · ADR-0022 · ADR-0023 · supersedes ADR-0006 · ADR-0008

> Trạng thái: **đã duyệt thiết kế + mockup 2026-10-04**. Mockup sống ở canvas Artifact,
> không lưu trong repo (xem `.claude/CLAUDE.md` §Document layout).

## 1. Mục tiêu

Bỏ mock user. Từ nay **danh tính đến từ Ducker ID** (OIDC), và app có hai trạng thái:

| | Khách (chưa đăng nhập) | Đã đăng nhập |
| --- | --- | --- |
| Wizard JD → CV → Review → Kết quả | có — upload/dán, **không** chọn tài liệu đã lưu | có, đủ |
| Nhà cung cấp AI | **chỉ key hệ thống** | key hệ thống hoặc key riêng (FR-09) |
| Lưu CV/JD, lịch sử, rewrite, cover letter, so sánh, khoá AI, export | **không** | có |
| Dữ liệu tồn tại | **24 giờ**, rồi xoá | tới khi user tự xoá |
| Giới hạn | **5 match / IP / ngày UTC** (env) | không thêm |

Khách đăng nhập giữa chừng → **kết quả + CV + JD của phiên khách đi theo vào tài khoản**.

**Ngoài phạm vi:** đăng ký tài khoản (việc của Ducker ID) · consent screen · đăng xuất
toàn hệ sinh thái (back-channel) · refresh token của Ducker ID · role/entitlement ngoài
`requiredRoles` của Ducker ID · FR-16 xoá tài khoản.

## 2. Đã chốt với user (2026-10-04)

| Câu hỏi | Chốt |
| --- | --- |
| Dữ liệu mock user hiện có | **Xoá sạch** (migration dữ liệu, cascade) |
| Khách đăng nhập thì kết quả có đi theo? | **Có** — mang CV, JD, kết quả vào tài khoản |
| Hướng tích hợp | **BFF + session riêng** — [ADR-0022](../../decisions/0022-dang-nhap-bff-session-rieng.md) |
| Giới hạn chi phí của khách | **Theo IP, 5 lần/ngày**, số nằm ở env |
| Đăng ký Match CV làm client ở Ducker ID | **Tay qua admin UI**, Claude tự thao tác bằng Chrome |
| Sign out | **Chỉ đăng xuất Match CV**, không gọi `/oauth/logout` của Ducker ID |
| UI | Canvas 6 màn × 375/768/1440 — duyệt. Thêm: nhóm tab Upload/Paste **có khoảng cách** với vùng drop/vùng nhập; nút **44px** như mockup (§6.4) |

## 3. Kiến trúc

### 3.1 Ba vai, một cookie

- **Ducker ID** (`OIDC_ISSUER`, dev `http://localhost:3000`) chỉ trả lời *"người này là
  ai"*, **một lần** lúc đăng nhập. Token của nó (15 phút, không refresh) **không bao giờ
  rời server** của Match CV và không được lưu.
- **Server Match CV** là confidential client (`client_secret_basic` + PKCE S256 — Ducker
  ID bắt PKCE cả với confidential client). Nó tự cấp **session riêng**.
- **Trình duyệt** chỉ giữ cookie `mcv_session` (httpOnly). Không có token nào trong JS.

Tên cookie có tiền tố `mcv_` vì cookie trên `localhost` **dùng chung giữa các cổng**:
Ducker ID đã dùng `sid` và `refreshToken`.

### 3.2 Luồng đăng nhập

```
Browser                    Match CV server (:5200)               Ducker ID (:3000)
  │ GET /auth/login?returnTo=/wizard?runId=…                          │
  ├──────────────────────────►│ sinh state, nonce, code_verifier       │
  │                           │ → cookie mcv_oauth (AES-GCM, 10 phút)  │
  │◄── 302 /oauth/authorize?response_type=code&scope=openid profile email
  │        &code_challenge=…&code_challenge_method=S256&state&nonce ──►│
  │                      (chưa có sid ở :3000 → trang login của Ducker ID)
  │◄──────────────── 302 /api/v1/auth/callback?code&state&iss ────────┤
  ├──────────────────────────►│ đối chiếu state + iss                  │
  │                           │ POST /oauth/token (Basic, verifier) ──►│
  │                           │◄──────────── id_token (RS256) ─────────┤
  │                           │ kiểm chữ ký qua JWKS (theo kid), iss,  │
  │                           │ aud = client_id, exp, nonce            │
  │                           │ upsert User theo externalSub = sub     │
  │                           │ (mirror email, name, picture)          │
  │                           │ nếu có session khách → claim (§3.4)    │
  │                           │ tạo Session mới, xoá mcv_oauth          │
  │◄── 302 CLIENT_ORIGIN + returnTo, Set-Cookie mcv_session ───────────│
```

- Kiểm id_token bằng **`node:crypto`** (`createPublicKey({ format: 'jwk' })` +
  `verify('RSA-SHA256')`), JWKS cache theo `kid`, gặp `kid` lạ thì tải lại **một lần**
  (Ducker ID dev sinh khoá mới mỗi lần khởi động). Không thêm `jose`/`openid-client`:
  cả hai là pure ESM, và Jest CommonJS của server sẽ chết khi load (bài học trong
  `server/.claude/CLAUDE.md`). Lý do đầy đủ ở ADR-0022.
- Không gọi `/oauth/userinfo`: id_token đã mang `name`, `picture`, `email`,
  `email_verified` theo scope.
- `returnTo` chỉ nhận **đường dẫn tương đối** (bắt đầu bằng `/`, không phải `//`), ghép
  với `CLIENT_ORIGIN`. Mọi giá trị khác → `/`. Chống open redirect.
- Đã đăng nhập mà gọi `/auth/login` → redirect thẳng `returnTo`.
- Lỗi từ Ducker ID (`?error=access_denied` …) hoặc state sai → redirect
  `CLIENT_ORIGIN/?authError=<code>` — client hiện toast, không lộ chi tiết.

### 3.3 Session

Bảng `Session`: `id` = **SHA-256 của token** (token thô chỉ nằm trong cookie, rò DB không
dùng lại được session), `userId`, `expiresAt`, `createdAt`.

- User thật: hạn **7 ngày** cố định (`SESSION_TTL_DAYS`). Hết hạn → khách.
- Khách: hạn **bằng `guestExpiresAt`** của user khách (24 giờ, `GUEST_TTL_HOURS`).
- Cookie: `HttpOnly; SameSite=Lax; Path=/; Secure` khi production, `Max-Age` khớp
  `expiresAt`.
- **Đăng nhập luôn tạo session mới** và xoá session cũ (chống session fixation).
- Sign out: `POST /auth/logout` xoá row + clear cookie. Không động vào Ducker ID (§2).

`CurrentUserService.getUserId()` **giữ nguyên chữ ký** — nó đọc từ một
`AsyncLocalStorage` mà `SessionMiddleware` điền cho mỗi request. Mười mấy service đang
gọi `getUserId()` không phải sửa, đúng như ADR-0008 hứa ("khi Auth về chỉ đổi nguồn
`userId`"). Không request-scoped provider (nó lan scope ra cả cây DI), không
`nestjs-cls` (dependency mới cho thứ `node:async_hooks` đã có).

### 3.4 Khách là một `User` thật, sống 24 giờ

Khách được tạo **lười**: lần đầu một request khách-được-phép **ghi** (thực tế là
`POST /documents`) mà chưa có session. Khi đó tạo `User { isGuest: true,
guestExpiresAt: now + 24h }` + `Session`, set cookie. Mọi FK và mọi luồng match hiện có
chạy nguyên vẹn — cùng lý lẽ với ADR-0008.

**Claim lúc đăng nhập** — một transaction:
1. `Document`, `MatchRun`, `MatchResult` của user khách → đổi `userId` sang user thật.
   Document được claim đặt `isSaved = true` (đúng lời hứa trên UI: "moves into your
   account with its CV and JD").
2. Xoá user khách (cascade xoá session của nó).
3. Khách đã hết hạn → bỏ qua claim, không lỗi.

**Dọn khách hết hạn — lười, không job nền** (`overview.md` §4 cấm scheduler):
`DELETE FROM users WHERE is_guest AND guest_expires_at < now()` chạy mỗi lần **tạo
khách mới** và mỗi lần **đăng nhập**. Đủ, vì dữ liệu khách chỉ tăng đúng ở hai chỗ đó.
Hệ quả chấp nhận được: một DB không ai dùng sẽ giữ khách hết hạn tới request tạo khách
kế tiếp — ghi ở `backlog.md` §Nợ.

### 3.5 Quota khách

Bảng `GuestUsage(ipHash, day, count)`, khoá chính `(ipHash, day)`, `day` là ngày **UTC**
(bất biến #1). `ipHash = HMAC-SHA256(SESSION_SECRET, ip)` — không lưu IP thô
(NFR-DATA-01).

- Kiểm và tăng **nguyên tử** (`INSERT … ON CONFLICT DO UPDATE SET count = count + 1
  WHERE count < limit RETURNING count`) **trước** call AI: tốn tiền là lúc gọi, không
  phải lúc thành công.
- Áp ở `POST /match` khi user là khách. `POST /match/runs` không gọi AI nên không tính.
- Hết lượt → `429` với `code: "GUEST_QUOTA_EXCEEDED"` + `resetsAt`.
- `req.ip` với `trust proxy` **tắt** (app chưa deploy; bật nó khi chưa có proxy thật là
  cho client tự khai IP qua `X-Forwarded-For`).

## 4. Dữ liệu

```prisma
model User {
  id             String    @id @default(uuid())
  role           Role
  externalSub    String?   @unique          // `sub` của Ducker ID (24 hex). null với khách
  isGuest        Boolean   @default(false)
  guestExpiresAt DateTime?
  email          String?                    // mirror theo scope, nullable (ADR-0007)
  fullName       String?
  avatar         String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  sessions       Session[]
  // … quan hệ cũ giữ nguyên
  @@index([isGuest, guestExpiresAt])
}

model Session {
  id        String   @id                    // sha256(token), hex
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
  @@index([expiresAt])
}

model GuestUsage {
  ipHash String
  day    DateTime @db.Date
  count  Int      @default(0)
  @@id([ipHash, day])
}
```

- `Document.user` và `MatchResult.user` thêm **`onDelete: Cascade`** — hiện thiếu, nên
  xoá một user có dữ liệu đang **bị chặn**. Cần cho cả dọn khách lẫn xoá mock user, và
  là điều kiện của FR-16 về sau.
- `isMock` của ADR-0008 **không thêm** — mock user bị xoá, không còn ai mang cờ đó. Nợ #2
  ở `backlog.md` đóng theo (phần profile mirror cũng xong ở đây, trừ `phone`: Ducker ID
  không có claim phone).
- **Migration dữ liệu**: xoá `User` id `00000000-0000-0000-0000-000000000001` (cascade
  toàn bộ dữ liệu của nó). `prisma/seed.ts` **không còn** tạo stub user; `STUB_USER_ID`
  bị xoá khỏi code. `seed:mock` (dev) đổi sang gắn tài liệu mẫu cho **một user chỉ định**
  qua `--user <email>` — không có user mặc định nữa thì không có chỗ ngầm định để gắn.
- `erd.md` cập nhật trong cùng PR.

## 5. API

### 5.1 Endpoint mới — `AuthModule`

| Method | Path | Ai gọi | Làm gì |
| --- | --- | --- | --- |
| GET | `/auth/login?returnTo=` | mọi người | 302 sang `/oauth/authorize` |
| GET | `/auth/callback` | Ducker ID redirect | đổi code, tạo session, claim, 302 về client |
| POST | `/auth/logout` | user/khách | xoá session, 204 |
| GET | `/auth/me` | mọi người | `{ status: "anonymous" \| "guest" \| "user", user?, guestQuota? }` |

`guestQuota = { limit, used, resetsAt }` trả cả cho `anonymous` (đếm theo IP), để sidebar
hiện "3 / 5 left" từ lần đầu vào trang.

### 5.2 Ai được gọi gì

Mặc định **mọi endpoint đòi user thật** (`401` cho khách và anonymous). Decorator
`@AllowGuest()` mở cho khách; `@Public()` mở cho cả anonymous.

| Endpoint | anonymous | khách | user |
| --- | --- | --- | --- |
| `GET /health`, `/auth/*` | ✓ | ✓ | ✓ |
| `POST /documents` | ✓ **tạo khách** | ✓ | ✓ |
| `GET /documents/:id` (+ file gốc) | 401 | ✓ của mình | ✓ |
| `POST /match/runs`, `GET /match/runs/:id`, `GET /match/:id` | 401 | ✓ của mình | ✓ |
| `POST /match` | 401 | ✓ — **cấm `credentialId`** (403), trừ quota | ✓ |
| Mọi endpoint khác (`GET /documents`, PATCH/DELETE, `/match` list, `ai-credentials`, `ai/providers`, `cover-letters`, `cv-rewrite`, `comparisons`, `me/export`) | 401 | **401** | ✓ |

Bất biến #2 giữ: UI ẩn nút **và** server chặn. Phân quyền theo chủ sở hữu (bất biến #4)
không đổi — khách là một `userId` như mọi user.

## 6. Client

### 6.1 Trạng thái auth

- `apiFetch` / `apiFetchBinary` thêm `credentials: "include"`. Server CORS đã có
  `credentials: true` với `CLIENT_ORIGIN`.
- Hook `useAuth()` = TanStack Query trên `GET /auth/me` (`["auth","me"]`). Không lưu vào
  Zustand — đây là server state.
- `ApiError` 401 trên một màn đòi đăng nhập → render màn mời đăng nhập (§6.3), không
  redirect âm thầm.
- `?authError=` trên URL → toast một lần rồi xoá param.
- Mọi điểm "Sign in" là **link điều hướng** tới
  `API_BASE_URL/auth/login?returnTo=<đường dẫn hiện tại>` — không phải `fetch`, vì đây
  là redirect cả trang.

### 6.2 Shell

- Sidebar khách: **Home, Match** + thẻ "Guest mode" + thanh quota. User: đủ 6 mục + thẻ
  user (avatar chữ cái đầu, tên, email, `Sign out`).
- Header mobile/tablet: khách có nút `Sign in`; user có nút avatar mở menu
  (tên, email, Sign out). Drawer mobile chứa đúng nội dung sidebar.
- Không có mục "khoá" — tính năng khách không dùng được thì **ẩn khỏi nav**, vào bằng URL
  thì gặp §6.3.

### 6.3 Màn và trạng thái

| Màn | Khách | User |
| --- | --- | --- |
| `/` Home | hero + thẻ "Everything stays in one place" (4 list-row); không thẻ thống kê, không kết quả gần đây | như hiện tại |
| `/wizard` bước 1–2 | chỉ tab Upload / Paste; ẩn "Saved" và `SaveForReuseButton`; ghi chú "kept for 24 hours" | như hiện tại |
| `/wizard` bước 4 | ẩn `RunWithSelector` (luôn key hệ thống); thẻ "Kept for 24 hours, then deleted" + **Sign in to keep it**; thanh dưới chỉ `Start over` | banner "Saved to your account…" khi vừa claim; thanh dưới `Rewrite CV` (primary) · `Cover letter` · `Start over`; **bỏ nút `Save report`** (nợ #8) |
| `/cv` `/jd` `/ai-credentials` `/my-data` `/compare/*` `/cv-rewrite/*` | thẻ "Sign in to see …" + Sign in + Back to matching | như hiện tại |
| Hết quota (429) | thẻ "You have used today's 5 free matches" + đếm ngược tới `resetsAt` + Sign in | — |

**`/wizard?runId=<id>`**: mở thẳng bước 4 của run đó (đọc `GET /match/runs/:id`, lấy cặp
tài liệu từ đó). Đây là `returnTo` của nút "Sign in to keep it" — đăng nhập là redirect
cả trang nên store Zustand của wizard mất; URL là thứ duy nhất sống sót qua redirect.

### 6.4 Hai sửa UI user yêu cầu khi duyệt mockup

1. **Khoảng cách nhóm tab ↔ vùng nhập.** `UploadPasteTabs` đang tạo khoảng cách bằng
   `className="mb-8"` trên antd `Segmented`, nhưng cssinjs của antd đặt `margin: 0` cho
   `.ant-segmented` và thắng utility — trên app thật nhóm tab dính sát Dragger/TextArea.
   Sửa: bọc trong `flex flex-col gap-4`, bỏ margin trên `Segmented`/`Dragger`/`TextArea`
   (gap không tranh chấp specificity với antd). Áp cho cả khách lẫn user.
2. **Cỡ nút như mockup.** Mọi nút trên các màn feature này chạm tới cao **44px**
   (`!h-11`) và full-width dưới `md`; item của `Segmented` cao 40px trong pill có padding
   4px (= vùng bấm 48px). Đúng NFR-A11Y-03 và `MASTER.md` §4 — antd mặc định 32/40px
   không đạt. Các nút ngoài phạm vi màn của feature này vẫn là nợ #7.

### 6.5 Câu chữ

EN + VI vào `src/locales/{en,vi}/translation.json` và `ux-copy.md`. Dùng đúng câu đã duyệt
trên canvas ("Sign in with Ducker ID", "Kept for 24 hours, then deleted", "Sign in to
keep it", "You have used today's 5 free matches", "Free matches today").

## 7. Phía Ducker ID

Không sửa code Ducker ID. Đăng ký client **tay qua admin UI** (`admin@test.com`), do Claude
thao tác bằng Chrome trong bước build:

| Field | Giá trị dev |
| --- | --- |
| `name` / `displayName` | `match-cv` / `Match CV` |
| `homeUrl` | `http://localhost:5300` |
| `redirectUris` | `http://localhost:5200/api/v1/auth/callback` (khớp **nguyên văn**) |
| `tokenEndpointAuthMethod` | `client_secret_basic` |
| `requiredRoles` | `user`, `admin` (mặc định `["user"]` loại admin) |

`client_id` + secret (hiện **một lần**) vào `server/.env`. Không cần `postLogoutRedirectUris`
(§2: không gọi logout của Ducker ID) và không cần sửa CORS của Ducker ID (BFF gọi
server-to-server).

**Rủi ro đã biết ở Ducker ID** (từ khảo sát code, chưa thử runtime):
- `/oauth/token` dùng chung rate limit với đăng nhập mật khẩu: **30 request / 15 phút /
  IP**. Dev nhiều lần login liên tiếp có thể chạm — lỗi trả về không theo dạng OAuth, nên
  callback phải xử lý mọi body lỗi như `server_error`.
- Đăng ký xong ở Ducker ID **không tạo `sid`** → có thể vòng lặp `/login` ↔
  `/authorize`. Kiểm khi verify; nếu xảy ra, ghi bug sang Ducker ID, không vá ở Match CV.

## 8. Biến môi trường mới (server)

`OIDC_ISSUER` · `OIDC_CLIENT_ID` · `OIDC_CLIENT_SECRET` · `OIDC_REDIRECT_URI` ·
`SESSION_SECRET` (≥32 byte; mã hoá cookie `mcv_oauth` + HMAC IP) · `SESSION_TTL_DAYS`
(mặc định 7) · `GUEST_TTL_HOURS` (24) · `GUEST_MATCH_LIMIT_PER_DAY` (5). Tất cả vào
`validateEnv`, `server/.env.example` và `.env.example` gốc trong cùng PR.

## 9. Bảo mật

- CSRF: cookie `SameSite=Lax` + CORS chỉ `CLIENT_ORIGIN` + mutation nhận JSON/multipart từ
  `fetch` có `credentials` → trang lạ không gửi được request kèm cookie đọc được kết quả.
  `POST /auth/logout` là POST, không GET.
- Callback: `state` một lần (cookie `mcv_oauth` xoá ngay), `nonce` trong id_token, PKCE,
  `iss` trên query khớp `OIDC_ISSUER`.
- Không log token, code, cookie, email (NFR-SEC-02).
- Rate limit `/auth/login` + `/auth/callback` chặt hơn mức toàn cục — NFR-SEC-13 (NFR-SEC-03 cũ đã gạch,
  ID không tái dùng).
- Khách không chạm được key riêng của ai: `credentialId` bị cấm ở `POST /match` khách, và
  khách không có `AiCredential` nào để tham chiếu.
- ADR-0009 precondition "không deploy public trước khi auth xong" **được gỡ** bởi feature
  này — ghi ở ADR-0022.

## 10. Kiểm thử

- **Unit (server)**: kiểm id_token (chữ ký sai, `aud` sai, `iss` sai, hết hạn, `nonce`
  sai, `kid` lạ → tải lại JWKS một lần); `returnTo` (tuyệt đối, `//evil`, rỗng); quota
  (đúng ngưỡng, sang ngày UTC mới); claim (chuyển đủ 3 bảng, khách hết hạn bỏ qua, chạy
  lại không nhân đôi); guard matrix §5.2 — **một test cho mỗi ô**.
- **E2E server (supertest)**: Ducker ID giả bằng một JWKS + token endpoint stub trong
  test — không phụ thuộc Ducker ID đang chạy.
- **Unit (client)**: shell theo 3 trạng thái `useAuth`; wizard khách ẩn đúng các phần;
  `?runId=` mở bước 4; `UploadPasteTabs` có `gap-4`.
- **Playwright**: luồng khách đầy đủ tới bước 4; route bị chặn; hết quota (hạ
  `GUEST_MATCH_LIMIT_PER_DAY` trong env test). Luồng đăng nhập thật **không** vào suite
  committed (cần Ducker ID chạy) — đi bằng tay qua Chrome ở bước verify, theo
  `feature-flow` §5.
- Verify trên app thật: 375 / 768 / 1024 / 1440, cả hai theme, đăng nhập thật qua
  Ducker ID với `user@test.com`, kiểm claim.

## 11. Tài liệu tầng 1 cập nhật cùng PR

`scope.md` (FR-18 → đang, FR-21 mới) · `journeys.md` (US-09) · `nfr.md` (NFR-SEC-12,
NFR-SEC-13, NFR-COST-04) · `invariants.md` (#4 bỏ câu "mock user", thêm bất biến session
lưu hash) · `overview.md` §Mô hình nếu nhắc mock user · `architecture.md` (AuthModule,
luồng §3.2) · `glossary.md` (khách, session, claim) · `erd.md` · ADR-0022, ADR-0023, đánh
dấu ADR-0006/0008 superseded · `backlog.md` (Đang làm; đóng nợ #2, #8; nợ mới về dọn
khách lười) · `ux-copy.md` · `icon-map.md` (log-in, log-out, clock).
