# ADR-0019 · Xem trước tài liệu render client-side, không qua dịch vụ ngoài

> **Ngày:** 2026-08-08 (ghi lại thành ADR 2026-09-03; trước đó chỉ nằm trong `.claude/techstack/frontend.md`)
> **Trạng thái:** accepted
> **Liên quan:** FR-07 · NFR-DATA-05 · ADR-0016

## 1. Bối cảnh

FR-07 cho user xem trước CV/JD đã lưu ngay trong thư viện. Cách rẻ nhất là nhúng một
dịch vụ xem tài liệu bên ngoài (Google Docs Viewer, Office Online) bằng một `<iframe>`.

Nhưng CV là PII bậc cao — tên, email, số điện thoại, lịch sử làm việc. Sản phẩm này đã
phải cảnh báo user **trước mỗi lần** tài liệu rời hệ thống để đi tới provider AI
(NFR-DATA-05). Một `<iframe>` viewer sẽ gửi đúng tài liệu đó tới một bên thứ hai, **im
lặng, mỗi lần user bấm xem**.

## 2. Quyết định

Render **hoàn toàn phía client**, không byte nào rời trình duyệt:

- PDF → `react-pdf` (pdf.js, render canvas)
- DOCX → `docx-preview` (render thẳng ra DOM)
- text → render thẳng

Cả hai thư viện chỉ chạy trong browser → **dynamic import + SSR-guard**, gói sau một
component duy nhất `#/components/DocumentPreview`.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| `<iframe>` tới Google Docs Viewer / Office Online | Gửi PII tới bên thứ ba mỗi lần bấm xem, không cảnh báo, không ghi lại. Mâu thuẫn thẳng với NFR-DATA-05 |
| Convert sang ảnh ở server rồi trả về | Thêm dependency nặng ở server, thêm bộ nhớ tạm chứa PII, và vẫn phải giải quyết chuyện render |
| Chỉ hiện `rawText` đã parse | Không kiểm được parse có đúng không — mà đó chính là việc user cần làm ở bước Review |

## 4. Hệ quả

**Được:**

- Xem trước không phải là một sự kiện tiết lộ dữ liệu, nên không cần cảnh báo và không
  cần dòng nhật ký ([ADR-0016](0016-nhat-ky-tiet-lo-la-bang-rieng.md)).
- Không phụ thuộc uptime hay điều khoản của một dịch vụ ngoài.

**Mất / phải chấp nhận:**

- Hai thư viện render nặng nằm trong bundle client — bắt buộc dynamic import, và một
  lần `import` sai chỗ là kéo cả pdf.js vào bundle chính.
- SSR phải guard: cả hai đụng `window`/`DOMMatrix`, render trên server là lỗi runtime.
- Chất lượng render DOCX không bằng viewer thương mại.

**Điều kiện xem lại quyết định này:** nếu bundle client phình tới mức không chấp nhận
được, hoặc nếu có viewer chạy hoàn toàn trong browser tốt hơn.
