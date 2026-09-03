# ADR-0014 · Keyword tiếng Việt chạy ở cấp âm tiết, không tách từ ghép

> **Ngày:** 2026-08-08
> **Trạng thái:** accepted
> **Liên quan:** FR-11 · nợ #1 ở `04-state/backlog.md`

## 1. Bối cảnh

Tokenizer cũ (`[^a-z0-9+#.]+`) coi mọi ký tự có dấu là dấu phân cách: `nghiệm` →
`nghi`, `hệ thống` → `th` + `ng`, `năm` mất hẳn. 40% trọng số điểm thành nhiễu với
tài liệu tiếng Việt — **một lỗi đang chạy trên `main`**. Sửa nó thì phải trả lời
tiếp: có tách từ ghép (word segmentation) không?

## 2. Quyết định

Tokenizer Unicode-aware (chữ có dấu không bị băm) + stopword tiếng Việt + normalize
alias kỹ thuật (`React` / `ReactJS` / `React.js` → `react`). Nhưng **không tách từ
ghép** — keyword chạy ở **cấp âm tiết**. Lý do: CV và JD đều viết rời từng âm tiết
theo cùng một kiểu (`hệ thống` → `hệ` + `thống` ở cả hai phía), nên phép đếm overlap
vẫn phản ánh đúng độ trùng.

Kèm theo: script chạy một lần tính lại `keywordScore` + `overallScore` cho
`MatchResult` cũ (`yarn recompute-scores`), **không tốn call AI**.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Kéo thư viện NLP tách từ ghép vào engine | Thêm một dependency nặng **và** một nguồn sai mới, để đổi lấy thứ overlap đã đo được |
| Từ điển VI↔EN cho cặp lệch ngôn ngữ | Vế semantic đã gánh việc đó; dựng bảng ánh xạ khái niệm là một sản phẩm khác |
| Để nguyên tokenizer cũ | Nó đang chấm sai 40% trọng số cho mọi tài liệu tiếng Việt |

## 4. Hệ quả

**Được:**

- Tài liệu tiếng Việt hết bị băm vụn; engine không nặng thêm.
- Đơn giản hoá **có chủ ý**, và ghi lại là có chủ ý.

**Mất / phải chấp nhận:**

- **Lập luận này đúng về *tín hiệu*, nhưng không nói gì về *sàn nhiễu*.** Đo lại
  2026-08-11: hai tài liệu tiếng Việt bất kỳ đã có sàn trùng ~30–43% chỉ vì cùng dùng
  âm tiết phổ thông, trong khi tiếng Anh ~5%. Hệ quả là **43% sai nghề > 33% đúng
  nghề**, và phần trăm giữa hai ngôn ngữ **không so được với nhau**. Đây là nợ #1 ở
  `04-state/backlog.md`, không phải một lỗi của ADR này.

**Điều kiện xem lại quyết định này:** khi trả nợ #1 — nếu cách trả là đổi sang
IDF/TF-IDF thì quyết định "cấp âm tiết" cần đọc lại cùng lúc.
