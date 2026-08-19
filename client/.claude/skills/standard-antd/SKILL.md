---
name: standard-antd
description: Ant Design 5 conventions for this project — ConfigProvider theming (cssVar + algorithm + tokens), @ant-design/cssinjs StyleProvider, the React 19 patch, icons (@ant-design/icons + lucide-react), when to use antd components vs raw elements, coexisting with Tailwind utilities, and antd Form. TRIGGER when building or reviewing any UI in client/src that uses antd components, theming, icons, or forms.
user-invocable: false
---

# Ant Design 5 Standard

This project builds UI with **Ant Design 5** (antd) for components + **Tailwind 4** for layout. There is no shadcn/ui, no Radix, no `components.json`, no CLI registry. Do not reach for shadcn patterns.

> Stack facts: `antd@^5`, `@ant-design/cssinjs@^2`, `@ant-design/icons@^6`, `@ant-design/v5-patch-for-react-19@^1`, `lucide-react`. Tailwind v4 via `@tailwindcss/vite`. Import alias `#/*`.

## Principles

1. **Use antd components first.** Before writing a styled `<div>`, check whether antd already has the component (`Button`, `Input`, `Select`, `Table`, `Form`, `Upload`, `Radio`, `Steps`, `Tabs`, `Modal`, `Card`, `Alert`, `Spin`, `Skeleton`, `Empty`, `message`, `notification`, …).
2. **antd for components, Tailwind for layout.** antd renders the interactive control; Tailwind utility classes handle spacing, flex/grid, and page layout **around** components — not their internal colors/typography.
3. **Theme through tokens, not overrides.** Drive color/radius/font from `ConfigProvider` `theme.token`. Do not override antd component internals with `!important` or ad-hoc CSS.
4. **Respect light + dark.** Theming flows through `theme.darkAlgorithm` / `theme.defaultAlgorithm`; every screen must read correctly in both.

## 1. Provider setup — the required boilerplate

antd is wired once in `src/providers/AntdProvider.tsx`, rendered inside `__root.tsx`'s `shellComponent`.

```tsx
// src/providers/AntdProvider.tsx
import { StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

function usePrefersDark() {
  const [isDark, setIsDark] = useState(false); // stable SSR default → updated after mount
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);
  return isDark;
}

export function AntdProvider({ children }: PropsWithChildren) {
  const isDark = usePrefersDark();
  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider
        theme={{
          cssVar: true,
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? "#6366f1" : "#2563eb",
            borderRadius: 8,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, ...'
          }
        }}
      >
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
```

Rules:

- **`cssVar: true`** — antd emits CSS variables for its tokens, which keeps runtime style injection cheap and lets tokens flip with the algorithm. Keep it on.
- **`algorithm`** switches the whole palette between `theme.defaultAlgorithm` (light) and `theme.darkAlgorithm` (dark). Drive it from the resolved color scheme; don't duplicate a second theme tree.
- **`token`** is the single place to set brand values (`colorPrimary`, `borderRadius`, `fontFamily`). Change the brand here, not per-component. For component-specific tweaks use `theme.components.<Component>` on `ConfigProvider`, not global CSS.
- **`StyleProvider hashPriority="high"`** (from `@ant-design/cssinjs`) raises antd's generated selector specificity so its component styles win over Tailwind's preflight/utility resets on the same element — this is what makes antd + Tailwind coexist. Keep it wrapping `ConfigProvider`.
- `usePrefersDark` starts `false` on the server and updates in `useEffect` — this avoids an SSR hydration mismatch. Do not read `window.matchMedia` during render. (See `standard-tanstack-start` §7.)

## 2. React 19 patch — required, and must be first

antd 5 + React 19 needs `@ant-design/v5-patch-for-react-19`, imported **before** anything else in `src/routes/__root.tsx`:

```tsx
import "@ant-design/v5-patch-for-react-19"; // FIRST line of __root.tsx
```

Without it: `console.error` flood about the React version, plus broken wave/ripple and `Modal`/`message`/`notification` portal behavior. Never remove it; never move it below other imports.

## 3. Icons

Two icon sources coexist:

- **`@ant-design/icons`** — use inside antd components where antd expects an icon node (`<Button icon={<SearchOutlined />}>`, `Input` `prefix`, `Menu` items, `Steps`, `Result`). These match antd's sizing/spacing.
- **`lucide-react`** — use for standalone / decorative iconography in your own markup where you control sizing with Tailwind.

Rules:

- Do not mix the two libraries for the same UI role — pick antd icons for antd-driven slots, lucide for bespoke ones.
- Icon-only buttons need an accessible name: `<Button icon={<CloseOutlined />} aria-label="Close" />`. Decorative icons: `aria-hidden` (see `standard-accessibility`).
- Import icons by name (`import { SearchOutlined } from '@ant-design/icons'`) — both libraries tree-shake per-icon.

## 4. antd component vs raw element

| Need                              | Use                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Action / submit                   | antd `Button` (`type="primary" \| "default" \| "text" \| "link"`, `danger`)           |
| Text / number / password input    | antd `Input`, `Input.TextArea`, `Input.Password`, `InputNumber`                       |
| Choice from a set                 | antd `Select`, `Radio.Group`, `Checkbox.Group`, `Switch`, `Segmented`                 |
| File upload                       | antd `Upload`                                                                         |
| Multi-step flow indicator         | antd `Steps`                                                                          |
| Tabular data                      | antd `Table`                                                                          |
| Container / grouping              | antd `Card`, `Divider`; layout via Tailwind flex/grid                                 |
| Overlay                           | antd `Modal`, `Drawer`, `Popover`, `Tooltip`, `Popconfirm`                            |
| Feedback                          | `message`, `notification`, `Alert`, `Result`, `Spin`, `Skeleton`, `Empty`, `Progress` |
| Plain layout wrapper / text block | raw `<div>`/`<section>`/`<p>` + Tailwind utilities                                    |

Rules:

- Loading state on a button: `<Button loading>` — don't hand-roll a spinner.
- Confirmation before a destructive action: `Popconfirm` or `Modal.confirm`, not a bespoke dialog.
- Toasts: `message`/`notification` from antd (call via `App.useApp()` when you need context-aware instances), not a custom toast.
- Empty/loading placeholders: `Empty` / `Skeleton` / `Spin`, not custom `animate-pulse` divs.
- Reserve raw elements for pure layout and static text — anything interactive should be an antd control (keyboard + a11y come for free).

## 5. Coexisting with Tailwind

- **Layout with Tailwind, styling with antd tokens.** Apply Tailwind for the box around a component:

```tsx
// ✅ Tailwind lays out; antd renders the controls
<div className="flex flex-col gap-4 md:flex-row md:items-end">
  <Input placeholder="Job title" />
  <Button type="primary">Search</Button>
</div>
```

- **Do not fight antd internals with Tailwind.** Avoid `className` that overrides an antd component's colors, padding, border, or typography (e.g. don't slap `bg-*`/`text-*`/`p-*` on a `<Button>` to restyle it). Change those through `theme.token` / `theme.components`.
- `className`/`style` on an antd component is for occasional layout nudges (margin, width, flex child sizing) — not a re-skin.
- Spacing/size shorthands from the Tailwind skill still apply to your own markup (`gap-*` over `space-*`, `size-*` over `w-* h-*`).
- Keep Tailwind preflight ON (it is, via `src/styles.css`); `hashPriority="high"` is what prevents preflight from stripping antd's look.

## 6. Forms — antd `Form`

Use antd `Form` for forms in this project (the stack chose antd `Form` over a separate form lib):

```tsx
import { Form, Input, Button } from "antd";

const Login = () => {
  const [form] = Form.useForm();
  const handleFinish = (values: { email: string; password: string }) => {
    // submit via a mutation hook
  };
  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark>
      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, type: "email", message: "Enter a valid email" }
        ]}
      >
        <Input autoComplete="email" />
      </Form.Item>
      <Form.Item
        name="password"
        label="Password"
        rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit">
        Sign in
      </Button>
    </Form>
  );
};
```

Rules:

- Validation via `Form.Item` `rules` — antd shows errors inline under the field and wires `aria-invalid`/`aria-describedby` for you. Don't build a parallel manual error state.
- `layout="vertical"` (label above input) matches the a11y/uiux form guidance.
- Submit on `onFinish` (fires only when validation passes); wire the actual write to a React Query `useMutation`. Mutations are user-triggered (submit handler), never on mount (see `standard-react` §8).
- Localize labels/messages/placeholders through i18next (`useTranslation`), not hardcoded strings.

## When writing antd code

- Provider chain stays: `StyleProvider hashPriority="high"` → `ConfigProvider (cssVar + algorithm + token)`; the React-19 patch import stays first in `__root.tsx`.
- Prefer an antd component over custom markup for anything interactive; raw elements + Tailwind for layout only.
- Theme via tokens/algorithm; never restyle antd internals with Tailwind classes or `!important`.
- antd icons for antd slots, lucide-react for bespoke icons; icon-only controls get `aria-label`.
- Forms use antd `Form` + `Form.Item` rules; submit through a mutation; support light + dark and EN + VI.
