# AICREDENTIALS — Credential AI riêng của user (FR-09 · US-03)

Nguồn, quyết định và phạm vi: `docs/decisions/ai-credentials.md`.

## Truy cập và quyền

- **REQ-AICREDENTIALS-01** Trang `/ai-credentials` chỉ dành cho user đã đăng nhập: người không có tài khoản (ẩn danh hoặc khách) thấy cổng đăng nhập tiêu đề `gate.aiCredentials` ("Sign in to manage your AI keys" / "Đăng nhập để quản lý khoá AI của bạn") kèm lối quay về `/wizard`, và trình duyệt không bắn request `/ai-credentials*` nào. Trong lúc phiên còn đang xác định, trang hiện khung chờ `aria-busy`, không hiện cổng lẫn nội dung.
- **REQ-AICREDENTIALS-02** Mọi endpoint `/ai-credentials*` (kể cả `GET /ai-credentials/providers`) chỉ nhận user đã đăng nhập; không có phiên hoặc phiên khách → 401 `SIGN_IN_REQUIRED`.
- **REQ-AICREDENTIALS-03** Cô lập theo user: `GET /ai-credentials` chỉ trả credential của chính user; `PATCH` / `DELETE` / `POST /:id/test` với id của user khác hoặc id không tồn tại → 404 `aiCredentials.errors.notFound` ("Credential not found." / "Không tìm thấy credential."), giống hệt nhau, không bao giờ 403, và không đụng tới bản ghi của người khác.
- **REQ-AICREDENTIALS-04** `:id` không phải UUID → 400; `GET /ai-credentials/providers` không bị route `:id` nuốt.
- **REQ-AICREDENTIALS-05** Sidebar (drawer dưới `lg`) có mục `nav.aiCredentials` "AI credentials" / "Credential AI" dẫn tới `/ai-credentials`.

## Danh sách

- **REQ-AICREDENTIALS-06** Trang có đúng **một** heading cấp 1 `credentials.title` "AI credentials" / "Credential AI" và phụ đề `credentials.subtitle`; ghi chú `credentials.fallbackNote` luôn nằm dưới danh sách.
- **REQ-AICREDENTIALS-07** Đang tải danh sách → khung trang (tiêu đề, phụ đề, nút thêm, ghi chú fallback) vẫn hiện cùng skeleton, chưa hiện empty state hay lỗi; không bao giờ trang trắng.
- **REQ-AICREDENTIALS-08** Danh sách rỗng → empty state `credentials.empty` "No credentials yet" / "Chưa có credential nào" + `credentials.emptyHint` nói đang chạy bằng key hệ thống + nút "Add credential" mở modal tạo.
- **REQ-AICREDENTIALS-09** Lỗi tải: `GET /ai-credentials` 500 → Alert `role="alert"` `credentials.errors.loadFailed` "Could not load your credentials"; 503 → `credentials.errors.notConfigured` "Credential storage is not configured on the server." (không phải câu lỗi chung). Khung trang vẫn còn.
- **REQ-AICREDENTIALS-10** Danh sách sắp `createdAt` giảm dần (mới tạo nhất đứng đầu), không phân trang, không filter/sort.
- **REQ-AICREDENTIALS-11** Mỗi dòng hiện: tag nhãn provider dạng người đọc ("OpenRouter" / "OpenAI" / "Google Gemini", không phải enum thô), label, `••••` + `keyLast4`, dòng model "`<chat> · <embed>`" với `null` → `credentials.defaultModel` "Default" / "Mặc định", và tag trạng thái kiểm tra. Thứ tự action: Test → Edit → Delete.
- **REQ-AICREDENTIALS-12** Tag trạng thái: `null` → "Not tested" / "Chưa kiểm tra"; `ok` "Tested OK", `invalid_key` "Invalid key", `no_quota` "No quota", `model_unavailable` "Model unavailable", `timeout` "Timed out", `unreachable` "Unreachable" (và bản `vi`). Không bao giờ hiện enum thô. `lastTestedAt` → thời gian tương đối theo ngôn ngữ UI (vd "2 minutes ago"), tooltip là ngày giờ đầy đủ; `lastTestedAt = null` → không hiện mốc thời gian nào, không bao giờ "Invalid Date" / "NaN" / "null". Dòng không hiện `lastUsedAt`.
- **REQ-AICREDENTIALS-13** DOM của trang credential và của step 3 wizard không bao giờ chứa key gốc ở bất kỳ đâu (kể cả sau khi vừa tạo).

## Provider whitelist

- **REQ-AICREDENTIALS-14** `GET /ai-credentials/providers` → 200, đúng 3 phần tử `{ id, label, defaultChatModel, defaultEmbedModel }`: `openrouter` "OpenRouter" `openai/gpt-4o-mini` · `openai/text-embedding-3-small`; `openai` "OpenAI" `gpt-4o-mini` · `text-embedding-3-small`; `gemini` "Google Gemini" `gemini-2.5-flash` · `gemini-embedding-001`. Chạy được cả khi server thiếu `CREDENTIAL_ENCRYPTION_KEY`.

## Tạo

- **REQ-AICREDENTIALS-15** Modal tạo: tiêu đề "Add credential" / "Thêm credential"; Provider (Select, mặc định OpenRouter, option lấy từ `/providers`), Name, API key (ô mật khẩu, `autocomplete="off"`, chú thích "Encrypted at rest. It is never shown again."), Chat model, Embedding model (placeholder = model mặc định của provider đang chọn, đổi theo provider; chú thích "Leave blank to use the provider default"); nút Save / Cancel.
- **REQ-AICREDENTIALS-16** Form validate trước khi gửi và không bắn request nào khi lỗi: Name bắt buộc ("This field is required"), không được chỉ gồm khoảng trắng, tối đa 60 ("Use at most 60 characters"); API key bắt buộc khi tạo, ≥ 20 ("The key must be at least 20 characters"), ≤ 400 ("The key must be at most 400 characters"), không khoảng trắng ("No spaces allowed"); Chat/Embedding model tối đa 120 ký tự với thông báo nêu đúng giới hạn 120 (form được phép chặn khoảng trắng trong model). Lỗi client thắng lỗi server: tên trùng + key 19 ký tự → chỉ báo lỗi key, không request.
- **REQ-AICREDENTIALS-17** `POST /ai-credentials` validate ở server: `provider` ∈ {openrouter, openai, gemini} (khác → 400); `label` được trim **trước** khi kiểm độ dài 1–60 (chỉ khoảng trắng → 400; 60 ký tự kèm khoảng trắng hai đầu → 201); `apiKey` dài 20–400 và không chứa khoảng trắng (space, `\r`, `\n`, tab); `chatModel` / `embedModel` tuỳ chọn, dài 0–120. BVA: key 19 → 400, 20 → 201, 400 → 201, 401 → 400; label 0 → 400, 1 → 201, 60 → 201, 61 → 400; model 120 → 201, 121 → 400. Field lạ trong body bị loại bỏ (không đổi được chủ sở hữu, `keyLast4`, kết quả kiểm tra).
- **REQ-AICREDENTIALS-18** Tạo thành công → 201 với đúng 10 field `id, provider, label, keyLast4, chatModel, embedModel, lastTestStatus, lastTestedAt, lastUsedAt, createdAt`; không có `apiKey` / `encryptedKey` / `keyIv` / `keyTag`; `label` đã trim; model rỗng hoặc chỉ khoảng trắng → `null`; model có giá trị → đã trim; `lastTestStatus`, `lastTestedAt`, `lastUsedAt` = `null`.
- **REQ-AICREDENTIALS-19** Không response nào (create, update, list, test, `/match`, lỗi validate) chứa chuỗi key đã gửi — kiểm trên toàn bộ body dạng chuỗi.
- **REQ-AICREDENTIALS-20** Key lưu mã hoá AES-256-GCM: cột `encryptedKey` khác và không chứa plaintext, IV 12 byte, tag 16 byte; hai lần lưu cùng một key cho IV và ciphertext khác nhau.
- **REQ-AICREDENTIALS-21** Label trùng **trong cùng một user** (so trên label đã trim) → 409 `aiCredentials.errors.labelTaken`; UI hiện lỗi ngay dưới ô Name (`credentials.errors.labelTaken`), không phải toast/alert. User khác dùng cùng label → hợp lệ. Hai request tạo đồng thời cùng label → đúng một 201, một 409.
- **REQ-AICREDENTIALS-22** Bấm Save hai lần nhanh → chỉ một credential được tạo (nút Save bị khoá khi đang gửi hoặc đang kiểm tra).
- **REQ-AICREDENTIALS-23** Lưu xong khi tạo → tự kiểm tra kết nối một lần: modal hiện "Testing connection…" rồi hai dòng "Chat: <trạng thái>" và "Embeddings: <trạng thái>", modal vẫn mở tới khi user đóng; danh sách đã có dòng mới. Kiểm tra lỗi request → credential vẫn được lưu, modal không hiện kết quả. Lưu (tạo hoặc sửa) lỗi khác 409 → Alert "Could not save the credential" trong modal, modal vẫn mở.

## Sửa

- **REQ-AICREDENTIALS-24** Modal sửa: tiêu đề "Edit credential" / "Sửa credential"; Provider bị khoá kèm chú thích `credentials.form.providerLocked`; Name và model điền sẵn; ô API key **luôn trống** kèm chú thích "Leave blank to keep the current key"; không bắt buộc nhập key.
- **REQ-AICREDENTIALS-25** `PATCH /ai-credentials/:id`: `label` tuỳ chọn 1–60; `apiKey` tuỳ chọn (bỏ trống → giữ key cũ và `keyLast4` cũ; có giá trị → mã hoá lại, `keyLast4` mới, cùng ràng buộc 20–400 / không khoảng trắng); model rỗng → xoá override về `null`; field `provider` gửi lên bị bỏ qua, provider không đổi. Label trùng → 409. Body bị từ chối thì không đổi gì.
- **REQ-AICREDENTIALS-26** Đổi `apiKey`, `chatModel` hoặc `embedModel` → `lastTestStatus` và `lastTestedAt` về `null` (UI về "Not tested"); chỉ đổi label → giữ nguyên kết quả kiểm tra. UI chỉ tự kiểm tra lại khi key hoặc model đổi; chỉ đổi tên (hoặc không đổi gì) thì modal đóng luôn.

## Xoá

- **REQ-AICREDENTIALS-27** Delete → Popconfirm "Delete this credential?" + "Past match results keep the provider and model they ran with.", nút xác nhận và Cancel, thao tác được bằng bàn phím. Cancel → không xoá. Xác nhận → `DELETE` 204, dòng biến mất, toast "Credential deleted"; lỗi → toast "Could not delete the credential", dòng vẫn còn. Sau khi xoá, id không còn (PATCH/DELETE → 404).
- **REQ-AICREDENTIALS-28** Xoá credential không xoá `MatchResult` cũ: `credentialId` về `null`, `provider` / `chatModel` / `embedModel` đã chụp vẫn giữ nguyên và đọc lại được qua `GET /match/:id`.

## Kiểm tra kết nối

- **REQ-AICREDENTIALS-29** `POST /ai-credentials/:id/test` → 200 `{ status, chat, embed, testedAt }`; ping **cả** chat lẫn embeddings; `status` = trạng thái nặng nhất theo thứ tự `invalid_key` > `no_quota` > `model_unavailable` > `timeout` > `unreachable` > `ok`; lưu `lastTestStatus` + `lastTestedAt`. Credential không tồn tại / không thuộc user → 404 trước khi gọi provider.
- **REQ-AICREDENTIALS-30** Phân loại lỗi provider: HTTP 401/403 → `invalid_key`; 402/429 → `no_quota`; 404, hoặc 400 có chữ "model" → `model_unavailable`; quá 20 s → `timeout`; còn lại (DNS, socket, 5xx) → `unreachable`. Không lưu, trả hay log message thô của provider.
- **REQ-AICREDENTIALS-31** Nút Test trên dòng: hiện loading khi đang chạy; xong → tag và thời gian của dòng cập nhật, toast "Connection tested" / "Đã kiểm tra kết nối"; request lỗi → toast "Could not test the credential", dòng giữ nguyên.
- **REQ-AICREDENTIALS-32** `POST /:id/test` bị giới hạn **10 request / 60 s** mỗi IP (request thứ 11 → 429 kèm `Retry-After`), chặt hơn mức toàn cục 100 / 60 s.

## Cấu hình

- **REQ-AICREDENTIALS-33** Thiếu hoặc sai độ dài `CREDENTIAL_ENCRYPTION_KEY` → mọi endpoint credential trừ `/providers` trả 503 `aiCredentials.errors.cryptoNotConfigured`; các endpoint khác của app vẫn chạy.

## Tích hợp wizard (step 3 "Chạy bằng")

- **REQ-AICREDENTIALS-34** User đã đăng nhập ở step 3 thấy khối "Run with" / "Chạy bằng": mỗi credential một checkbox (tag provider · label · `••••last4` · tag trạng thái, không kèm thời gian) cộng dòng "System key" / "Key hệ thống" có tag "fallback" / "dự phòng"; nút "Add credential" mở đúng modal tạo, credential vừa lưu được **tự tick**.
- **REQ-AICREDENTIALS-35** Lựa chọn mặc định (đặt một lần khi danh sách về): credential có `lastUsedAt` mới nhất; chưa credential nào từng chạy → credential mới tạo nhất; chưa có credential nào → "System key", không có cảnh báo.
- **REQ-AICREDENTIALS-36** Credential chưa kiểm tra hoặc kiểm tra không `ok` vẫn chọn được; khi có ít nhất một cái như vậy được chọn → cảnh báo đếm đúng số nhiều (`credentials.runWith.untestedCount`, `_one` / `_other`); credential `ok` không được tính.
- **REQ-AICREDENTIALS-37** Credential đang được chọn mà bị xoá ở nơi khác → khi danh sách làm mới, nó tự rơi khỏi danh sách và khỏi lựa chọn (dòng quyền riêng tư không còn nhắc provider của nó).
- **REQ-AICREDENTIALS-38** Chạy match bằng credential → `MatchResult` chụp `credentialId`, `provider`, `chatModel`, `embedModel` của credential (model rỗng → mặc định provider), kể cả khi kết quả `failed`; credential được cập nhật `lastUsedAt` sau khi ghi kết quả — kể cả khi `failed`. Không truyền `credentialId` → chạy key hệ thống, `credentialId = null`.
- **REQ-AICREDENTIALS-39** `POST /match` với `credentialId` không thuộc user → 404 "Credential not found." và **không** tạo `MatchResult`; `credentialId` không phải UUID → 400. Khách gửi `credentialId` → 403 `code: "GUEST_FORBIDDEN_CREDENTIAL"` `matching.errors.guestCredential`.

## i18n · a11y · Swagger

- **REQ-AICREDENTIALS-40** Mọi chuỗi của trang, modal, Popconfirm, toast, tag trạng thái, khối "Chạy bằng" và cảnh báo có đủ `en` + `vi`, không lộ key i18n thô; message lỗi server (`notFound`, `labelTaken`, `cryptoNotConfigured`, `guestCredential`) trả theo ngôn ngữ của request.
- **REQ-AICREDENTIALS-41** Modal: mở thì focus vào trường đầu tiên (Provider), `Esc` đóng, đóng xong focus trả về nút đã mở; mọi input có label liên kết (tìm được bằng `getByLabel`); lỗi validate gắn vào input (`aria-invalid` + `aria-describedby`) để screen reader đọc; nhóm checkbox "Run with" lộ ra là một nhóm (`role="group"`) có accessible name.
- **REQ-AICREDENTIALS-42** Trên màn cảm ứng 390 px, vùng bấm của nút "Add credential" và các action trên dòng (Test / Edit / Delete) ≥ 44×44 px.
- **REQ-AICREDENTIALS-43** Swagger: `apiKey` của `CreateAiCredentialDto` và `UpdateAiCredentialDto` đánh `writeOnly`, ví dụ là placeholder `sk-xxxx…`; DTO trả về không có `apiKey`; không ví dụ nào trong tài liệu trông như key thật.
