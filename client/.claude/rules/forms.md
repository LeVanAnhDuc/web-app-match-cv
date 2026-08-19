---
name: forms
paths:
  - "src/forms/**/*"
---

# Forms Convention (src/forms/)

Form dùng **Ant Design `Form`** (`Form`, `Form.Item`, `Form.useForm()`, `rules`). Mỗi form = 1 folder `forms/<FormName>/`. Folder này **có thể trống** cho tới khi có form thực sự.

> Wizard step hiện dùng input rời (Upload/paste) chưa cần antd `Form` — chỉ tạo `src/forms/<X>/` khi có form nhiều field cần validation tập trung.

## Cấu trúc

```
src/forms/
  SaveDocument/
    index.tsx          # component form (Form + Form.Item)
    fields.ts          # (optional) field name constants + default values
```

## Ant Design Form pattern

```tsx
import { Form, Input, Button } from "antd";
import type { CreateDocumentInput } from "#/types/Documents";

const SaveDocumentForm = ({
  onSubmit
}: {
  onSubmit: (values: { title: string }) => void;
}) => {
  const [form] = Form.useForm<{ title: string }>();

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        name="title"
        label="Title"
        rules={[
          { required: true, message: "Please enter a title." },
          { max: 120, message: "Title must be at most 120 characters." }
        ]}
      >
        <Input placeholder="e.g. Senior Frontend JD" />
      </Form.Item>
      <Button type="primary" htmlType="submit">
        Save
      </Button>
    </Form>
  );
};

export default SaveDocumentForm;
```

## Quy tắc

1. Validation khai báo qua `rules` trên `Form.Item` (built-in antd) — KHÔNG kéo RHF/Zod vào (stack dùng antd Form).
2. Lấy instance qua `Form.useForm()`; đọc/ghi giá trị qua `form.getFieldsValue()` / `form.setFieldsValue()`, submit qua `onFinish`.
3. Message trong `rules` nên tra i18n key (xem `locales.md`) khi có i18n, không hard-code chuỗi dài.
4. Type values của form dùng chung với request/hook → đặt ở `#/types/<Domain>` (xem `types.md`); nếu chỉ dùng nội bộ form thì inline type generic của `useForm<...>()`.
5. Mỗi form 1 folder; component form tuân `component-folder.md`.
