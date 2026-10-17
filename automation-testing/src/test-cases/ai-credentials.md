# AICREDENTIALS — Credential AI riêng của user

Requirement: `docs/requirements/ai-credentials.md` · quyết định: `docs/decisions/ai-credentials.md`.

Quy ước của module: UI chạy bằng một user riêng cho từng test (`aiCredUser`: cookie phiên của user đó thay cho user e2e chung), nên danh sách chỉ có đúng dữ liệu test tự tạo. `POST /ai-credentials/:id/test` luôn bị giả ở UI (D1); khi dòng cần hiện kết quả đã lưu, test đóng dấu kết quả đó vào DB đúng như server thật sẽ lưu. Chỉ hai test `@live-ai` chạm provider thật, bằng key giả nên provider trả 401 (không tốn tiền).

Các lăng kính đi theo thứ tự trong `CLAUDE.md`; mỗi case nằm ở lăng kính đầu tiên sinh ra nó.

## 1. Truy vết requirement

### TC-AICREDENTIALS-001 — khách chưa đăng nhập thấy cổng đăng nhập và không có request credential nào

- **Requirement:** REQ-AICREDENTIALS-01
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** trình duyệt không có cookie phiên
- **Bước:** mở `/ai-credentials`
- **Mong đợi:** cổng đăng nhập `gate.aiCredentials`, link `gate.backMatching` trỏ `/wizard`; không có heading trang, không có nút Add credential
- **Kiểm chứng thêm:** không request `/ai-credentials*` nào được bắn
- **Automated:** `tests/e2e/ai-credentials/access-and-navigation.e2e.ts`

### TC-AICREDENTIALS-002 — trong lúc xác định phiên trang hiện khung chờ aria-busy

- **Requirement:** REQ-AICREDENTIALS-01
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); `GET /auth/me` bị giữ 2,5 s
- **Bước:** mở `/ai-credentials`
- **Mong đợi:** trong lúc chờ: khung `aria-busy`, không có cổng đăng nhập; sau đó trang hiện heading và khung chờ biến mất
- **Automated:** `tests/e2e/ai-credentials/access-and-navigation.e2e.ts`

### TC-AICREDENTIALS-003 — mọi endpoint credential trả 401 cho người chưa đăng nhập và cho khách

- **Requirement:** REQ-AICREDENTIALS-02
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** client ẩn danh; user khách (`createGuestUser`)
- **Bước:** gọi 6 endpoint (`GET /providers`, `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/test`) bằng từng danh tính
- **Mong đợi:** mọi lời gọi 401 `code: SIGN_IN_REQUIRED`
- **Automated:** `tests/api/ai-credentials/access-and-isolation.api.ts`

### TC-AICREDENTIALS-004 — mục AI credentials trên sidebar dẫn tới trang credential

- **Requirement:** REQ-AICREDENTIALS-05
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`), đang ở `/`
- **Bước:** bấm mục `nav.aiCredentials` (sidebar desktop, drawer mobile/tablet — `AppShell.navigate`)
- **Mong đợi:** URL `/ai-credentials`, heading trang hiện
- **Automated:** `tests/e2e/ai-credentials/access-and-navigation.e2e.ts`

### TC-AICREDENTIALS-005 — trang có đúng một heading cấp 1, phụ đề và ghi chú fallback nằm dưới danh sách

- **Requirement:** REQ-AICREDENTIALS-06
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential
- **Bước:** mở trang
- **Mong đợi:** đúng 1 heading cấp 1 `credentials.title`, phụ đề hiện, ghi chú `credentials.fallbackNote` nằm dưới đáy danh sách
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-006 — đang tải danh sách vẫn giữ khung trang, không trắng

- **Requirement:** REQ-AICREDENTIALS-07
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) không có credential; `GET /ai-credentials` bị giữ 3 s
- **Bước:** mở trang
- **Mong đợi:** trong lúc chờ: heading, phụ đề, nút thêm, ghi chú fallback hiện; chưa có empty state, chưa có alert; sau đó empty state hiện
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-007 — danh sách rỗng hiện empty state, gợi ý key hệ thống và nút thêm

- **Requirement:** REQ-AICREDENTIALS-08
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) không có credential
- **Bước:** mở trang → bấm nút thêm của empty state
- **Mong đợi:** `credentials.empty` + `credentials.emptyHint`, không có danh sách, 2 nút Add credential; nút của empty state mở modal tạo
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-008 — lỗi 500 khi tải danh sách hiện alert không tải được và giữ khung trang

- **Requirement:** REQ-AICREDENTIALS-09
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); `GET /ai-credentials` giả 500
- **Bước:** mở trang
- **Mong đợi:** Alert `role=alert` có đúng `credentials.errors.loadFailed`; heading và nút thêm vẫn còn; không có empty state
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-009 — lỗi 503 khi tải danh sách nói kho credential chưa cấu hình

- **Requirement:** REQ-AICREDENTIALS-09
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); `GET /ai-credentials` giả 503 (Q4)
- **Bước:** mở trang
- **Mong đợi:** Alert có đúng `credentials.errors.notConfigured`, không có `loadFailed`
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-010 — not-a-uuid")).status).toBe(400);
    }
  );

  test(
    "danh sách chỉ có credential của chính user, mới tạo nhất đứng đầu

- **Requirement:** REQ-AICREDENTIALS-10
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user mới, tạo lần lượt 3 credential
- **Bước:** `GET /ai-credentials`
- **Mong đợi:** id theo thứ tự ngược thứ tự tạo; `createdAt` giảm dần
- **Automated:** `tests/api/ai-credentials/access-and-isolation.api.ts`

### TC-AICREDENTIALS-011 — mỗi dòng hiện nhãn provider, tên, key che, dòng model và tag trạng thái

- **Requirement:** REQ-AICREDENTIALS-11
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential Gemini không override và OpenAI có override `gpt-4o` · `text-embedding-3-large`
- **Bước:** mở trang
- **Mong đợi:** mỗi dòng: tag provider dạng người đọc, label, `••••9876`, dòng model (`Default · Default` / `gpt-4o · text-embedding-3-large`), tag "Not tested"; không có enum thô, không có chữ `null`; dòng mới tạo nhất đứng đầu
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-012 — tag trạng thái dịch đủ 6 kết quả kiểm tra và "Not tested", không lộ enum

- **Requirement:** REQ-AICREDENTIALS-12
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 7 credential, 6 cái được đóng dấu 6 trạng thái trong DB, 1 cái chưa kiểm tra
- **Bước:** mở trang
- **Mong đợi:** mỗi dòng hiện đúng chữ `credentials.status.*` / `untested`; text trang không chứa enum thô hay key i18n `credentials.status`
- **Kiểm chứng thêm:** màu tag (xanh/đỏ/cam/xám) không kiểm tự động — chỉ là class CSS của antd
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-013 — mốc kiểm tra hiện thời gian tương đối, tooltip là ngày giờ đầy đủ

- **Requirement:** REQ-AICREDENTIALS-12
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential được đóng dấu `ok` 2 phút trước
- **Bước:** mở trang → hover mốc thời gian
- **Mong đợi:** dòng hiện "Tested OK" và thời gian tương đối do trình duyệt tính (`Intl.RelativeTimeFormat`, -2 phút); tooltip là `toLocaleString` của `lastTestedAt`
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-014 — credential chưa kiểm tra không hiện mốc thời gian, không có Invalid Date

- **Requirement:** REQ-AICREDENTIALS-12
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential chưa kiểm tra
- **Bước:** mở trang
- **Mong đợi:** "Not tested"; dòng không có "Invalid Date" / "NaN" / "null" / "undefined" và không có thời gian tương đối
- **Automated:** `tests/e2e/ai-credentials/list-rendering.e2e.ts`

### TC-AICREDENTIALS-015 — key gốc không xuất hiện trong DOM của trang credential sau khi tạo

- **Requirement:** REQ-AICREDENTIALS-13
- **Layer:** e2e · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối được giả `ok`
- **Bước:** tạo credential qua modal → đóng modal
- **Mong đợi:** dòng hiện `••••9876`; toàn bộ HTML của trang không chứa key lẫn tiền tố `sk-e2e-secret`
- **Kiểm chứng thêm:** phía step 3: TC-AICREDENTIALS-046
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-016 — /providers trả đúng 3 provider với nhãn và model mặc định

- **Requirement:** REQ-AICREDENTIALS-14
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập
- **Bước:** `GET /ai-credentials/providers`
- **Mong đợi:** 200, đúng 3 phần tử như REQ-14 (`toEqual`), mỗi phần tử đúng 4 field
- **Kiểm chứng thêm:** phần "chạy khi thiếu khoá mã hoá": TC-AICREDENTIALS-045 (manual)
- **Automated:** `tests/api/ai-credentials/providers-and-docs.api.ts`

### TC-AICREDENTIALS-017 — /providers không bị route :id nuốt

- **Requirement:** REQ-AICREDENTIALS-04, REQ-AICREDENTIALS-14
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập
- **Bước:** `GET /ai-credentials/providers`
- **Mong đợi:** 200 với mảng, không phải 400 của `ParseUUIDPipe`
- **Automated:** `tests/api/ai-credentials/providers-and-docs.api.ts`

### TC-AICREDENTIALS-018 — :id không phải UUID trả 400 ở PATCH, DELETE và test

- **Requirement:** REQ-AICREDENTIALS-04
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập
- **Bước:** `PATCH`, `DELETE`, `POST …/test` với id `not-a-uuid`
- **Mong đợi:** cả ba 400
- **Automated:** `tests/api/ai-credentials/access-and-isolation.api.ts`

### TC-AICREDENTIALS-019 — modal thêm có đủ trường, mặc định OpenRouter, chú thích lưu mã hoá

- **Requirement:** REQ-AICREDENTIALS-15
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** mở trang → Add credential
- **Mong đợi:** modal "Add credential": Provider bật, hiện "OpenRouter"; Name trống; API key `type=password`, `autocomplete=off`, chú thích `apiKeyStoredHint`; placeholder model = mặc định OpenRouter; chú thích `modelHint`; Save và Cancel bật
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-020 — đổi provider thì placeholder model đổi theo model mặc định của provider

- **Requirement:** REQ-AICREDENTIALS-15
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** mở modal tạo → chọn lần lượt Google Gemini, OpenAI, OpenRouter
- **Mong đợi:** placeholder Chat/Embedding model đổi theo model mặc định của provider vừa chọn
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-021 — tạo credential thành công trả 201 với đúng 10 field, không có vật liệu bí mật

- **Requirement:** REQ-AICREDENTIALS-18
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user mới
- **Bước:** `POST /ai-credentials` với label có khoảng trắng hai đầu
- **Mong đợi:** 201; đúng 10 field; không có `apiKey`/`encryptedKey`/`keyIv`/`keyTag`; label đã trim; `keyLast4` = 4 ký tự cuối; model, kết quả kiểm tra, `lastUsedAt` = null
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-022 — key gửi lên không xuất hiện trong response create, update, list và lỗi validate

- **Requirement:** REQ-AICREDENTIALS-19
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user mới
- **Bước:** tạo → sửa sang key khác → list → tạo với key có khoảng trắng (400)
- **Mong đợi:** không body nào (create, update, list, lỗi validate) chứa key đã gửi hay tiền tố `sk-e2e-secret`
- **Kiểm chứng thêm:** `/test` và `/match`: TC-AICREDENTIALS-041, TC-AICREDENTIALS-052 (@live-ai)
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-023 — key lưu dạng mã hoá, hai lần lưu cùng key cho IV và ciphertext khác nhau

- **Requirement:** REQ-AICREDENTIALS-20
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user mới
- **Bước:** tạo 2 credential cùng key → đọc 2 dòng trong DB
- **Mong đợi:** `encryptedKey` khác và không chứa plaintext; IV 12 byte, tag 16 byte; IV và ciphertext của hai dòng khác nhau
- **Kiểm chứng thêm:** giải mã ngược không kiểm được (suite không giữ khoá của server) — xem Q7 trong decisions
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-024 — tạo xong modal tự kiểm tra và báo riêng Chat và Embeddings

- **Requirement:** REQ-AICREDENTIALS-23
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối giả chat `ok` / embed `model_unavailable`, trễ 1,5 s
- **Bước:** tạo credential qua modal
- **Mong đợi:** "Testing connection…" hiện, rồi "Chat: Tested OK" và "Embeddings: Model unavailable"; modal vẫn mở; danh sách đã có dòng; đúng 1 request test
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-025 — kiểm tra sau khi tạo lỗi thì credential vẫn được lưu, modal không hiện kết quả

- **Requirement:** REQ-AICREDENTIALS-23
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối giả 500
- **Bước:** tạo credential qua modal → đóng
- **Mong đợi:** dòng mới có trong danh sách; modal không hiện indicator, dòng kết quả hay alert lỗi lưu; dòng "Not tested"; API list có đúng credential đó
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-026 — lưu lỗi khác 409 hiện alert không lưu được credential

- **Requirement:** REQ-AICREDENTIALS-23
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); `POST /ai-credentials` giả 500
- **Bước:** điền hợp lệ → Save
- **Mong đợi:** Alert `credentials.errors.saveFailed` trong modal, modal vẫn mở, không có lỗi `labelTaken`; không credential nào được tạo
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-027 — modal sửa khoá provider, điền sẵn tên và model, ô key trống

- **Requirement:** REQ-AICREDENTIALS-24
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential Gemini, chat `gemini-2.0-pro`
- **Bước:** Edit → Save không đổi gì
- **Mong đợi:** modal "Edit credential": Provider bị khoá + `providerLocked`, hiện "Google Gemini"; Name, Chat model điền sẵn; Embedding trống; API key trống + `apiKeyKeepHint`; Save đóng modal, không lỗi required, không request test
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-028 — gửi model rỗng khi sửa xoá override về null

- **Requirement:** REQ-AICREDENTIALS-25
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** credential có override hai model
- **Bước:** `PATCH` với `chatModel: ""`, `embedModel: "  "`
- **Mong đợi:** 200, hai model = null
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-029 — field provider gửi trong PATCH bị bỏ qua

- **Requirement:** REQ-AICREDENTIALS-25
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** credential OpenRouter
- **Bước:** `PATCH { provider: "gemini" }`
- **Mong đợi:** 200, provider vẫn `openrouter` (cả trong list)
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-030 — bỏ trống apiKey khi sửa giữ key cũ, gửi key mới thì mã hoá lại và keyLast4 đổi

- **Requirement:** REQ-AICREDENTIALS-25
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** credential mới
- **Bước:** `PATCH` chỉ label → `PATCH { apiKey: <key mới> }`
- **Mong đợi:** đổi tên: `keyLast4` và ciphertext giữ nguyên; đổi key: `keyLast4` = 4 ký tự cuối key mới, ciphertext và IV đổi
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-031 — PATCH kiểm apiKey và label theo cùng ràng buộc như khi tạo

- **Requirement:** REQ-AICREDENTIALS-25
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** credential mới
- **Bước:** `PATCH` với key 19 ký tự, key có khoảng trắng, label rỗng, label 61 ký tự
- **Mong đợi:** cả bốn 400; label và `keyLast4` không đổi
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-032 — đổi key hoặc model thì xoá kết quả kiểm tra, chỉ đổi tên thì giữ

- **Requirement:** REQ-AICREDENTIALS-26
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** credential có kết quả kiểm tra đóng dấu trong DB
- **Bước:** `PATCH` chỉ label; rồi lần lượt `apiKey`, `chatModel`, `embedModel` (đóng dấu lại trước mỗi lần)
- **Mong đợi:** đổi tên giữ `lastTestStatus`/`lastTestedAt`; mỗi thay đổi key/model đưa cả hai về null
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-033 — đổi key trong modal sửa thì tự kiểm tra lại và dòng về "Not tested"

- **Requirement:** REQ-AICREDENTIALS-26
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential đóng dấu `ok`; test kết nối giả `ok`
- **Bước:** Edit → nhập key mới → Save → đóng
- **Mong đợi:** modal tự kiểm tra lại (1 request, dòng "Chat: Tested OK"); dòng về "Not tested" và hiện `••••4321`
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-034 — chỉ đổi tên thì modal đóng ngay, không kiểm tra lại

- **Requirement:** REQ-AICREDENTIALS-26
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential đóng dấu `ok`
- **Bước:** Edit → đổi tên → Save
- **Mong đợi:** modal đóng ngay, không request test; dòng tên mới vẫn "Tested OK"
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-035 — xoá cần xác nhận: Cancel giữ dòng, xác nhận thì dòng biến mất và báo đã xoá

- **Requirement:** REQ-AICREDENTIALS-27
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential
- **Bước:** Delete → Cancel → Delete → xác nhận
- **Mong đợi:** Popconfirm có `credentials.delete.hint`; Cancel giữ dòng; xác nhận: toast `credentials.delete.success`, dòng biến mất, API list rỗng
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-036 — xoá lỗi hiện toast không xoá được, dòng vẫn còn

- **Requirement:** REQ-AICREDENTIALS-27
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential; `DELETE` giả 500
- **Bước:** Delete → xác nhận
- **Mong đợi:** toast `credentials.delete.failed`, dòng vẫn còn
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-037 — DELETE trả 204, sau đó id không còn

- **Requirement:** REQ-AICREDENTIALS-27
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** credential mới
- **Bước:** `DELETE` → list → `PATCH` → `DELETE` lại
- **Mong đợi:** 204 body rỗng; id không còn trong list; `PATCH` và `DELETE` sau đó 404
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-038 — xoá credential giữ kết quả match cũ cùng snapshot provider và model

- **Requirement:** REQ-AICREDENTIALS-28
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** credential Gemini + `MatchResult` gắn nó (chèn DB, điểm 61)
- **Bước:** `DELETE` credential → `GET /match/:id`
- **Mong đợi:** 200, `credentialId` null, `provider`/`chatModel`/`embedModel` = snapshot Gemini, điểm giữ nguyên
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-039 — nút Test của dòng quay loading khi chạy, xong báo đã kiểm tra và dòng cập nhật tag

- **Requirement:** REQ-AICREDENTIALS-31
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential chưa kiểm tra; test kết nối giả `ok` trễ 1,5 s; kết quả `ok` đóng dấu vào DB như server thật sẽ lưu
- **Bước:** bấm Test trên dòng
- **Mong đợi:** nút Test có spinner trong lúc chạy; toast `credentials.test.success`; dòng hiện "Tested OK" + "this minute"; spinner tắt
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-040 — Test lỗi request hiện toast không kiểm tra được

- **Requirement:** REQ-AICREDENTIALS-31
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential; test kết nối giả 500
- **Bước:** bấm Test
- **Mong đợi:** toast `credentials.test.failed`; dòng vẫn "Not tested"
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

### TC-AICREDENTIALS-041 — kiểm tra kết nối bằng key giả qua provider thật trả invalid_key cho cả chat và embeddings và lưu kết quả

- **Requirement:** REQ-AICREDENTIALS-29, REQ-AICREDENTIALS-30, REQ-AICREDENTIALS-19
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`; credential OpenRouter với key giả hợp lệ cú pháp
- **Bước:** `POST /:id/test` (provider thật trả 401, không tốn tiền)
- **Mong đợi:** 200 đúng 4 field; chat, embed, status = `invalid_key`; `testedAt` vừa xong; body không chứa key; DB và list lưu `invalid_key` + `lastTestedAt`
- **Automated:** `tests/api/ai-credentials/connection-test.api.ts`

### TC-AICREDENTIALS-042 — kiểm tra credential không tồn tại trả 404 trước khi gọi provider

- **Requirement:** REQ-AICREDENTIALS-29
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user đăng nhập
- **Bước:** `POST /:id/test` với UUID không tồn tại
- **Mong đợi:** 404 `aiCredentials.errors.notFound` (không gọi provider)
- **Automated:** `tests/api/ai-credentials/connection-test.api.ts`

### TC-AICREDENTIALS-043 — POST /:id/test cho phép 10 request mỗi phút, request thứ 11 trả 429

- **Requirement:** REQ-AICREDENTIALS-32
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user đăng nhập; mọi lời gọi dùng UUID không tồn tại (404, không chạm provider) và không retry 429
- **Bước:** tiêu hết cửa sổ đang có tới khi gặp 429 → chờ hết block (lời gọi đầu tiên lọt qua là #1 của cửa sổ mới) → gọi #2…#10 → #11
- **Mong đợi:** #1…#10 đều 404, #11 là 429 có `Retry-After` > 0
- **Kiểm chứng thêm:** test giữ bucket của route này tới 60 s; client chung tự chờ `Retry-After` nên spec sau chỉ chậm hơn
- **Automated:** `tests/api/ai-credentials/connection-test.api.ts`

### TC-AICREDENTIALS-044 — trạng thái tổng là trạng thái nặng nhất và lỗi provider được phân loại đủ 6 nhóm

- **Requirement:** REQ-AICREDENTIALS-29, REQ-AICREDENTIALS-30
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** provider giả trả từng mã lỗi / treo quá 20 s
- **Bước:** `POST /:id/test`
- **Mong đợi:** thứ tự nặng nhất và 6 nhóm phân loại như REQ-29/30
- **Automated:** manual — cần provider giả (402/429/404/timeout/DNS) mà server dev không cho cắm; đã phủ bằng unit test `server/src/modules/ai/ai.service.spec.ts` (Q3, D1)

### TC-AICREDENTIALS-045 — thiếu CREDENTIAL_ENCRYPTION_KEY thì endpoint credential trả 503, /providers vẫn chạy

- **Requirement:** REQ-AICREDENTIALS-33
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** một instance API không có `CREDENTIAL_ENCRYPTION_KEY`
- **Bước:** gọi list/create/update/delete/test và `/providers`
- **Mong đợi:** 503 `cryptoNotConfigured` trừ `/providers` 200
- **Automated:** manual — cần instance API thứ hai không có khoá (Q4: không dựng); phía UI của 503 ở TC-AICREDENTIALS-009, phía server có unit test

### TC-AICREDENTIALS-046 — step 3 liệt kê credential và key hệ thống; thêm credential từ step 3 tự tick credential mới

- **Requirement:** REQ-AICREDENTIALS-34, REQ-AICREDENTIALS-13
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 2 credential; test kết nối giả `ok`
- **Bước:** tới step 3 → Add credential trong khối Run with → tạo → đóng
- **Mong đợi:** mỗi credential một checkbox tên "<provider> <label> ••••9876 Not tested"; có "System key" + tag fallback; 3 checkbox; modal tạo mở đúng; credential mới tự được tick (4 checkbox); HTML không chứa key
- **Automated:** `tests/e2e/ai-credentials/wizard-run-with.e2e.ts`

### TC-AICREDENTIALS-047 — step 3 mặc định chọn credential dùng gần nhất

- **Requirement:** REQ-AICREDENTIALS-35
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 2 credential, cái tạo trước có `lastUsedAt` mới hơn
- **Bước:** tới step 3
- **Mong đợi:** credential dùng gần nhất được tick, cái kia và System key không; dòng quyền riêng tư nêu "Google Gemini"
- **Automated:** `tests/e2e/ai-credentials/wizard-run-with.e2e.ts`

### TC-AICREDENTIALS-048 — chưa credential nào từng chạy thì step 3 chọn credential mới tạo nhất

- **Requirement:** REQ-AICREDENTIALS-35
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 2 credential chưa từng chạy
- **Bước:** tới step 3
- **Mong đợi:** credential mới tạo nhất được tick, cái còn lại và System key không
- **Automated:** `tests/e2e/ai-credentials/wizard-run-with.e2e.ts`

### TC-AICREDENTIALS-049 — chưa có credential nào thì step 3 mặc định key hệ thống, không cảnh báo

- **Requirement:** REQ-AICREDENTIALS-35
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) không có credential
- **Bước:** tới step 3
- **Mong đợi:** chỉ có checkbox System key và nó được tick; dòng quyền riêng tư nêu "OpenRouter (system key)" (`credentials.runWith.privacySystemEntry`, quyết định Q10 của cv-jd-matching-wizard, 2026-10-17); không có cảnh báo
- **Automated:** `tests/e2e/ai-credentials/wizard-run-with.e2e.ts`

### TC-AICREDENTIALS-050 — credential chưa qua kiểm tra vẫn chọn được và cảnh báo đếm số nhiều đúng

- **Requirement:** REQ-AICREDENTIALS-36
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 3 credential: `ok`, chưa kiểm tra, `invalid_key` (mới nhất)
- **Bước:** tới step 3 → tick cái chưa kiểm tra → tick cái `ok` → bỏ tick hai cái chưa đạt
- **Mong đợi:** mặc định cái `invalid_key` được tick + cảnh báo số ít (1); thêm cái chưa kiểm tra → cảnh báo 2; thêm cái `ok` → vẫn 2; chỉ còn cái `ok` → không cảnh báo
- **Automated:** `tests/e2e/ai-credentials/wizard-run-with.e2e.ts`

### TC-AICREDENTIALS-051 — credential bị xoá ở nơi khác rơi khỏi lựa chọn khi danh sách làm mới

- **Requirement:** REQ-AICREDENTIALS-37
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 2 credential, cả hai được tick; test kết nối giả `ok`
- **Bước:** xoá một cái qua API → thêm credential mới từ step 3 (làm mới danh sách)
- **Mong đợi:** cái bị xoá biến mất khỏi danh sách và lựa chọn; hai cái còn lại được tick; dòng quyền riêng tư chỉ nêu provider của chúng
- **Automated:** `tests/e2e/ai-credentials/wizard-run-with.e2e.ts`

### TC-AICREDENTIALS-052 — chạy match bằng credential chụp provider và model, cập nhật lastUsedAt kể cả khi thất bại

- **Requirement:** REQ-AICREDENTIALS-38, REQ-AICREDENTIALS-19
- **Layer:** api · **Priority:** P1 · **Tags:** @live-ai
- **Tiền điều kiện:** `LIVE_AI=1`; credential OpenAI key giả, chat `gpt-4o`, embed trống; CV + JD của user
- **Bước:** `POST /match` với `credentialId` (provider thật trả 401, không tốn tiền)
- **Mong đợi:** 201, `status: failed`, `errorCode` có; snapshot `credentialId`, `openai`, `gpt-4o`, embed mặc định OpenAI; `GET /match/:id` đọc lại đúng; `lastUsedAt` được đặt; body không chứa key
- **Kiểm chứng thêm:** nhánh key hệ thống (`credentialId` null) thuộc @live-ai của module cv-jd-matching-wizard
- **Automated:** `tests/api/ai-credentials/match-integration.api.ts`

### TC-AICREDENTIALS-053 — /match với credential của user khác trả 404 và không tạo kết quả

- **Requirement:** REQ-AICREDENTIALS-39, REQ-AICREDENTIALS-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user có CV + JD; credential của user khác (chèn DB)
- **Bước:** `POST /match` với credential đó
- **Mong đợi:** 404 `aiCredentials.errors.notFound`; số `MatchResult` của user không đổi; `lastUsedAt` của credential kia vẫn null
- **Automated:** `tests/api/ai-credentials/match-integration.api.ts`

### TC-AICREDENTIALS-054 — /match với credentialId không phải UUID trả 400

- **Requirement:** REQ-AICREDENTIALS-39
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user có CV + JD
- **Bước:** `POST /match` với `credentialId: not-a-uuid`
- **Mong đợi:** 400, không `MatchResult` mới
- **Automated:** `tests/api/ai-credentials/match-integration.api.ts`

### TC-AICREDENTIALS-055 — khách gửi credentialId vào /match bị 403 GUEST_FORBIDDEN_CREDENTIAL

- **Requirement:** REQ-AICREDENTIALS-39, REQ-AICREDENTIALS-40
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user khách
- **Bước:** `POST /match` có `credentialId` (en rồi vi)
- **Mong đợi:** 403 `GUEST_FORBIDDEN_CREDENTIAL`, message `matching.errors.guestCredential` đúng ngôn ngữ; khách không có `MatchResult` nào
- **Automated:** `tests/api/ai-credentials/match-integration.api.ts`

### TC-AICREDENTIALS-056 — message lỗi notFound và labelTaken trả theo ngôn ngữ của request

- **Requirement:** REQ-AICREDENTIALS-40
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user có credential tên X
- **Bước:** với `Accept-Language` en rồi vi: `PATCH` UUID lạ; tạo trùng tên X
- **Mong đợi:** 404 `notFound` và 409 `labelTaken` đúng ngôn ngữ
- **Kiểm chứng thêm:** `cryptoNotConfigured` không dựng được (TC-AICREDENTIALS-045)
- **Automated:** `tests/api/ai-credentials/access-and-isolation.api.ts`

### TC-AICREDENTIALS-057 — trang, modal và Popconfirm hiện đủ tiếng Việt, không lộ key thô

- **Requirement:** REQ-AICREDENTIALS-40
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential
- **Bước:** mở trang → `setLanguage("vi")` → mở modal tạo, Save trống, đóng → Delete
- **Mong đợi:** heading, phụ đề, nút, ghi chú, tag "Chưa kiểm tra", dòng model, label các trường, chú thích, lỗi required, Popconfirm đều bằng tiếng Việt; không có key i18n thô
- **Kiểm chứng thêm:** toast tiếng Việt không kiểm riêng: cùng cơ chế `t()` với chữ đã kiểm
- **Automated:** `tests/e2e/ai-credentials/i18n.e2e.ts`

### TC-AICREDENTIALS-058 — khối "Chạy bằng" và cảnh báo chưa kiểm tra hiện đúng tiếng Việt

- **Requirement:** REQ-AICREDENTIALS-40, REQ-AICREDENTIALS-36
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 2 credential chưa kiểm tra
- **Bước:** tới step 3 → `setLanguage("vi")` → tick thêm cái thứ hai
- **Mong đợi:** tag "Chưa kiểm tra" trong tên checkbox; "Key hệ thống" + "dự phòng"; cảnh báo vi với 1 rồi 2; dòng quyền riêng tư vi; không key thô
- **Automated:** `tests/e2e/ai-credentials/i18n.e2e.ts`

### TC-AICREDENTIALS-059 — mở modal thì focus vào ô đầu tiên

- **Requirement:** REQ-AICREDENTIALS-41
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** mở modal tạo
- **Mong đợi:** focus nằm ở trường đầu tiên (Provider)
- **Automated:** `tests/e2e/ai-credentials/accessibility.e2e.ts`

### TC-AICREDENTIALS-060 — Esc đóng modal và trả focus về nút đã mở

- **Requirement:** REQ-AICREDENTIALS-41
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** mở modal tạo → focus Name → `Esc`
- **Mong đợi:** modal đóng, focus trở về nút Add credential đã mở nó
- **Automated:** `tests/e2e/ai-credentials/accessibility.e2e.ts`

### TC-AICREDENTIALS-061 — mọi input của modal tìm được bằng label, lỗi validate gắn vào input

- **Requirement:** REQ-AICREDENTIALS-41
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** mở modal tạo → Save trống
- **Mong đợi:** 5 trường tìm được bằng `getByLabel`; Name và API key `aria-invalid=true` và accessible description chứa lỗi required
- **Automated:** `tests/e2e/ai-credentials/accessibility.e2e.ts`

### TC-AICREDENTIALS-062 — nhóm checkbox "Run with" có accessible name

- **Requirement:** REQ-AICREDENTIALS-41
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** tới step 3
- **Mong đợi:** có phần tử `role=group` tên "Run with" chứa các checkbox
- **Automated:** `tests/e2e/ai-credentials/accessibility.e2e.ts`

### TC-AICREDENTIALS-063 — action trên dòng theo thứ tự Test, Edit, Delete và Popconfirm dùng được bằng bàn phím

- **Requirement:** REQ-AICREDENTIALS-11, REQ-AICREDENTIALS-27, REQ-AICREDENTIALS-41
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential
- **Bước:** đọc các nút của dòng → focus Delete → `Enter` → `Esc`
- **Mong đợi:** nút theo thứ tự Test, Edit, Delete; `Enter` mở Popconfirm, `Esc` đóng, dòng vẫn còn
- **Automated:** `tests/e2e/ai-credentials/accessibility.e2e.ts`

### TC-AICREDENTIALS-064 — Swagger đánh apiKey writeOnly, ví dụ chỉ là placeholder

- **Requirement:** REQ-AICREDENTIALS-43
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** —
- **Bước:** `GET /docs-json`
- **Mong đợi:** `apiKey` của Create/Update DTO `writeOnly: true`, ví dụ khớp `^sk-x+$`; `AiCredentialDto` không có `apiKey`; mọi ví dụ `sk-…` trong tài liệu đều là placeholder
- **Automated:** `tests/api/ai-credentials/providers-and-docs.api.ts`

## 2. Phân vùng tương đương

### TC-AICREDENTIALS-065 — server từ chối provider ngoài whitelist

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user mới
- **Bước:** tạo với provider `anthropic`, `OPENROUTER`, rỗng, null, số; rồi 3 provider hợp lệ
- **Mong đợi:** 5 cái đầu 400; `openrouter`, `openai`, `gemini` 201
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-066 — server từ chối key chứa khoảng trắng, xuống dòng hoặc tab

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user mới
- **Bước:** tạo với key chứa space, `\n`, `\r`, tab, toàn khoảng trắng; và thiếu key
- **Mong đợi:** tất cả 400
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-067 — model rỗng hoặc chỉ khoảng trắng lưu thành null, model có giá trị được trim

- **Requirement:** REQ-AICREDENTIALS-18
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user mới
- **Bước:** tạo với model `"   "`/`""`; rồi `"  gpt-4o  "`/`" text-embedding-3-large "`
- **Mong đợi:** lần đầu hai model null; lần sau đã trim
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-068 — field lạ trong body bị loại bỏ

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user mới + một user khác
- **Bước:** tạo kèm `userId` của người khác, `keyLast4`, `lastTestStatus`, `lastUsedAt`, `encryptedKey`
- **Mong đợi:** 201; `keyLast4` thật, kết quả kiểm tra và `lastUsedAt` null; credential thuộc người gọi
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-069 — client chặn tên trống, key trống và key có khoảng trắng mà không gửi request

- **Requirement:** REQ-AICREDENTIALS-16
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** Save trống → nhập tên + key có khoảng trắng → Save
- **Mong đợi:** 2 lỗi `required` gắn vào Name và API key; rồi lỗi `noWhitespace`; modal vẫn mở; không `POST /ai-credentials` nào
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-070 — tên chỉ gồm khoảng trắng bị server từ chối, tên được trim trước khi kiểm độ dài

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user mới
- **Bước:** tạo với label `"   "`; rồi label 60 ký tự kèm 1 space mỗi đầu
- **Mong đợi:** `"   "` → 400; label đệm → 201 với label đã trim 60 ký tự
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-071 — form chặn tên chỉ gồm khoảng trắng

- **Requirement:** REQ-AICREDENTIALS-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối giả `ok`
- **Bước:** Name `"   "` + key hợp lệ → Save
- **Mong đợi:** lỗi `required` dưới Name, không `POST /ai-credentials` nào
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

## 3. Giá trị biên

### TC-AICREDENTIALS-072 — apiKey 19 và 401 ký tự bị từ chối, 20 và 400 ký tự được nhận

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user mới
- **Bước:** tạo với key 19, 20, 400, 401 ký tự
- **Mong đợi:** 400, 201, 201, 400
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-073 — label 0 và 61 ký tự bị từ chối, 1 và 60 ký tự được nhận

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user mới
- **Bước:** tạo với label 0, 1, 60, 61 ký tự
- **Mong đợi:** 400, 201, 201, 400
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-074 — model 120 ký tự được nhận, 121 ký tự bị từ chối

- **Requirement:** REQ-AICREDENTIALS-17
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user mới
- **Bước:** tạo với chat/embed model 120 rồi 121 ký tự
- **Mong đợi:** 120 → 201; 121 → 400
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-075 — form chặn key 19 và 401 ký tự, nhận key 20 ký tự

- **Requirement:** REQ-AICREDENTIALS-16
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối giả `ok`
- **Bước:** key 19 → Save; key 401 → Save; key 20 → Save
- **Mong đợi:** `keyTooShort`, rồi `keyTooLong`, chưa request nào; key 20 được gửi (1 request) và tự kiểm tra
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-076 — form chặn tên 61 ký tự, lưu được tên 60 ký tự

- **Requirement:** REQ-AICREDENTIALS-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối giả `ok`
- **Bước:** Name 61 ký tự → Save; Name 60 ký tự → Save
- **Mong đợi:** lỗi `labelTooLong` gắn vào Name, không request; 60 ký tự được lưu (1 request)
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-077 — form báo model quá 120 ký tự bằng đúng giới hạn 120

- **Requirement:** REQ-AICREDENTIALS-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`)
- **Bước:** Chat model 121 ký tự → Save
- **Mong đợi:** bị chặn ở client (`aria-invalid`, không request) và lỗi nêu giới hạn 120, không phải câu "60 characters" của Name
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

## 4. Chuyển trạng thái

### TC-AICREDENTIALS-078 — sửa credential đã bị xoá ở tab khác thì báo không lưu được

- **Requirement:** REQ-AICREDENTIALS-23
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential
- **Bước:** mở Edit → xoá credential qua API (tab khác) → đổi tên → Save
- **Mong đợi:** Alert `credentials.errors.saveFailed`, modal vẫn mở
- **Automated:** `tests/e2e/ai-credentials/edit-delete-test.e2e.ts`

## 5. Đoán lỗi / negative

### TC-AICREDENTIALS-079 — tên trùng trong cùng user trả 409 labelTaken

- **Requirement:** REQ-AICREDENTIALS-21
- **Layer:** api · **Priority:** P1
- **Tiền điều kiện:** user có credential tên X
- **Bước:** tạo lại tên X (provider khác); tạo `"  X "`
- **Mong đợi:** 409 `aiCredentials.errors.labelTaken`; bản đệm khoảng trắng cũng 409
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-080 — tên trùng hiện lỗi ngay dưới ô Name, không phải toast

- **Requirement:** REQ-AICREDENTIALS-21
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential tên X
- **Bước:** tạo qua modal tên X + key hợp lệ
- **Mong đợi:** Name có accessible description `credentials.errors.labelTaken`; không Alert lưu lỗi; modal vẫn mở; vẫn 1 credential
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-081 — tên trùng kèm key 19 ký tự: lỗi client thắng, không request nào được gửi

- **Requirement:** REQ-AICREDENTIALS-16
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có credential tên X
- **Bước:** tạo qua modal tên X + key 19 ký tự
- **Mong đợi:** chỉ lỗi `keyTooShort`, không lỗi `labelTaken`, không `POST /ai-credentials` nào
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

### TC-AICREDENTIALS-082 — user khác dùng cùng tên vẫn hợp lệ

- **Requirement:** REQ-AICREDENTIALS-21
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user A có credential tên X; user B
- **Bước:** B tạo tên X
- **Mong đợi:** 201
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-083 — hai request tạo đồng thời cùng tên: một 201, một 409

- **Requirement:** REQ-AICREDENTIALS-21
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** user mới
- **Bước:** 2 `POST` cùng tên gửi đồng thời
- **Mong đợi:** status là {201, 409}; list có đúng 1 credential tên đó
- **Automated:** `tests/api/ai-credentials/create.api.ts`

### TC-AICREDENTIALS-084 — PATCH đổi sang tên đã dùng trả 409

- **Requirement:** REQ-AICREDENTIALS-25, REQ-AICREDENTIALS-21
- **Layer:** api · **Priority:** P2
- **Tiền điều kiện:** 2 credential A, B
- **Bước:** `PATCH` B sang tên của A
- **Mong đợi:** 409 `labelTaken`
- **Automated:** `tests/api/ai-credentials/update-delete.api.ts`

### TC-AICREDENTIALS-085 — bấm Save hai lần nhanh chỉ tạo một credential

- **Requirement:** REQ-AICREDENTIALS-22
- **Layer:** e2e · **Priority:** P1
- **Tiền điều kiện:** user riêng của test (`aiCredUser`); test kết nối giả `ok` trễ 1 s
- **Bước:** điền hợp lệ → double-click Save
- **Mong đợi:** đúng 1 `POST /ai-credentials`; danh sách và API có đúng 1 credential tên đó
- **Automated:** `tests/e2e/ai-credentials/create-and-validation.e2e.ts`

## 6. Bảo mật & ngoài lề

### TC-AICREDENTIALS-086 — không xem, sửa, xoá hay kiểm tra được credential của user khác, và 404 giống hệt id không tồn tại

- **Requirement:** REQ-AICREDENTIALS-03
- **Layer:** api · **Priority:** P0 · **Tags:** @smoke
- **Tiền điều kiện:** user A; credential của user B (chèn DB)
- **Bước:** A: list; `PATCH`/`POST test`/`DELETE` id của B và một UUID lạ
- **Mong đợi:** list không có id của B; cả ba 404 `notFound`, cùng status + message với UUID lạ; dòng của B còn nguyên, chưa từng được kiểm tra
- **Automated:** `tests/api/ai-credentials/access-and-isolation.api.ts`

### TC-AICREDENTIALS-087 — vùng bấm nút Add credential và action dòng đạt 44×44 px trên mobile

- **Requirement:** REQ-AICREDENTIALS-42
- **Layer:** e2e · **Priority:** P2
- **Tiền điều kiện:** user riêng của test (`aiCredUser`) có 1 credential; chỉ project `app-mobile` (390 px, cảm ứng)
- **Bước:** mở trang, đo bounding box
- **Mong đợi:** nút Add credential, Test, Edit, Delete đều ≥ 44×44 px
- **Automated:** `tests/e2e/ai-credentials/accessibility.e2e.ts`
