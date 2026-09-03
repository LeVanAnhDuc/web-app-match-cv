# ADR-0013 · Nội dung do AI sinh phải neo vào CV gốc và do user duyệt

> **Ngày:** 2026-08-08
> **Trạng thái:** accepted
> **Liên quan:** FR-12 · FR-13 · invariant #13 · invariant #16

## 1. Bối cảnh

FR-12 và FR-13 sinh ra thứ user sẽ **gửi đi thật** cho nhà tuyển dụng. Một model được
bảo "hãy đóng các gap" sẽ đóng bằng cách bịa kinh nghiệm, và người chịu hậu quả pháp
lý lẫn đạo đức là user, không phải app.

## 2. Quyết định

Nội dung sinh ra chỉ được **diễn đạt lại thứ đã có** trong CV gốc.

- **CV rewrite**: mỗi thay đổi phải neo vào một đoạn **nguyên văn và duy nhất** của CV
  gốc. Neo bịa / mơ hồ / phình quá cỡ bị **loại ở server**, cả lúc sinh lẫn lúc lưu
  (`grounding.ts`). Output là **đề xuất dạng diff**, user tick từng cái, mặc định
  không tick gì; lưu thành `Document` mới, **không ghi đè** bản gốc.
- **Cover letter**: `report.gaps` đi vào prompt dưới nhãn **`MUST NOT CLAIM`**, và
  model phải trả `omittedRequirements` — thứ nó không dám nhận. UI hiện đúng danh sách
  đó ngay dưới lá thư.
- Gap không đóng được bằng viết lại thì trả về `unaddressedGaps` và nói thẳng là **cần
  kinh nghiệm thật**.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Chỉ dặn model trong prompt "đừng bịa" | Lời dặn không kiểm được bằng máy, nên không phải ràng buộc |
| Sinh thẳng ra CV hoàn chỉnh cho user tải về | User không có chỗ nào để phản đối từng câu |
| Ghi đè CV gốc | Mất bản gốc là mất neo, mất lineage, và mất đường quay lại |

## 4. Hệ quả

**Được:**

- Ràng buộc trở thành thứ **kiểm được bằng máy** và **user nhìn thấy**, không phải một
  câu trong prompt.
- Unit test assert prompt thực gửi đi có đủ ba tầng ràng buộc — gỡ ra là test đỏ.

**Mất / phải chấp nhận:**

- **Bịa ở mức ngữ nghĩa vẫn lọt**: model có thể neo đúng một đoạn thật rồi diễn đạt
  quá lên. Neo chặn được bịa *sự kiện*, không chặn được thổi phồng *mức độ*. User là
  chốt chặn cuối, và điều này được nói thẳng trong
  `specs/cv-rewrite-assistant/design.md` §3.
- Tỉ lệ đề xuất bị loại cao hơn, user thấy ít gợi ý hơn.

**Điều kiện xem lại quyết định này:** nếu có cách kiểm được thổi phồng ngữ nghĩa bằng máy.
