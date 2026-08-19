---
name: locales
paths:
  - "src/locales/**/*"
---

# Locales Convention (src/locales/)

i18n bằng **i18next + react-i18next**. Resource JSON tách theo ngôn ngữ và **namespace**:

```
src/locales/
  en/
    common.json
    wizard.json
    documents.json
  vi/
    common.json
    wizard.json
    documents.json
```

Được load bởi `src/i18n/config.ts` (đăng ký `resources` cho `en` + `vi`, mỗi file 1 namespace).

## Cấu trúc key — namespaced, phẳng theo feature

```json
// src/locales/en/wizard.json
{
  "appName": "CV ↔ JD Matcher",
  "stepper": {
    "progress": "Step {{n}} of 4",
    "jd": "Job Description",
    "cv": "Curriculum Vitae",
    "review": "Review",
    "result": "Result"
  }
}
```

```json
// src/locales/vi/wizard.json
{
  "appName": "Đối sánh CV ↔ JD",
  "stepper": {
    "progress": "Bước {{n}} / 4",
    "jd": "Mô tả công việc",
    "cv": "Sơ yếu lý lịch",
    "review": "Xem lại",
    "result": "Kết quả"
  }
}
```

Consumer: `const { t } = useTranslation('wizard')` → `t('stepper.progress', { n: step })`.

## Quy tắc

1. **Key phải khớp 1-1 giữa `en/` và `vi/`** — mỗi key thêm vào `en/<ns>.json` BẮT BUỘC thêm cùng key vào `vi/<ns>.json` (và ngược lại). Không để 1 phía thiếu key.
2. Tách file theo **namespace/feature** (`common`, `wizard`, `documents`), không dồn 1 file khổng lồ. Đăng ký namespace mới trong `src/i18n/config.ts`.
3. Interpolation dùng cú pháp i18next `{{var}}` (VD `{{n}}`), không nối chuỗi trong component.
4. KHÔNG hard-code chuỗi hiển thị trong component/dataSources/forms — mọi text đi qua `t(...)`.
5. Chuỗi `en` giữ nguyên `en` (source), bản dịch `vi` phải đầy đủ nghĩa tương ứng.
