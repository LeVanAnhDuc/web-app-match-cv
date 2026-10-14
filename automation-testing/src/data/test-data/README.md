# data/test-data/

Giá trị test (hằng số, hàm sinh dữ liệu, body stub AI) — **một file mỗi module: `<module>.ts`**
(`cv-jd-matching-wizard.ts`, `cover-letter-generator.ts`…), do agent/người viết test của module đó sở hữu.

| File | Nội dung |
|---|---|
| `shared.ts` | Dùng ở nhiều module: `randomEmail()`, `uniqueSuffix()`, `FILES` (đường dẫn tuyệt đối tới `data/files/sample.pdf`/`.docx`) |
| `<module>.ts` | Chỉ module đó dùng: input mẫu, body JSON stub AI (`MatchResultDto`, `CvRewriteProposalDto`…) |

- Import: `import { FILES } from "@/data/test-data/shared"`, `import { … } from "@/data/test-data/<module>"`.
  `@/data/test-data` (file `data/test-data.ts`) chỉ re-export `shared.ts` cho import cũ.
- Một giá trị bắt đầu dùng ở module thứ hai → chuyển sang `shared.ts`.
- Chỉ giá trị: không `.env`, không mạng, không `pages/`, `api/`, `fixtures/`. Type DTO lấy từ `#/types/*`.
- File mẫu (PDF, DOCX…) nằm ở `data/files/`, không ở đây.
