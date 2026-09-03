# ADR-0004 · Matching hybrid, và LLM không tham gia chấm điểm

> **Ngày:** 2026-07-14 (làm rõ 2026-08-08)
> **Trạng thái:** accepted
> **Liên quan:** FR-04 · NFR-COST-01 · invariant #7

## 1. Bối cảnh

Có ba cách chấm độ khớp CV↔JD: đếm từ trùng (rẻ, tái lập được, ngu), vector ngữ nghĩa
(bắt được cách diễn đạt khác chữ), và hỏi thẳng LLM (hiểu nhất, đắt nhất, và **không
tái lập được** — cùng input cho ra số khác nhau giữa hai lần chạy).

## 2. Quyết định

Dùng cả ba, nhưng **phân vai cứng**:

- **Keyword + vector chấm điểm**: `overallScore = round(0.6 × semanticScore + 0.4 × keywordScore)`.
- **LLM chỉ giải thích**: sinh `report.strengths` / `gaps` / `suggestions`. Con số nó
  nói ra không bao giờ đi vào công thức.

Keyword chạy ở **cấp token**, không phải cấp kỹ năng: tách token → lọc stopword →
`|JD ∩ CV| / |JD|`. Nó đo độ trùng **từ vựng**, không đo độ khớp **kỹ năng** —
`React` ≠ `ReactJS`. Vế semantic là cái bù cho điểm yếu đó.

## 3. Phương án đã loại

| Phương án | Vì sao loại |
| --- | --- |
| Để LLM chấm điểm tổng | Không tái lập được, và cost tăng theo mọi lần user muốn xem lại |
| Chỉ keyword | `React` ≠ `ReactJS`, và cách diễn đạt khác chữ bị bỏ sót hoàn toàn |
| Chỉ semantic | Không giải thích được vì sao, và không có neo nào để user kiểm |

## 4. Hệ quả

**Được:**
- Cùng một cặp tài liệu luôn ra cùng một điểm — điều kiện cần để so sánh phiên bản (FR-14) có nghĩa.
- Cost kiểm soát được: một call chat mỗi provider, phần còn lại tính trong app.

**Mất / phải chấp nhận:**
- Phần "thiếu kỹ năng nào" do LLM trả lời, nên nó là free-text và **sinh lại mỗi lần**
  (invariant #11).
- Con số keyword thô sơ hơn user tưởng khi nhìn thấy một phần trăm.

**Điều kiện xem lại quyết định này:** khi có cách chấm bằng LLM vừa tái lập được vừa
rẻ, hoặc khi trọng số 0.6/0.4 được đo lại trên dữ liệu thật.
