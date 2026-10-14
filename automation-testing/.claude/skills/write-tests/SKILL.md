---
name: write-tests
description: Đóng vai tester để sinh bộ test E2E Playwright cho một module của Match CV — tự đọc requirement ở các nơi chốt trong src/docs/requirement-sources.md (docs + code của app), lấy thêm từ user khi chưa rõ hoặc user bổ sung (không Jira), hỏi làm rõ đến hết mơ hồ, viết requirements + test cases theo 6 lăng kính, sinh page object và script UI + API, chạy và heal, phân loại bug thật. Trigger khi user gõ `/write-tests <module>` hoặc nói "viết test cho feature X", "sinh test e2e cho X".
---

# write-tests

Gọi: `/write-tests <module>`, vd `/write-tests sign-up`.
Đọc `CLAUDE.md` của repo và `README.md` của các thư mục sẽ ghi vào trước khi làm bất cứ bước nào.
`<MODULE>` = `<module>` viết HOA bỏ gạch (`sign-up` → `SIGNUP`), dùng trong mã REQ / TC / BUG.

Output (đường dẫn tính từ `src/`):

| File | Nội dung |
|---|---|
| `docs/requirements/<module>.md` | `REQ-<MODULE>-NN` |
| `docs/decisions/<module>.md` | nguồn, quyết định chốt, tài khoản, ngoài phạm vi |
| `test-cases/<module>.md` | `TC-<MODULE>-NNN` |
| `pages/`, `components/`, `api/`, `data/copy.ts` | page object, component, client, text mới |
| `tests/e2e/<module>/*.e2e.ts`, `tests/api/<module>/*.api.ts` | spec theo chủ đề |
| `defects/<module>.md` | `BUG-<MODULE>-NN` nếu có bug |

## Gọi từ flow phát triển feature (hai pha)

Khi một feature mới đang được làm theo flow của project (vd skill `feature-flow`), skill này chạy **hai lần**:

| Pha | Lúc nào | Bước | Nguồn requirement |
|---|---|---|---|
| **A — test case** | ngay sau khi tài liệu thiết kế của feature được duyệt, **trước** khi build | 1, 2, 3, 4, 6 | tài liệu feature vừa duyệt (design + FR/US mới) là nguồn chính; docs/code khác theo `requirement-sources.md` |
| **B — tự động hoá** | sau khi build xong và đã xem app chạy thật | 5, 7, 8, 9 | chỉ `requirements/<module>.md` + `decisions/<module>.md` đã viết ở pha A |

Ở pha A, thiết kế vừa duyệt đã là quyết định của user: **không hỏi lại** những gì nó đã chốt, chỉ hỏi chỗ còn mơ hồ cho việc
kiểm thử (biên, lỗi, quyền, trạng thái). Test case viết cho hành vi **sẽ** có, nên chưa có `Automated:` — để `manual — chờ
pha B` rồi pha B điền đường dẫn spec. Cổng duyệt test case ở bước 6 là cổng duy nhất của pha A.
Pha A chỉ viết **tài liệu**: không page object, không locator, không spec e2e/API, không client endpoint — chưa có giao
diện, element, endpoint hay response thật để nhìn. Mọi thứ đó viết ở pha B, sau khi planner quan sát app đang chạy.
Gọi đứng riêng (module đã ship, không qua flow feature) → chạy liền bước 1→9 như dưới.

## Bước 1: Tự đọc nguồn requirement

Nơi đọc requirement được chốt sẵn trong `src/docs/requirement-sources.md` (user đã xác nhận lúc scaffold). Đọc file đó
trước, rồi chỉ đọc đúng các nơi nó liệt kê. **Không** dùng Jira/Confluence, **không** hỏi lại user chọn nguồn.

1. **Tài liệu** (mục "Tài liệu"): bắt đầu từ file bản đồ nếu có, rồi đọc mọi tài liệu nhắc tới module (spec/design của
   feature, phạm vi chức năng, luồng người dùng, quy tắc nghiệp vụ). Tìm theo tên module, route, tên màn hình, mã ID.
   Bỏ qua những gì nằm ở mục "Không đọc như nguồn đúng".
2. **Code** (mục "Code"): FE (route, form, validation, text locale, trạng thái loading/lỗi/rỗng) và BE (route/controller,
   DTO/schema validation, service, exception + message, phân quyền).
3. **User**: những gì user mô tả hoặc dán vào chat. User có thể bổ sung requirement **bất cứ lúc nào** trong flow; đó là
   nguồn có thẩm quyền cao nhất. Ghi nguyên văn vào `decisions/<module>.md`. User chỉ thêm một **nơi** mới (thư mục,
   file) → thêm vào `src/docs/requirement-sources.md` luôn để lần sau đọc được.

**Test đã gom về lúc scaffold** (nếu có, xem `src/docs/migrated-tests.md`): spec trong `src/tests/e2e/<module>/`,
`src/tests/api/<module>/` chưa gắn `@TC-…`, cùng `src/test-cases/<module>.md` / `src/defects/<module>.md` chuyển từ
tài liệu cũ. Đọc để biết case nào từng được nghĩ tới, dữ liệu/tài khoản nào từng dùng, bug nào từng ghi. Đây là gợi ý
hành vi, **không phải requirement**: kỳ vọng trong test cũ mâu thuẫn với docs/user thì đưa vào bước 3 như mọi mâu thuẫn khác.

Đọc xong, báo user ngắn gọn: đã đọc những file docs/code nào, docs có nói về module không. Rồi hỏi một câu: **"Bạn có
requirement hay tài liệu nào bổ sung cho module này không?"** Chưa có docs nào nhắc tới module → nói rõ, và yêu cầu user
mô tả hành vi mong muốn thay vì tự suy ra từ code.

## Bước 2: Đối chiếu nguồn

Ghi nhận ba thứ: yêu cầu tường minh, hành vi ngầm định, và mâu thuẫn giữa các nguồn (vd docs nói X nhưng code làm Y,
user nói Z). Thứ tự thẩm quyền: user > docs > code. Mâu thuẫn không tự chốt mà đưa vào bước 3.

**Hành vi chỉ thấy trong code** (docs không nói): code cho biết app *đang* làm gì, không cho biết *nên* làm gì. Với từng
hành vi quan trọng, hỏi user "đây là hành vi mong muốn hay bug?" trước khi ghi thành requirement.

## Bước 3: Hỏi làm rõ, từng câu một

Thứ tự ưu tiên: mâu thuẫn giữa nguồn, rồi hành vi khi lỗi/biên, rồi quyền & trạng thái, rồi phạm vi ngoài.
Ưu tiên câu trắc nghiệm, kèm gợi ý của mình. Lặp lại đến khi không còn mơ hồ.

⛔ **DỪNG**: chỉ đi tiếp khi user xác nhận "requirement đã rõ".

## Bước 4: Requirements + decisions

- `src/docs/requirements/<module>.md`: tiêu đề `# <MODULE> — <tên>`, mỗi yêu cầu một dòng `- **REQ-<MODULE>-NN** …`. Mã cố định.
- `src/docs/decisions/<module>.md`: Nguồn, Quyết định chốt qua hỏi đáp (Q1…), Tài khoản test, Ngoài phạm vi, Tech debt liên quan.

**Từ bước 5 trở đi chỉ đọc hai file này**, không đọc lại nguồn gốc.

## Bước 5: Khám phá app (MCP, chỉ quan sát)

App phải đang chạy thật. Gọi subagent `playwright-test-planner` với seed `src/tests/seed.spec.ts`: nó lái trình duyệt qua
Playwright MCP, khám phá các màn hình/endpoint mà requirement nhắc tới, báo lại selector, thông điệp, điều hướng và request
mạng thật. Bỏ qua test plan của planner, chỉ dùng phần quan sát được; test case do bước 6 viết theo quy ước repo.

Thứ tự vai trò từ đây: **planner quan sát (MCP)** → bước 7 viết page object + spec (`playwright-test-generator` hoặc tự
viết) → bước 8 **chạy test để verify** → `playwright-test-healer` sửa script khi đỏ → bước 9 phân loại bug. Quan sát bằng
MCP không thay cho việc chạy test: chỉ kết quả `test` mới là bằng chứng.

## Bước 6: `src/test-cases/<module>.md`

Áp 6 lăng kính trong `CLAUDE.md` theo đúng thứ tự, dùng format trong `src/test-cases/README.md`.
Requirement nào chưa có case thì phải giải thích lý do (hoặc ghi case `Automated: manual — <lý do>`).

⛔ **DỪNG**: user duyệt và bổ sung test case. Sửa theo góp ý, lặp lại đến khi user duyệt.

## Bước 7: Page object + script

1. **Lớp dưới trước:** locator và hành động màn hình mới vào `src/pages/<area>/<name>.page.ts` (kế thừa `BasePage`) hoặc
   `src/components/`; endpoint mới vào `src/api/<resource>.client.ts` (gộp ở `api/index.ts`); text vào `src/data/copy.ts`
   kèm file nguồn; dữ liệu vào `src/data/test-data.ts`. Page object mới thì thêm vào `src/fixtures/pages.fixture.ts`.
   Cần tiện ích chưa có (mail.tm, TOTP, rate gate…) → xem bảng trong `src/utils/README.md`.
2. **Spec:** gọi subagent `playwright-test-generator` cho từng case (hoặc tự viết khi đã đủ locator từ bước 5), với ràng buộc:
   - Import `test`, `expect` từ `@/fixtures`, dùng page object / component / `api`, không locator thô, không `request` trần.
   - Tên test = tiêu đề TC (không mã, không tag). Tag qua `{ tag: ["@TC-<MODULE>-NNN", …] }` theo bảng trong `CLAUDE.md`.
   - Case UI vào `src/tests/e2e/<module>/<topic>.e2e.ts`, case API vào `src/tests/api/<module>/<topic>.api.ts`, chia theo chủ đề.
   - Ghi đường dẫn spec (tính từ `src/`) vào dòng `Automated` của từng TC.

Chạy `pnpm typecheck` và `pnpm coverage:check`, sửa đến khi cả hai xanh.

## Bước 8: Chạy + heal

Chạy `pnpm test src/tests/e2e/<module> src/tests/api/<module>`. Case đỏ thì gọi subagent `playwright-test-healer`, tối đa 3 vòng.
Khi giao cho healer, **cấm sửa kỳ vọng** (giá trị mong đợi, status code, message) trừ khi chứng minh được kỳ vọng sai so với
requirement/decision. Sửa selector thì sửa trong page object/component, không vá trong spec.

## Bước 9: Phân loại case còn đỏ

- **Lỗi script** (selector, timing, dữ liệu): sửa tiếp.
- **Bug thật** (app lệch requirement): thêm `test.fail()` kèm comment `// BUG: defects/<module>.md#bug-<module>-nn` ngay trên,
  rồi ghi vào `src/defects/<module>.md` theo mẫu trong `src/defects/README.md`.

Chạy `pnpm coverage:check --write` để sinh lại `src/docs/traceability-matrix.md`.

Báo user: số case xanh / `test.fail()` / skip, và link `pnpm report`.

**Chuẩn hóa test đã gom:** module có spec gom về lúc scaffold → ở bước 7 **sửa chính các file đó** (đổi tên theo chủ
đề, chuyển locator vào page object, gắn tag TC, import từ `@/fixtures`) thay vì viết file mới song song. Case cũ không
còn khớp requirement thì xóa và nói lý do (ngoài phạm vi / thành TC manual / bỏ theo quyết định Qn). Xong thì đánh dấu
module là "đã chuẩn hóa" trong `src/docs/migrated-tests.md`. Mục `## Gom từ …` trong `test-cases/<module>.md` và
`defects/<module>.md` cũng xử lý xong ở lượt này: case nào thành TC, bug nào thành `BUG-…` (đang mở hay đã sửa), rồi xóa
mục đó.

Commit (khi user đồng ý): `test(<module>): add <module> e2e suite`.
