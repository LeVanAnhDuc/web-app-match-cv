# Luồng người dùng

> **Trả lời:** Người dùng đi qua những luồng nào từ đầu đến cuối?
> **Trạng thái:** 🟢 đủ
> **Cập nhật:** 2026-09-03 · commit —
> **Cập nhật khi:** có luồng người dùng mới · một luồng cũ đổi bản chất

<!-- CÁCH ĐIỀN
Viết bằng NGÔN NGỮ NGƯỜI DÙNG. Không có tên bảng, tên endpoint, tên component ở đây.
Mục "Điều gì có thể sai" là nguồn của test case và của các trạng thái lỗi trên UI.
KHÔNG chứa: chi tiết bố cục UI, danh mục chức năng (-> 02-requirements/scope.md).
-->

## US-01 · Chấm một CV với một tin tuyển dụng

**Bối cảnh:** Người tìm việc có sẵn CV và vừa thấy một tin tuyển dụng, muốn biết mình
khớp tới đâu trước khi bỏ công nộp.

**Các bước:**
1. Vào wizard, nạp JD — tải file PDF/DOCX lên hoặc dán thẳng nội dung.
2. Nạp CV theo cách tương tự.
3. Xem lại nội dung app đã đọc được từ hai tài liệu. **Chỉ đọc** — sai thì quay lại nạp lại.
4. Chạy chấm, xem báo cáo: phần trăm khớp, tách theo từ khoá và ngữ nghĩa, điểm mạnh,
   điểm thiếu, gợi ý sửa.

**Kết quả mong đợi:** Người dùng thấy một con số kèm lời giải thích vì sao lại là con số
đó; hệ thống đã lưu cả hai tài liệu và kết quả để mở lại sau.

**Điều gì có thể sai:**
- File hỏng, quá nặng, hoặc là ảnh scan không có chữ đọc được.
- Provider AI lỗi giữa chừng (sai khoá, hết hạn mức, timeout) — người dùng phải thấy
  đúng lý do, không phải một màn trắng.
- Tài liệu tiếng Việt bị chấm lệch thang so với tiếng Anh (xem `04-state/backlog.md` §Nợ).

**Chức năng liên quan:** FR-01 · FR-02 · FR-03 · FR-04 · FR-05

---

## US-02 · Dùng lại tài liệu đã nạp lần trước

**Bối cảnh:** Người dùng quay lại lần thứ hai, không muốn tải lại đúng cái CV cũ.

**Các bước:**
1. Vào thư viện CV hoặc thư viện JD.
2. Xem trước, đổi tên, tải lại bản gốc, hoặc xoá tài liệu không dùng nữa.
3. Ở wizard, chọn thẳng một tài liệu đã lưu thay vì nạp mới.

**Kết quả mong đợi:** Tài liệu của người này người khác không thấy; xoá được thứ đã cũ.

**Điều gì có thể sai:**
- Xoá một tài liệu đang được một kết quả match dùng → hệ thống phải chặn và nói rõ, không
  để lại kết quả mồ côi.
- Bản gốc là DOCX/PDF không xem trước được trên trình duyệt.

**Chức năng liên quan:** FR-02 · FR-06 · FR-07

---

## US-03 · Cắm khoá AI của riêng mình và so nhiều nhà cung cấp

**Bối cảnh:** Người dùng có sẵn khoá API của một dịch vụ AI và muốn dùng khoá đó, hoặc
muốn xem cùng một cặp CV↔JD được các bên chấm khác nhau ra sao.

**Các bước:**
1. Vào trang quản lý khoá AI, thêm khoá, đặt nhãn, **thử kết nối** trước khi dùng.
2. Ở bước chạy chấm, chọn một hoặc nhiều nhà cung cấp.
3. Đọc thông báo quyền riêng tư — nó nêu đích danh những bên sắp nhận tài liệu.
4. Xem kết quả: bên nào xong trước hiện trước, bên còn lại đang chờ.

**Kết quả mong đợi:** Khoá được lưu an toàn và **không bao giờ hiện lại nguyên văn**; chọn
nhiều bên thì nhận nhiều kết quả so được với nhau.

**Điều gì có thể sai:**
- Một bên lỗi, các bên khác vẫn phải giữ nguyên kết quả — hỏng một không hỏng cả.
- Người dùng chưa có khoá nào: vẫn chạy được bằng khoá hệ thống, một kết quả.

**Chức năng liên quan:** FR-09 · FR-10

---

## US-04 · Nhờ app viết lại CV theo những chỗ còn thiếu

**Bối cảnh:** Vừa xem xong báo cáo, người dùng biết mình thiếu gì nhưng không biết diễn
đạt lại thế nào.

**Các bước:**
1. Từ thẻ kết quả, bấm nhờ cải thiện CV.
2. Nhận một danh sách thay đổi đề xuất, mỗi thay đổi **trích nguyên văn đoạn cũ** để đối chiếu.
3. Tick từng thay đổi muốn nhận — mặc định không tick gì.
4. Lưu thành một CV **mới**, bản gốc giữ nguyên.

**Kết quả mong đợi:** CV mới nối vào CV cũ như một phiên bản kế tiếp.

**Điều gì có thể sai:**
- Đề xuất bịa kinh nghiệm người dùng không có → hệ thống loại ở máy chủ, nhưng bịa ở mức
  diễn đạt thì vẫn lọt; người dùng là chốt chặn cuối.
- Có những chỗ thiếu không viết lại được — phải nói thẳng là "cần kinh nghiệm thật".

**Chức năng liên quan:** FR-12

---

## US-05 · Sinh thư ứng tuyển cho đúng cặp CV↔JD vừa chấm

**Bối cảnh:** Người dùng đã có báo cáo và muốn một lá thư đi kèm hồ sơ.

**Các bước:**
1. Từ thẻ kết quả, mở phần sinh thư.
2. Chọn độ dài, giọng văn, và **ngôn ngữ lá thư** (độc lập với ngôn ngữ giao diện).
3. Sửa tại chỗ, sao chép, hoặc tải về dạng văn bản thuần.

**Kết quả mong đợi:** Mỗi lần sinh được lưu lại nên so được nhiều bản; lá thư **không nhận
những gì CV không chống lưng được**, và danh sách đã bị bỏ qua hiện ngay dưới thư.

**Điều gì có thể sai:**
- Provider lỗi → vẫn lưu lại lần chạy hỏng, không nuốt mất.

**Chức năng liên quan:** FR-13

---

## US-06 · Xem CV của mình đã tốt lên bao nhiêu

**Bối cảnh:** Người dùng đã sửa CV (bằng app hoặc tự tay) và muốn biết có thật sự tốt hơn.

**Các bước:**
1. Mở màn so sánh cho bản CV mới.
2. Chọn tin tuyển dụng muốn so trên đó.
3. Đọc chênh lệch điểm có dấu, và ba nhóm: đã đóng · còn lại · mới phát sinh.

**Kết quả mong đợi:** Một câu trả lời "tốt lên bao nhiêu", không phải hai con số rời.

**Điều gì có thể sai:**
- Bản mới chưa từng chấm với JD đó → màn này **không tự chạy chấm**, phải nói rõ và đưa
  người dùng về wizard.
- Hai lần chấm dùng model khác nhau → điểm không cùng thang, phải cảnh báo.
- Ghép chỗ thiếu cũ với chỗ thiếu mới là **ước lượng**, nên luôn hiện nguyên văn cả hai.

**Chức năng liên quan:** FR-14

---

## US-07 · Mở lại một kết quả đã chấm

**Bối cảnh:** Người dùng quay lại sau vài ngày, muốn tìm lại báo cáo cũ.

**Các bước:**
1. Từ trang chủ, xem danh sách kết quả gần đây.
2. Bấm một dòng để mở lại đúng báo cáo đó.

**Kết quả mong đợi:** Báo cáo cũ hiện lại y như lúc chấm.

**Điều gì có thể sai:**
- 🟡 **Chưa đủ**: mới có widget ở trang chủ, chưa có trang lịch sử riêng, chưa lọc/sắp xếp
  được, chưa xoá được một kết quả. Xem `04-state/backlog.md`.

**Chức năng liên quan:** FR-08

---

## US-08 · Nắm quyền với dữ liệu của mình

**Bối cảnh:** CV chứa thông tin cá nhân và đã được gửi tới bên thứ ba; người dùng muốn
biết và muốn rút lại.

**Các bước:**
1. Tải về toàn bộ dữ liệu của mình. ✅ có rồi (`/my-data`).
2. Xoá sạch, xác nhận hai bước. 🔴 chưa có.
3. Xem nhật ký: tài liệu nào đã gửi tới bên nào, lúc nào, thành công hay lỗi. 🔴 chưa có.

**Kết quả mong đợi:** Người dùng thấy được cả phần dữ liệu **đã rời khỏi hệ thống**.

**Điều gì có thể sai:**
- Ghi nhật ký hỏng thì **không được gọi AI** — thà không chạy còn hơn chạy mà không ghi lại.

**Chức năng liên quan:** FR-15 (xong) · FR-16 · FR-17 (🔴 chưa hiện thực) — xem `02-requirements/scope.md`.
