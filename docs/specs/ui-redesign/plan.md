# Thiết kế lại toàn bộ UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa toàn bộ UI client sang bộ token mới (zinc + cyan, ba typeface tự host), thay signature element bằng `readout`, và sửa ba lớp lỗi đo được: tương phản, token bị bỏ qua, chuỗi khoá chiều cao.

**Architecture:** Đi từ tầng token lên tầng màn hình. Task 1 dựng nguồn màu/chữ duy nhất và một test chống trôi giữa CSS và antd. Task 2–4 dựng lại primitive (`SectionCard`, `Readout`) và sửa `AppShell`. Task 5–9 sửa hành vi Wizard. Task 10–12 quét sạch màu hard-code và chữ dưới ngưỡng tương phản. Không endpoint nào, không type DTO nào đổi.

**Tech Stack:** TanStack Start (React 19) · Ant Design 5 + `@ant-design/cssinjs` · Tailwind CSS 4 (`@theme`, không `@theme inline`) · Zustand · Vitest + `@testing-library/react` · Playwright (3 project viewport) · `@fontsource/*`

**Spec:** [`design.md`](design.md) · token: [`MASTER.md`](../../design-system/match-cv/MASTER.md) · quyết định: [ADR-0021](../../decisions/0021-token-zinc-cyan-ba-typeface.md)

## Global Constraints

- **Token là nguồn duy nhất.** Trong `client/src/**` không được có `blue-`, `indigo-`, `slate-`, `zinc-`, `cyan-` trong `className`. Dùng utility ở MASTER §2b.
- **`text-faint` bị cấm cho chữ.** Chỉ dùng cho icon và placeholder. Eyebrow dùng `text-muted`.
- **Eyebrow đúng một dạng:** `text-xs font-semibold tracking-wider uppercase text-muted`.
- **Số luôn** `font-mono tabular-nums`.
- **Cấm `h-screen`.** Dùng `min-h-dvh` + `lg:h-dvh lg:overflow-hidden` (MASTER §5 luật 1–2).
- **Không `shrink-0` cho khối có thể rộng hơn màn** (MASTER §5 luật 7).
- **Mobile-first:** class gốc là mobile, cộng `md:`/`lg:` lên.
- **antd cho mọi element có hành vi** (`client/.claude/rules/jsx.md` §1); ngoại lệ phải có comment ngay tại chỗ.
- **JSX không dòng trống, không `{/* */}`** (`jsx.md` §5).
- **Không hardcode chuỗi hiển thị** — mọi text qua `t(...)`, key đồng bộ `en`/`vi` (NFR-I18N-01).
- **Một component một folder + `index.tsx`, arrow fn, `export default` duy nhất** (`component-folder.md`).
- **Props viết inline tại tham số**, không `type Props` (`types.md`).
- Sau **mỗi** task: `yarn format && yarn lint && yarn type-check && yarn test` phải xanh trước khi commit.

---

### Task 1: Tầng token — font, CSS variable, antd, và test chống trôi

**Files:**
- Create: `client/src/constants/theme.ts`
- Create: `client/src/constants/__tests__/theme.test.ts`
- Modify: `client/src/constants/index.ts`
- Modify: `client/src/styles.css`
- Modify: `client/src/contexts/AntdProvider/index.tsx`
- Modify: `client/src/routes/__root.tsx` (preload woff2)
- Modify: `client/package.json`
- Modify: `client/.claude/rules/layout-primitives.md`

**Interfaces:**
- Produces: `THEME` từ `#/constants` — `THEME.light.primary`, `THEME.dark.primary`, `THEME.light.lineStrong`, `THEME.dark.lineStrong`, `THEME.fontFamily` (string). Task 2–12 không đọc trực tiếp; chỉ `AntdProvider` và test đọc.

- [ ] **Step 1: Cài ba font**

```bash
cd client && yarn add @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono
```

Dùng file CSS đầy đủ (`400.css`, không `latin-400.css`): nó khai báo `unicode-range` cho mọi subset kể cả **vietnamese**, nên trình duyệt chỉ tải subset thật cần. Bỏ subset vietnamese là dấu tiếng Việt rơi về font fallback.

- [ ] **Step 2: Viết test chống trôi (fail trước)**

Test này canh đúng bug đã xảy ra một lần: `colorPrimary` của antd lệch `--color-primary` của CSS.

```ts
// client/src/constants/__tests__/theme.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME } from "#/constants";

const css = readFileSync(resolve(__dirname, "../../styles.css"), "utf8");

function varsInBlock(marker: string) {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--color-([a-z-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim()
    ])
  );
}

describe("THEME khớp styles.css", () => {
  const light = varsInBlock("@theme {");
  const dark = varsInBlock("@media (prefers-color-scheme: dark)");

  it("primary của antd bằng --color-primary ở cả hai theme", () => {
    expect(THEME.light.primary).toBe(light.primary);
    expect(THEME.dark.primary).toBe(dark.primary);
  });

  it("colorBorder của antd bằng --color-line-strong, không phải --color-line", () => {
    expect(THEME.light.lineStrong).toBe(light["line-strong"]);
    expect(THEME.light.lineStrong).not.toBe(light.line);
  });

  it("khai báo đủ token của MASTER §2a ở cả hai theme", () => {
    const required = [
      "app", "surface", "surface-subtle", "line", "line-strong",
      "body", "muted", "faint", "primary", "primary-hover", "accent",
      "success", "warning", "error"
    ];
    for (const key of required) {
      expect(light[key], `light thiếu --color-${key}`).toBeDefined();
      expect(dark[key], `dark thiếu --color-${key}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/constants/__tests__/theme.test.ts`
Expected: FAIL — `Cannot find module '#/constants'` chưa export `THEME`, hoặc `light["line-strong"]` là `undefined`.

- [ ] **Step 4: Viết `THEME`**

```ts
// client/src/constants/theme.ts
export const THEME = {
  light: {
    primary: "#0e7490",
    primaryHover: "#155e75",
    lineStrong: "#71717a"
  },
  dark: {
    primary: "#0891b2",
    primaryHover: "#06b6d4",
    lineStrong: "#71717a"
  },
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
} as const;
```

Thêm vào barrel `client/src/constants/index.ts`:

```ts
export { THEME } from "./theme";
```

- [ ] **Step 5: Viết lại `styles.css`**

`@theme` thường, **không** `@theme inline` — inline nướng giá trị light vào từng utility và làm chết dark mode.

```css
@import "tailwindcss";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";

/*
 * Token ngữ nghĩa. Nguồn đúng: docs/design-system/match-cv/MASTER.md §2a.
 * Giá trị primary/line-strong được test src/constants/__tests__/theme.test.ts
 * đối chiếu với THEME, vì antd đọc THEME còn Tailwind đọc file này — lệch hai
 * chỗ là hai màu khác nhau trên cùng một màn.
 */
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-head: "Space Grotesk", "Inter", ui-sans-serif, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --color-app: #fafafa;
  --color-surface: #ffffff;
  --color-surface-subtle: #f4f4f5;
  --color-line: #e4e4e7;
  --color-line-strong: #71717a;
  --color-body: #18181b;
  --color-muted: #52525b;
  --color-faint: #71717a;
  --color-primary: #0e7490;
  --color-primary-hover: #155e75;
  --color-accent: #0e7490;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-error: #b91c1c;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-app: #09090b;
    --color-surface: #18181b;
    --color-surface-subtle: #09090b;
    --color-line: #3f3f46;
    --color-line-strong: #71717a;
    --color-body: #fafafa;
    --color-muted: #a1a1aa;
    --color-faint: #71717a;
    --color-primary: #0891b2;
    --color-primary-hover: #06b6d4;
    --color-accent: #22d3ee;
    --color-success: #4ade80;
    --color-warning: #fbbf24;
    --color-error: #f87171;
  }
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
}
```

Giữ nguyên khối comment "antd + Tailwind coexistence" đang có ở cuối file.

- [ ] **Step 6: Nối `AntdProvider` vào `THEME`**

```tsx
// client/src/contexts/AntdProvider/index.tsx — chỉ khối token
import { THEME } from "#/constants";

// ...
token: {
  // Phải bằng --color-primary của cùng theme, và colorBorder phải bằng
  // --color-line-strong (không phải --color-line): antd dùng colorBorder cho
  // viền input, và viền input là thứ duy nhất chỉ ra ranh giới control nên
  // phải đạt ≥3:1. Test src/constants/__tests__/theme.test.ts canh cả hai.
  colorPrimary: isDark ? THEME.dark.primary : THEME.light.primary,
  colorBorder: isDark ? THEME.dark.lineStrong : THEME.light.lineStrong,
  borderRadius: 8,
  fontFamily: THEME.fontFamily
}
```

- [ ] **Step 7: Preload woff2 trong `__root.tsx`**

Thêm vào `head` của route root, cạnh `HeadContent`. Chỉ preload weight vào first paint (Inter 400/500/600); các weight còn lại để `font-display: swap` lo — preload hết là kéo ngược first paint.

```tsx
links: [
  { rel: "preload", href: "/fonts/inter-latin-400.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/inter-latin-500.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/inter-latin-600.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" }
]
```

Nếu Vite hash tên file font khiến đường dẫn trên không tồn tại thì **bỏ ba dòng preload** và ghi vào `04-state/backlog.md` §Nợ kỹ thuật — một preload trỏ sai còn tệ hơn không preload, vì trình duyệt tải một file rồi bỏ đi.

- [ ] **Step 8: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/constants/__tests__/theme.test.ts`
Expected: PASS — 3 test.

- [ ] **Step 9: Sync rule file**

`client/.claude/rules/layout-primitives.md` chép lại bảng token và thang chữ nên nó trôi ngay lúc này. Sửa §1: đổi cột "Thay cho" từ `slate-*`/`blue-*` sang zinc/cyan, thêm dòng `border-line-strong`, và **xoá đoạn ngoại lệ** cho phép semantic giữ class Tailwind gốc — chính ngoại lệ đó là nguồn của lỗi tương phản. Sửa §4: thêm cột family và dòng "Số", đổi eyebrow từ `text-faint` sang `text-muted`. Sửa §5: "4 item" → "6 item".

- [ ] **Step 10: Commit**

```bash
git add client/package.json client/yarn.lock client/src/styles.css client/src/constants client/src/contexts/AntdProvider/index.tsx client/src/routes/__root.tsx client/.claude/rules/layout-primitives.md
git commit -m "feat(design-system): bootstrap token zinc + cyan va ba typeface tu host

Doi nguon mau va chu sang bo token moi theo ADR-0021. THEME o src/constants
la nguon antd doc, styles.css la nguon Tailwind doc, va mot test doi chieu hai
ben — lech hai cho la hai mau khac nhau tren cung mot man, da xay ra mot lan
voi bang mau cu.

colorBorder cua antd tro sang line-strong thay vi line: vien input la thu duy
nhat chi ra ranh gioi control nen phai dat >=3:1, con line (zinc-200) chi hop
le cho divider trang tri.

Lien quan: ADR-0021 - NFR-A11Y-01"
```

---

### Task 2: `SectionCard` — slot `eyebrow` và header xếp dọc ở mobile

**Files:**
- Modify: `client/src/components/SectionCard/index.tsx`
- Create: `client/src/components/SectionCard/__tests__/SectionCard.test.tsx`

**Interfaces:**
- Consumes: token utility từ Task 1.
- Produces: `SectionCard` nhận thêm prop `eyebrow?: ReactNode`. API cũ (`title` · `description` · `extra` · `footer` · `fill` · `stickyFooter` · `className` · `bodyClassName`) **không đổi** — mọi consumer hiện tại vẫn chạy.

- [ ] **Step 1: Viết test fail**

```tsx
// client/src/components/SectionCard/__tests__/SectionCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SectionCard from "../index";

describe("SectionCard", () => {
  it("render eyebrow bằng text-muted, không phải text-faint", () => {
    render(<SectionCard eyebrow="Lịch sử" title="Ghép gần đây">body</SectionCard>);

    const eyebrow = screen.getByText("Lịch sử");
    expect(eyebrow.className).toContain("text-muted");
    expect(eyebrow.className).not.toContain("text-faint");
    expect(eyebrow.className).toContain("uppercase");
  });

  it("header xếp dọc ở mobile và thành hàng từ md", () => {
    render(<SectionCard title="T" extra={<button>A</button>}>body</SectionCard>);

    const header = screen.getByRole("heading", { level: 2 }).closest("div")
      ?.parentElement;
    expect(header?.className).toContain("flex-col");
    expect(header?.className).toContain("md:flex-row");
    expect(header?.className).toContain("md:justify-between");
  });

  it("khối extra được co và wrap, không shrink-0", () => {
    render(<SectionCard title="T" extra={<button>A</button>}>body</SectionCard>);

    const extra = screen.getByRole("button", { name: "A" }).parentElement;
    expect(extra?.className).toContain("flex-wrap");
    expect(extra?.className).not.toContain("shrink-0");
  });

  it("không render header khi không có title, eyebrow lẫn extra", () => {
    render(<SectionCard>body</SectionCard>);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/components/SectionCard`
Expected: FAIL — `eyebrow` chưa là prop; header còn `shrink-0` và không có `flex-col`.

- [ ] **Step 3: Sửa `SectionCard`**

Ba thay đổi, không thêm gì khác: thêm `eyebrow`, header `flex-col md:flex-row`, và `extra` bỏ `shrink-0` đổi sang `min-w-0 flex-wrap`.

```tsx
const SectionCard = ({
  children,
  eyebrow,
  title,
  description,
  extra,
  footer,
  fill = false,
  stickyFooter = false,
  className = "",
  bodyClassName = "p-4 md:p-6"
}: PropsWithChildren<{
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  fill?: boolean;
  stickyFooter?: boolean;
  className?: string;
  bodyClassName?: string;
}>) => (
  <div
    className={`flex flex-col rounded-xl border border-line bg-surface shadow-sm ${
      fill ? "lg:h-full lg:overflow-hidden" : ""
    } ${className}`}
  >
    {(title || eyebrow || extra) && (
      <div className="flex shrink-0 flex-col gap-3.5 border-b border-line px-4 py-4 md:flex-row md:items-start md:justify-between md:gap-4 md:px-6 md:py-5">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="font-head text-xl font-bold break-words text-body">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        {extra && (
          <div className="flex min-w-0 flex-wrap gap-2 md:justify-end">
            {extra}
          </div>
        )}
      </div>
    )}
    <div
      className={`${bodyClassName} ${
        fill ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto" : ""
      }`}
    >
      {children}
    </div>
    {footer && (
      <div
        className={`flex shrink-0 items-center justify-between gap-4 border-t border-line bg-surface-subtle px-4 py-4 md:px-6 ${
          stickyFooter
            ? "sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:pb-4"
            : ""
        }`}
      >
        {footer}
      </div>
    )}
  </div>
);
```

`break-words` trên `h2` là bắt buộc: tiêu đề card ở màn kết quả là model id (`anthropic/claude-3.5-sonnet`), chuỗi không có chỗ ngắt tự nhiên, ở 375px nó đẩy header rộng hơn card.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/components/SectionCard`
Expected: PASS — 4 test.

- [ ] **Step 5: Chạy toàn bộ suite để bắt regression ở consumer**

Run: `cd client && yarn test`
Expected: PASS. `SectionCard` có nhiều consumer; test nào đỏ vì đổi cấu trúc header thì sửa **query của test**, không sửa lại markup.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/SectionCard
git commit -m "feat(ui): SectionCard them slot eyebrow va header xep doc o mobile

Header cu la mot hang flex voi extra dat shrink-0 va nut whitespace-nowrap. Ba
hanh dong o man ket qua cong lai rong hon 375px, va vi extra bi cam co nen no
tran ra va de len tieu de. Duoi 768 header xep doc, extra mot hang rieng; tu md
tro len van mot hang nhung extra duoc co va wrap.

Them break-words cho h2: tieu de card la model id, chuoi khong co cho ngat.

Lien quan: MASTER 5.7 - MASTER 6"
```

---

### Task 3: `Readout` — signature element

**Files:**
- Create: `client/src/components/Readout/index.tsx`
- Create: `client/src/components/Readout/__tests__/Readout.test.tsx`
- Modify: `client/src/locales/en/translation.json`
- Modify: `client/src/locales/vi/translation.json`

**Interfaces:**
- Produces: `Readout` với props inline:
  `{ label: string; value: number; unit?: string; scale?: boolean; delta?: { direction: "up" | "down" | "flat" } | { direction: "na" }; deltaValue?: number; tone?: "primary" | "success" | "warning" }`.
  `scale` mặc định `false`. Task 9 là consumer duy nhất.

- [ ] **Step 1: Thêm key i18n**

`vi`: `"readout": { "notComparable": "Không so được", "scaleMin": "0", "scaleMax": "100" }`
`en`: `"readout": { "notComparable": "Not comparable", "scaleMin": "0", "scaleMax": "100" }`

- [ ] **Step 2: Viết test fail**

```tsx
// client/src/components/Readout/__tests__/Readout.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "#/i18n/config";
import Readout from "../index";

describe("Readout", () => {
  it("biến thể plain KHÔNG vẽ thang — số đếm không có dải 0-100", () => {
    render(<Readout label="Sơ yếu lý lịch" value={12} />);

    expect(screen.getByText("12")).toBeDefined();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.queryByText("100")).toBeNull();
  });

  it("biến thể scale vẽ thang với aria-valuenow", () => {
    render(<Readout label="Độ khớp tổng" value={73} unit="%" scale />);

    const meter = screen.getByRole("meter", { name: "Độ khớp tổng" });
    expect(meter.getAttribute("aria-valuenow")).toBe("73");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
  });

  it("số dùng mono + tabular-nums", () => {
    render(<Readout label="L" value={73} unit="%" />);

    const el = screen.getByText("73");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("tabular-nums");
  });

  it("label là eyebrow text-muted, không bao giờ text-faint", () => {
    render(<Readout label="Độ khớp tổng" value={73} />);

    const label = screen.getByText("Độ khớp tổng");
    expect(label.className).toContain("text-muted");
    expect(label.className).not.toContain("text-faint");
  });

  it("delta na hiện 'không so được', không hiện mũi tên hay con số", () => {
    render(
      <Readout label="L" value={59} unit="%" scale delta={{ direction: "na" }} deltaValue={7} />
    );

    expect(screen.getByText(/không so được/i)).toBeDefined();
    expect(screen.queryByText("+7")).toBeNull();
  });

  it("delta up hiện dấu + và tô success", () => {
    render(
      <Readout label="L" value={73} unit="%" scale delta={{ direction: "up" }} deltaValue={8} />
    );

    const delta = screen.getByText("+8");
    expect(delta.parentElement?.className).toContain("text-success");
  });

  it("delta down giữ dấu âm và tô error", () => {
    render(
      <Readout label="L" value={65} unit="%" scale delta={{ direction: "down" }} deltaValue={-4} />
    );

    const delta = screen.getByText("-4");
    expect(delta.parentElement?.className).toContain("text-error");
  });

  it("delta flat hiện 0 và tô muted", () => {
    render(
      <Readout label="L" value={73} unit="%" scale delta={{ direction: "flat" }} deltaValue={0} />
    );

    expect(screen.getByText("0").parentElement?.className).toContain("text-muted");
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/components/Readout`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 4: Viết `Readout`**

```tsx
// client/src/components/Readout/index.tsx
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

const TONE = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning"
} as const;

function Delta({
  direction,
  value
}: {
  direction: "up" | "down" | "flat" | "na";
  value: number;
}) {
  const { t } = useTranslation();
  if (direction === "na") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Minus size={14} aria-hidden />
        {t("readout.notComparable")}
      </span>
    );
  }
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const tone =
    direction === "up"
      ? "text-success"
      : direction === "down"
        ? "text-error"
        : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${tone}`}>
      <Icon size={14} aria-hidden />
      <span className="font-mono tabular-nums">
        {direction === "up" ? `+${value}` : String(value)}
      </span>
    </span>
  );
}

const Readout = ({
  label,
  value,
  unit = "",
  scale = false,
  delta,
  deltaValue = 0,
  tone = "primary"
}: {
  label: string;
  value: number;
  unit?: string;
  scale?: boolean;
  delta?: { direction: "up" | "down" | "flat" | "na" };
  deltaValue?: number;
  tone?: keyof typeof TONE;
}) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold tracking-wider text-muted uppercase">
      {label}
    </p>
    <div className="flex flex-wrap items-baseline gap-2.5">
      <span className="font-mono text-3xl leading-none font-medium tabular-nums text-body md:text-4xl">
        {value}
        {unit && <span className="text-lg text-muted">{unit}</span>}
      </span>
      {delta && <Delta direction={delta.direction} value={deltaValue} />}
    </div>
    {scale && (
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative mt-1"
      >
        <div className="h-1.5 overflow-hidden rounded-full border border-line bg-surface-subtle">
          <div
            className={`h-1 rounded-full ${TONE[tone]}`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="absolute top-[-2px] left-1/4 h-2.5 w-px bg-line-strong" />
        <span className="absolute top-[-2px] left-1/2 h-2.5 w-px bg-line-strong" />
        <span className="absolute top-[-2px] left-3/4 h-2.5 w-px bg-line-strong" />
      </div>
    )}
    {scale && (
      <div className="flex justify-between font-mono text-[11px] text-faint">
        <span>{t("readout.scaleMin")}</span>
        <span>{t("readout.scaleMax")}</span>
      </div>
    )}
  </div>
);

export default Readout;
```

Ba `<span>` vạch thang dùng fraction của Tailwind (`left-1/4` · `left-1/2` · `left-3/4`) chứ không `repeating-linear-gradient`, để không có magic number (MASTER §1.4). `style={{ width }}` là ngoại lệ duy nhất được phép — giá trị chạy theo dữ liệu, không phải token.

`0`/`100` của thang là **phi-văn-bản** (nhãn trục, không phải nội dung đọc) nên `text-faint` ở đây hợp lệ ở ngưỡng 3:1.

⚠️ `t` phải lấy từ `useTranslation()` trong thân `Readout` — thêm `const { t } = useTranslation();` ở đầu component.

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/components/Readout`
Expected: PASS — 8 test.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Readout client/src/locales
git commit -m "feat(ui): them signature element Readout

Cho hien thi con so, thay gauge tron va ScoreBar. Thang vach 0-100 la phan mang
nghia: no noi con so DA DUOC DO chu khong phai mot y kien, dung bat bien #7 (LLM
o ngoai cong thuc).

Hai bien the, va chon sai la noi sai: scale co bar + thang cho phan tram, plain
KHONG ve thang cho so dem — ve thang cho '12 CV da luu' la bia ra mot gia tri
toi da khong ton tai.

Delta co trang thai na 'khong so duoc' theo bat bien #10: delta chi co nghia khi
cung chat model va cung embed model.

Lien quan: MASTER 7 - bat bien #7 - bat bien #10"
```

---

### Task 4: `AppShell` — sửa chuỗi khoá chiều cao

**Files:**
- Modify: `client/src/layouts/AppShell/index.tsx:38`
- Modify: `client/src/layouts/AppShell/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: token từ Task 1.
- Produces: `AppShell` nhận thêm `actionBar?: ReactNode` — render dưới `<main>`, ghim đáy ở **mọi** bề rộng. Task 8 là consumer duy nhất.

- [ ] **Step 1: Viết test fail**

```tsx
it("không dùng h-screen; khoá viewport chỉ ở desktop", () => {
  const { container } = renderShell();

  const shell = container.querySelector("div");
  expect(shell?.className).not.toContain("h-screen");
  expect(shell?.className).toContain("min-h-dvh");
  expect(shell?.className).toContain("lg:h-dvh");
  expect(shell?.className).toContain("lg:overflow-hidden");
});

it("render actionBar ghim đáy khi được truyền", () => {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell actionBar={<button>Lưu báo cáo</button>}>page body</AppShell>
    )
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  render(<RouterProvider router={router} />);

  const bar = screen.getByRole("button", { name: "Lưu báo cáo" }).parentElement;
  expect(bar?.className).toContain("sticky");
  expect(bar?.className).toContain("bottom-0");
  expect(bar?.className).not.toContain("lg:static");
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/layouts/AppShell`
Expected: FAIL — root div còn `h-screen`; `actionBar` chưa là prop.

- [ ] **Step 3: Sửa `AppShell`**

Đổi root từ `flex h-screen overflow-hidden bg-app` sang:

```tsx
<div className="flex min-h-dvh bg-app lg:h-dvh lg:overflow-hidden">
```

`h-screen` sai trên mobile vì toolbar động; khoá viewport chỉ được xảy ra ở desktop (MASTER §5 luật 1–2). Rồi bọc `<main>` để nhận `actionBar`:

```tsx
<div className="flex min-w-0 flex-1 flex-col">
  <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
    …giữ nguyên…
  </header>
  <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
  {actionBar && (
    <div className="sticky bottom-0 z-20 shrink-0 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
      {actionBar}
    </div>
  )}
</div>
```

Không có `lg:static`: đây là ngoại lệ của MASTER §5 luật 3 cho màn là một cột nhiều card — nền **đục** (không `/50`) để nội dung không lộ qua khi trôi bên dưới.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/layouts/AppShell`
Expected: PASS — 5 test.

- [ ] **Step 5: Commit**

```bash
git add client/src/layouts/AppShell
git commit -m "fix(a11y): AppShell thoi dung h-screen, khoa viewport chi o desktop

h-screen sai tren mobile vi toolbar dong, va khoa viewport khong dieu kien lam
lech chuoi khoa chieu cao (h-screen -> PageContainer h-full -> SectionCard fill)
nen footer cua Wizard troi xuong duoi noi dung va nguoi dung phai cuon toi cuoi
moi bam duoc. Doi sang min-h-dvh + lg:h-dvh lg:overflow-hidden.

Them prop actionBar cho man la mot cot nhieu card (Wizard step 4): no khong co
SectionCard nao de ghim footer vao.

Lien quan: MASTER 5.1 - MASTER 5.2 - MASTER 5.3"
```

---

### Task 5: `Stepper` — bước đã xong bấm được, bước chưa tới có explainer

**Files:**
- Modify: `client/src/views/Wizard/components/Stepper/index.tsx`
- Create: `client/src/views/Wizard/components/Stepper/__tests__/Stepper.test.tsx`
- Modify: `client/src/locales/{en,vi}/translation.json`

**Interfaces:**
- Consumes: `WizardStep` từ `#/types/Wizard`.
- Produces: `Stepper` nhận thêm `onJump: (step: WizardStep) => void` và `blockedFrom: WizardStep` (bước đầu tiên chưa đủ dữ liệu; mọi bước ≥ nó bị disabled). Task 6 nối vào store.

- [ ] **Step 1: Thêm key i18n**

`vi`: `"step": { "jumpTo": "Về bước {{label}}", "blocked": { "3": "Cần chọn CV và JD trước", "4": "Cần chạy match trước" } }` (giữ các key `step.*` đang có).
`en`: `"jumpTo": "Back to {{label}}", "blocked": { "3": "Pick a CV and a JD first", "4": "Run a match first" }`.

- [ ] **Step 2: Viết test fail**

```tsx
// client/src/views/Wizard/components/Stepper/__tests__/Stepper.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import Stepper from "../index";

describe("Stepper", () => {
  it("bước đã xong là button và gọi onJump", () => {
    const onJump = vi.fn();
    render(<Stepper current={3} blockedFrom={4} onJump={onJump} />);

    fireEvent.click(screen.getByRole("button", { name: /về bước.*mô tả công việc/i }));

    expect(onJump).toHaveBeenCalledWith(1);
  });

  it("bước hiện tại không phải button và có aria-current", () => {
    render(<Stepper current={3} blockedFrom={4} onJump={vi.fn()} />);

    const dot = screen.getByTestId("stepper-step-3");
    expect(dot.getAttribute("aria-current")).toBe("step");
    expect(dot.tagName).not.toBe("BUTTON");
  });

  it("bước chưa đủ dữ liệu bị disabled và mang explainer, không im lặng", () => {
    render(<Stepper current={3} blockedFrom={4} onJump={vi.fn()} />);

    const blocked = screen.getByTestId("stepper-step-4");
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    expect(blocked.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(/cần chạy match trước/i)).toBeDefined();
  });

  it("không gọi onJump khi bấm vào bước bị chặn", () => {
    const onJump = vi.fn();
    render(<Stepper current={3} blockedFrom={4} onJump={onJump} />);

    fireEvent.click(screen.getByTestId("stepper-step-4"));

    expect(onJump).not.toHaveBeenCalled();
  });

  it("không còn màu blue/indigo hard-code", () => {
    const { container } = render(<Stepper current={3} blockedFrom={4} onJump={vi.fn()} />);

    expect(container.innerHTML).not.toMatch(/blue-|indigo-/);
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/views/Wizard/components/Stepper`
Expected: FAIL — `onJump`/`blockedFrom` chưa tồn tại; `blue-600` còn trong markup.

- [ ] **Step 4: Sửa `Stepper`**

Giữ `data-testid` và `data-status` đang có (E2E dựa vào chúng). Ba thay đổi: màu qua token, bước done thành `<button>` bọc antd `<Tooltip>`, bước blocked có `aria-disabled` + explainer.

Class của `Dot` đổi thành:

```tsx
isActive
  ? "bg-primary text-white shadow-sm"
  : isDone
    ? "border border-primary/40 bg-primary/10 text-accent"
    : "border-2 border-line bg-surface text-faint"
```

`text-faint` trên dot là **màu icon**, không phải chữ — hợp lệ ở ngưỡng 3:1.

Bọc mỗi cell theo trạng thái:

```tsx
const label = t(s.labelKey);
const isBlocked = s.step >= blockedFrom;
const cell = (
  <div className="flex min-h-10 flex-col items-center gap-2">
    <Dot step={s.step} Icon={Icon} isActive={isActive} isDone={isDone} />
    <span className={labelClass(isActive, isDone)}>{label}</span>
  </div>
);
if (isDone)
  return (
    <Button type="text" className="!h-auto !p-0" aria-label={t("step.jumpTo", { label })} onClick={() => onJump(s.step)}>
      {cell}
    </Button>
  );
if (isBlocked)
  return (
    <Tooltip title={t(`step.blocked.${s.step}`)}>
      <div data-testid={`stepper-step-${s.step}`} aria-disabled="true" aria-describedby={`step-blocked-${s.step}`} className="cursor-not-allowed">
        {cell}
        <span id={`step-blocked-${s.step}`} className="sr-only">{t(`step.blocked.${s.step}`)}</span>
      </div>
    </Tooltip>
  );
return cell;
```

Line nối đổi `bg-blue-600 dark:bg-indigo-600` → `bg-primary`.

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/views/Wizard/components/Stepper`
Expected: PASS — 5 test.

- [ ] **Step 6: Commit**

```bash
git add client/src/views/Wizard/components/Stepper client/src/locales
git commit -m "feat(wizard): stepper bam duoc de nhay ve buoc da xong

Duong di nhanh cho nguoi da quen luong: bam thang len dinh man thay vi cuon tim
nut Quay lai. Buoc da xong thanh button; buoc hien tai giu aria-current; buoc
chua du du lieu aria-disabled kem explainer — MASTER 4b cam disabled im lang.

Doi luon mau cua stepper sang token: no dang giu blue-600/indigo-600 hard-code,
tuc primary CU nam cung trong class.

Lien quan: MASTER 8 - NFR-A11Y-02 - NFR-A11Y-03"
```

---

### Task 6: `wizardStore` — xoá kết quả cũ khi đổi tài liệu

**Files:**
- Modify: `client/src/stores/slices/wizard.ts`
- Modify hoặc Create: `client/src/stores/__tests__/wizard.test.ts`
- Modify: `client/src/views/Wizard/index.tsx`

**Interfaces:**
- Consumes: `Stepper` (`onJump`, `blockedFrom`) từ Task 5.
- Produces: slice `wizard` thêm `jumpTo(step)`; `setCvDocId` / `setJdDocId` xoá `runId`, `matchId`, `pendingCredentialIds`. `blockedFrom` suy từ state, không lưu.

- [ ] **Step 1: Viết test fail**

Đây là bug thật, không phải hệ quả phụ của stepper: `goBack` hiện không xoá `runId`/`matchId`, nên step 4 hiển thị kết quả của **cặp tài liệu khác**. Stepper bấm được làm nó dễ gặp hơn nhiều.

```ts
// client/src/stores/__tests__/wizard.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useWizardStore } from "#/stores";

describe("wizardStore", () => {
  beforeEach(() => useWizardStore.getState().reset());

  it("đổi CV xoá kết quả cũ — nếu không step 4 hiện kết quả của cặp tài liệu khác", () => {
    useWizardStore.setState({
      cvDocId: "cv-1",
      jdDocId: "jd-1",
      runId: "run-1",
      matchId: "match-1",
      pendingCredentialIds: ["cred-1"]
    });

    useWizardStore.getState().setCvDocId("cv-2");

    const s = useWizardStore.getState();
    expect(s.cvDocId).toBe("cv-2");
    expect(s.runId).toBeNull();
    expect(s.matchId).toBeNull();
    expect(s.pendingCredentialIds).toEqual([]);
  });

  it("đổi JD cũng xoá kết quả cũ", () => {
    useWizardStore.setState({ jdDocId: "jd-1", runId: "run-1" });

    useWizardStore.getState().setJdDocId("jd-2");

    expect(useWizardStore.getState().runId).toBeNull();
  });

  it("chọn lại đúng tài liệu đang chọn thì KHÔNG xoá kết quả", () => {
    useWizardStore.setState({ cvDocId: "cv-1", runId: "run-1" });

    useWizardStore.getState().setCvDocId("cv-1");

    expect(useWizardStore.getState().runId).toBe("run-1");
  });

  it("jumpTo chỉ đi về bước đã xong", () => {
    useWizardStore.setState({ step: 3, cvDocId: "cv-1", jdDocId: "jd-1" });

    useWizardStore.getState().jumpTo(1);
    expect(useWizardStore.getState().step).toBe(1);

    useWizardStore.getState().jumpTo(4);
    expect(useWizardStore.getState().step).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/stores`
Expected: FAIL — `setCvDocId` giữ nguyên `runId`; `jumpTo` chưa tồn tại.

- [ ] **Step 3: Sửa slice**

```ts
// trong slice wizard — chỉ phần liên quan
setCvDocId: (id) =>
  set((s) =>
    s.cvDocId === id
      ? s
      : { cvDocId: id, runId: null, matchId: null, pendingCredentialIds: [] }
  ),
setJdDocId: (id) =>
  set((s) =>
    s.jdDocId === id
      ? s
      : { jdDocId: id, runId: null, matchId: null, pendingCredentialIds: [] }
  ),
// Chỉ đi lùi. Nhảy tiến qua bước chưa đủ dữ liệu là một lần bấm sai, và với
// step 4 thì kết quả của nó là một màn rỗng.
jumpTo: (step) => set((s) => (step < s.step ? { step } : s)),
```

Nếu slice hiện đặt `cvDocId` qua một action khác (VD `onNext` của `DocumentInputStep` gọi `setCvDocId`) thì giữ đúng tên đang có; điều kiện `s.cvDocId === id` là phần bắt buộc.

- [ ] **Step 4: Nối `Stepper` vào store trong `Wizard/index.tsx`**

```tsx
const Wizard = () => {
  const step = useWizardStore((s) => s.step);
  const cvDocId = useWizardStore((s) => s.cvDocId);
  const jdDocId = useWizardStore((s) => s.jdDocId);
  const runId = useWizardStore((s) => s.runId);
  const matchId = useWizardStore((s) => s.matchId);
  const jumpTo = useWizardStore((s) => s.jumpTo);
  const blockedFrom = !jdDocId ? 2 : !cvDocId ? 3 : !runId && !matchId ? 4 : 5;
  return (
    <PageContainer className="flex flex-col lg:h-full">
      <Stepper current={step} blockedFrom={blockedFrom} onJump={jumpTo} />
      <div className="flex min-h-0 flex-1 flex-col">
        {step === 1 && <StepJD />}
        {step === 2 && <StepCV />}
        {step === 3 && <StepReview />}
        {step === 4 && <StepResult />}
      </div>
    </PageContainer>
  );
};
```

`blockedFrom` là `WizardStep | 5`; `5` nghĩa là không chặn bước nào. Nếu `WizardStep` là union `1|2|3|4` thì mở rộng type của prop thành `WizardStep | 5` chứ **không** nới `WizardStep` — nó dùng ở nơi khác.

`h-full` đổi thành `lg:h-full`: chỉ desktop khoá chiều cao (MASTER §5 luật 2).

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/stores src/views/Wizard`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/stores client/src/views/Wizard/index.tsx
git commit -m "fix(wizard): doi tai lieu xoa ket qua cu thay vi giu runId da het han

goBack khong xoa runId/matchId, nen nhay ve buoc 1/2 roi doi tai lieu lam step 4
hien ket qua cua CAP TAI LIEU KHAC. Bug nay co truoc stepper bam duoc, nhung
stepper lam no de gap hon nhieu.

setCvDocId/setJdDocId gio xoa runId, matchId va pendingCredentialIds — tru khi
chon lai dung tai lieu dang chon. jumpTo chi di lui.

Lien quan: MASTER 8"
```

---

### Task 7: Wizard step 1–3 — footer luôn trên màn

**Files:**
- Modify: `client/src/views/Wizard/components/DocumentInputStep/index.tsx`
- Modify: `client/src/views/Wizard/mains/StepReview/index.tsx`
- Create: `client/src/views/Wizard/components/DocumentInputStep/__tests__/DocumentInputStep.test.tsx`

**Interfaces:**
- Consumes: `SectionCard` (`fill`, `stickyFooter`) từ Task 2; `AppShell` đã sửa từ Task 4.

- [ ] **Step 1: Viết test fail**

```tsx
it("card khoá chiều cao ở desktop và footer sticky ở mobile", () => {
  const { container } = renderStep();

  const card = container.querySelector(".rounded-xl");
  expect(card?.className).toContain("lg:h-full");
  expect(card?.className).toContain("lg:overflow-hidden");

  const footer = screen.getByRole("button", { name: /tiếp tục/i }).parentElement;
  expect(footer?.className).toContain("sticky");
  expect(footer?.className).toContain("bottom-0");
});

it("eyebrow của danh sách đã lưu dùng text-muted", () => {
  renderStep();

  const heading = screen.getByRole("heading", { name: /đã lưu/i });
  expect(heading.className).toContain("text-muted");
  expect(heading.className).not.toContain("text-faint");
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/views/Wizard/components/DocumentInputStep`
Expected: FAIL — `h3` còn `text-faint`.

- [ ] **Step 3: Sửa hai file**

`DocumentInputStep`: `className="h-full"` → `className="lg:h-full"`, và dòng 181 đổi `text-faint` → `text-muted`. Giữ `fill` + `stickyFooter`.

`StepReview`: cùng cách — `className="h-full"` → `lg:h-full`, hai `h3` ở dòng 116 và 128 đổi `text-faint` → `text-muted`, và **thêm `stickyFooter`** (hiện chỉ có `fill`).

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/views/Wizard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/views/Wizard
git commit -m "fix(wizard): footer buoc 1-3 luon tren man, eyebrow dat tuong phan

StepReview thieu stickyFooter nen o mobile phai cuon toi cuoi moi bam duoc Chay
match. h-full doi thanh lg:h-full: chi desktop khoa chieu cao.

Eyebrow chuyen faint -> muted: 2.45:1 -> 7.41:1.

Lien quan: MASTER 5.2 - MASTER 5.3 - NFR-A11Y-01"
```

---

### Task 8: Wizard step 4 — thanh hành động ghim ở cấp shell

**Files:**
- Modify: `client/src/routes/_app/wizard.tsx`
- Modify: `client/src/views/Wizard/index.tsx`
- Modify: `client/src/views/Wizard/mains/StepResult/index.tsx`
- Create: `client/src/views/Wizard/mains/StepResult/__tests__/StepResult.test.tsx`

**Interfaces:**
- Consumes: `AppShell` prop `actionBar` từ Task 4.
- Produces: `StepResult` không còn render thanh hành động của riêng nó; `Wizard` truyền nó lên qua context của route.

- [ ] **Step 1: Viết test fail**

```tsx
it("StepResult không tự render thanh hành động — nó thuộc shell", () => {
  renderResult();

  const save = screen.getByRole("button", { name: /lưu báo cáo/i });
  expect(save.closest(".rounded-xl")).toBeNull();
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/views/Wizard/mains/StepResult`
Expected: FAIL — thanh hành động còn nằm trong một `div.rounded-xl` của `StepResult`.

- [ ] **Step 3: Chuyển thanh hành động lên shell**

Bỏ khối `<div className="flex items-center justify-between … rounded-xl …">` ở cuối `StepResult` (dòng 166–171 và 80–82). Đưa nó vào `AppShell` qua `actionBar` của route `_app/wizard.tsx`:

```tsx
// client/src/routes/_app/wizard.tsx
export const Route = createFileRoute("/_app/wizard")({
  component: Wizard
});
```

Vì `AppShell` được lắp ở `_app.tsx` chứ không ở `_app/wizard.tsx`, đường sạch nhất là để `Wizard` đặt `actionBar` vào slice `ui` của Zustand và `AppShell` đọc ra — **không** dùng portal, và **không** nhân đôi element trong DOM (MASTER §5 luật 5).

Thêm vào slice `ui`: `wizardActionBar: ReactNode | null` + `setWizardActionBar`. `Wizard` set nó trong `useEffect` theo `step`, và clear khi unmount:

```tsx
useEffect(() => {
  setActionBar(step === 4 ? <ResultActionBar /> : null);
  return () => setActionBar(null);
}, [step, setActionBar]);
```

`ResultActionBar` là component mới ở `client/src/views/Wizard/components/ResultActionBar/index.tsx`, chứa `Làm lại từ đầu` + `Lưu báo cáo`.

⚠️ Giữ `ReactNode` trong store là đi ngược `stores.md` (store giữ dữ liệu, không giữ element). Nếu reviewer chặn, phương án hai: `AppShell` nhận `actionBar` như đã làm ở Task 4 và `_app.tsx` render `<AppShell actionBar={...}>` dựa vào `useMatchRoute("/wizard")` + `useWizardStore(s => s.step)`. Chọn phương án hai nếu `stores.md` được đọc là cấm cứng — **ghi lựa chọn vào `04-state/backlog.md` §Nợ kỹ thuật nếu chọn phương án một.**

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/views/Wizard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/views/Wizard client/src/stores client/src/layouts/AppShell client/src/routes
git commit -m "feat(wizard): thanh hanh dong step 4 ghim o cap shell

Step 4 la mot cot nhieu card (moi nha cung cap mot card), khong co SectionCard
nao de ghim footer vao — nen thanh hanh dong troi xuong duoi noi dung o CA
desktop. Day la ngoai le duy nhat cua MASTER 5.3 (lg:static), da ghi vao luat do.

Lien quan: MASTER 5.3 - MASTER 6"
```

---

### Task 9: Nối `Readout` vào bốn consumer

**Files:**
- Modify: `client/src/views/Wizard/components/MatchResultCard/index.tsx`
- Modify: `client/src/views/Home/mains/StatCards/index.tsx`
- Modify: `client/src/views/CvComparison/components/ScoreDelta/index.tsx`
- Modify: `client/src/views/Home/mains/RecentMatches/index.tsx`
- Modify: `client/src/views/CvComparison/mains/ComparisonReport/index.tsx`

**Interfaces:**
- Consumes: `Readout` từ Task 3.

- [ ] **Step 1: Viết test fail**

```tsx
it("MatchResultCard hiện ba điểm số bằng Readout, không còn gauge SVG", () => {
  renderCard();

  expect(screen.getByRole("meter", { name: /độ khớp tổng/i })).toBeDefined();
  expect(screen.getByRole("meter", { name: /ngữ nghĩa/i })).toBeDefined();
  expect(screen.getByRole("meter", { name: /trùng từ vựng/i })).toBeDefined();
});

it("StatCards dùng plain cho số đếm và scale cho phần trăm", () => {
  renderStats();

  expect(screen.getByRole("meter", { name: /điểm cao nhất/i })).toBeDefined();
  expect(screen.queryByRole("meter", { name: /sơ yếu lý lịch/i })).toBeNull();
});

it("ScoreDelta báo 'không so được' khi khác model, không vẽ mũi tên", () => {
  renderDelta({ comparable: false, delta: 8 });

  expect(screen.getByText(/không so được/i)).toBeDefined();
  expect(screen.queryByText("+8")).toBeNull();
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/views/Wizard/components/MatchResultCard src/views/Home src/views/CvComparison`
Expected: FAIL — chưa có `role="meter"`.

- [ ] **Step 3: Thay gauge và ScoreBar**

`MatchResultCard`: xoá `GAUGE_RADIUS`, `GAUGE_CIRCUMFERENCE`, `dashOffset`, cả khối `<svg>` (dòng 285–315) và sub-component `ScoreBar` (dòng 24–41). Thay bằng ba `Readout` trong một grid:

```tsx
<div className="grid grid-cols-1 gap-4 border-b border-line bg-surface-subtle p-4 md:grid-cols-3 md:gap-6 md:p-6">
  <Readout label={t("result.overall")} value={result.overallScore} unit="%" scale />
  <Readout label={t("result.semantic")} value={result.semanticScore} unit="%" scale tone="success" />
  <Readout label={t("result.keyword")} value={result.keywordScore} unit="%" scale tone="warning" />
</div>
```

Ba điểm số là **một nhóm** nên ở `md` chúng lên 3 cột, không tách 2+1 (MASTER §5 bảng tầng).

`StatCards`: `savedCvs` / `savedJds` / `totalMatches` dùng `Readout` **không** `scale`; `highest` dùng `scale` + `tone="success"`. Số đếm không có dải 0–100 nên vẽ thang cho nó là bịa một giá trị tối đa không tồn tại.

`ScoreDelta`: nhận thêm prop `comparable: boolean`, render `Readout` với `delta={{ direction: comparable ? dir : "na" }}`. `ComparisonReport` truyền `comparable={data.sameChatModel && data.sameEmbedModel}` — cùng cờ đang dùng cho `Alert` cảnh báo model, giữ luôn `Alert` đó.

`RecentMatches`: dùng bản thu gọn (số mono + mũi tên, không thang) như MASTER §7 mô tả — không dùng `Readout` đầy đủ trong một `list-row`.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test`
Expected: PASS. Test cũ của `MatchResultCard` tìm text `"73%"` sẽ đỏ vì số và `%` giờ nằm ở hai `<span>` — sửa query sang `getByRole("meter")`, **không** ghép lại thành một node.

- [ ] **Step 5: Commit**

```bash
git add client/src/views/Wizard/components/MatchResultCard client/src/views/Home client/src/views/CvComparison
git commit -m "feat(ui): thay gauge tron va ScoreBar bang Readout

Gauge tron doc nhu do trang tri; readout co thang vach noi con so DA DUOC DO.
Ba diem so la mot nhom nen o md chung len 3 cot, khong tach 2+1.

StatCards: so dem dung bien the plain (khong thang), chi phan tram dung scale.
ScoreDelta: nhan co comparable va bao 'khong so duoc' thay vi ve mot mui ten bia
khi hai lan cham khac model — bat bien #10.

Lien quan: MASTER 7 - bat bien #10"
```

---

### Task 10: Quét sạch màu hard-code

**Files:**
- Modify: `client/src/views/Wizard/components/UploadPasteTabs/index.tsx:62,73`
- Modify: `client/src/views/Wizard/components/SavedDocRadioList/index.tsx:49,61`
- Modify: `client/src/views/Wizard/components/MatchResultCard/index.tsx:188,195,200,209,215,216,223,226`
- Modify: `client/src/views/CvComparison/components/GapDiffList/index.tsx:5-18`
- Modify: `client/src/views/CvRewrite/components/ChangeCard/index.tsx:48,57`
- Create: `client/src/__tests__/no-hardcoded-colour.test.ts`

- [ ] **Step 1: Viết test guard fail**

```ts
// client/src/__tests__/no-hardcoded-colour.test.ts
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FORBIDDEN = /\b(?:blue|indigo|slate|zinc|cyan)-(?:\d{2,3})\b/;

describe("không màu hard-code trong client/src", () => {
  it("mọi màu đi qua token của MASTER §2b", () => {
    const files = globSync("src/**/*.{ts,tsx}", {
      exclude: (p) => p.includes("routeTree.gen") || p.includes("__tests__")
    });
    const offenders = files.filter((f) =>
      FORBIDDEN.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
```

Nếu `globSync` chưa có ở Node của máy thì dùng `fast-glob` (đã là transitive dep của Vite) hoặc `fs.readdirSync` đệ quy — đừng thêm dependency mới cho một test.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/__tests__/no-hardcoded-colour.test.ts`
Expected: FAIL — liệt kê 4 file với 14 chỗ.

- [ ] **Step 3: Đổi từng chỗ sang token**

| Chỗ | Trước | Sau |
| --- | --- | --- |
| `UploadPasteTabs:62` | `bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400` | `bg-primary/10 text-accent` |
| `UploadPasteTabs:73` | `text-blue-600 dark:text-indigo-400` | `text-accent` |
| `SavedDocRadioList:49` | `border-blue-500 bg-blue-50/60 dark:…` | `border-primary bg-primary/10` |
| `SavedDocRadioList:61` | `accent-blue-600 dark:accent-indigo-500` | `accent-[--color-primary]` |
| `MatchResultCard:215` | `border-blue-100 bg-blue-50 dark:…` | `border-primary/20 bg-primary/5` |
| `MatchResultCard:216` | `text-blue-900 dark:text-white` | `text-body` |
| `MatchResultCard:223` | `border-blue-100 dark:border-indigo-500/20` | `border-primary/20` |
| `MatchResultCard:226` | `text-blue-600 dark:text-indigo-400` | `text-accent` |
| `MatchResultCard:188,195` | `text-green-600 dark:text-green-500` / `text-green-500` | `text-success` |
| `MatchResultCard:200,209` | `text-amber-600 dark:text-amber-500` / `text-amber-500` | `text-warning` |
| `GapDiffList:5-18` | `text-green-600 …` / `text-amber-600 …` / `text-red-600 …` | `text-success` / `text-warning` / `text-error` |
| `ChangeCard:48` | `border-red-100 bg-red-50 dark:…` | `border-error/25 bg-error/5` |
| `ChangeCard:57` | `border-green-100 bg-green-50 dark:…` | `border-success/25 bg-success/5` |

Semantic đi qua token là thay đổi so với rule cũ (nó cho phép giữ class Tailwind gốc) — chính ngoại lệ đó làm green-600 **3.30:1** và amber-600 **3.19:1** lọt qua ở theme sáng. Token light dùng `-700` nên đạt 4.56–4.81:1.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test && yarn build`
Expected: PASS, và build phải thành công — `accent-[--color-primary]` là arbitrary value đọc CSS variable, nếu Tailwind 4 không nhận thì đổi sang một `<input>` bọc bằng antd `<Radio>` và bỏ hẳn `accent-*`.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "refactor(ui): moi mau di qua token, khong con hard-code

14 cho trong 4 file dang giu primary CU (blue-600/indigo-*) nam cung trong class
thay vi qua bien, nen doi accent khong tu lan toi chung. Them mot test guard
quet ca client/src.

Semantic cua bao cao cung di qua token — ngoai le cho phep giu class Tailwind goc
chinh la nguon cua loi tuong phan: green-600 3.30:1 va amber-600 3.19:1 tren
trang, duoi nguong 4.5 cho chu strengths va gaps.

Lien quan: MASTER 2a - MASTER 2b - NFR-A11Y-01"
```

---

### Task 11: Quét `text-faint` khỏi mọi chỗ là chữ

**Files:**
- Modify (eyebrow, 17 chỗ / 11 file): `StepReview:116,128` · `StatCards:35` · `RewriteReview:155` · `RewriteRunWith:41` · `ChangeCard:32` · `ScoreDelta:32` · `RunWithSelector:80` · `CoverLetterModal:206,223,240,256,314,374` · `DocumentInputStep:181` · `MatchResultCard:311`
- Modify (chữ thường, 10 chỗ / 7 file): `StepReview:77` · `StepResult:45,105` · `RecentMatches:75` · `SavedDocRadioList:30,67` · `StatCards:39` · `GapDiffList:43` · `DocumentPreview:89,186`
- Create: `client/src/__tests__/no-faint-text.test.ts`

**Giữ nguyên** (icon, hợp lệ ở 3:1): `Stepper:42` · `RecentMatches:104` · `JdLibraryEmpty:11` · `CredentialList:105` · `SavedDocRadioList:26` · `CvLibraryEmpty:11` · `StepResult:44,104` · `StepReview:76` · `Readout` (nhãn trục thang).

- [ ] **Step 1: Viết test guard fail**

```ts
// client/src/__tests__/no-faint-text.test.ts
const EYEBROW = /tracking-wider[^"'`]*text-faint|text-faint[^"'`]*tracking-wider/;

it("không eyebrow nào dùng text-faint — 2.45:1, duoi nguong", () => {
  const offenders = files.filter((f) => EYEBROW.test(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});
```

Dùng lại helper liệt kê file của Task 10 — tách nó ra `client/src/__tests__/sourceFiles.ts` để hai test dùng chung, thay vì chép hai lần.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/__tests__/no-faint-text.test.ts`
Expected: FAIL — 11 file.

- [ ] **Step 3: Đổi 27 chỗ**

Eyebrow: `text-faint` → `text-muted` (giữ nguyên `text-xs font-semibold tracking-wider uppercase`).
Chữ thường: `text-faint` → `text-muted`.
Không đổi các chỗ `text-faint` đứng trên `<Icon>` hoặc placeholder.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "fix(a11y): text-faint thoi dung cho chu, eyebrow chuyen sang muted

Eyebrow dung text-faint la slate-400 tren slate-50 = 2.45:1, can 4.5 — va do la
chu text-xs uppercase doc that, khong phai trang tri. 17 eyebrow trong 11 file
cong 10 cho chu thuong chuyen sang muted (7.41:1). text-faint chi con cho icon
va placeholder, hop le o nguong 3:1.

Them test guard de khong tai dien.

Lien quan: MASTER 2a - MASTER 3 - NFR-A11Y-01"
```

---

### Task 12: Thư viện — thu nhóm hành động về một menu dưới `lg`

**Files:**
- Modify: `client/src/components/DocumentRow/index.tsx`
- Create: `client/src/components/DocumentRow/__tests__/DocumentRow.test.tsx`

- [ ] **Step 1: Viết test fail**

```tsx
it("dưới lg gom hành động vào một menu, không rải 6 nút", () => {
  renderRow();

  expect(screen.getByRole("button", { name: /hành động/i })).toBeDefined();
  expect(screen.queryByRole("button", { name: /xem trước/i })).toBeNull();
});
```

Test chạy ở `jsdom` nên breakpoint không có thật; render **một** cây DOM với antd `<Dropdown>` ở mọi bề rộng và để CSS quyết định hiển thị là **không** làm được (MASTER §5 luật 5 cấm nhân đôi element). Cách đúng: `<Dropdown>` là đường duy nhất ở **mọi** bề rộng, và ở `lg` nó thêm ba nút hay dùng nhất (`Xem trước` · `Đổi tên` · `Xoá`) cạnh menu. Sửa test cho khớp trước khi implement.

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd client && yarn test src/components/DocumentRow`
Expected: FAIL — 6 nút đang render thẳng.

- [ ] **Step 3: Sửa `DocumentRow`**

Giữ `Popconfirm` cho `Xoá` và mọi `aria-label` đang có (E2E dựa vào chúng). Sáu nút 40px không vừa một dòng ở 375px, và MASTER §8 cấm `flex-wrap` trong `list-row` nên không có đường thoát bằng cách xuống dòng.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd client && yarn test src/components/DocumentRow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/DocumentRow
git commit -m "feat(library): gom hanh dong cua dong tai lieu vao mot menu

Sau nut icon 40px khong vua mot dong o 375px, va MASTER 8 cam flex-wrap trong
list-row nen khong co duong thoat bang cach xuong dong. Dropdown la duong duy
nhat o moi be rong; tu lg them ba nut hay dung nhat canh menu.

Lien quan: MASTER 8 - NFR-A11Y-03"
```

---

### Task 13: Verify trên app thật, E2E, và README

**Files:**
- Modify: `README.md` (qua agent `readme-maintainer`)
- Modify: `docs/04-state/backlog.md`

- [ ] **Step 1: Toàn bộ cổng chất lượng**

Run: `cd client && yarn format && yarn lint && yarn type-check && yarn test && yarn build`
Expected: tất cả xanh. Còn error thì fix hết, không bàn giao.

- [ ] **Step 2: Grep xác nhận không sót**

Run: `cd client && grep -rnE "h-screen|(blue|indigo|slate|zinc|cyan)-[0-9]" src --include=*.tsx --include=*.ts | grep -v __tests__`
Expected: **0 dòng.**

- [ ] **Step 3: E2E ba viewport**

Run: `cd client && yarn test:e2e`
Expected: PASS ở cả ba project `desktop` / `tablet` / `mobile`. Server phải chạy (`:5200` + `:5300`) và `E2E_DATABASE_URL` phải set.

- [ ] **Step 4: Nhìn app thật**

Chạy `yarn dev` ở cả hai side, rồi lái bằng Playwright hoặc chrome-devtools MCP: chụp ở **375 / 768 / 1024 / 1440**, đi qua cả 4 bước Wizard, thử hover / focus / tab / mở modal, và **đổi `prefers-color-scheme` sang dark**. Kiểm riêng ba thứ:
  - Wizard: `Quay lại` / `Tiếp tục` thấy được **ngay khi tải**, không cần cuộn, ở cả ba bề rộng.
  - Step 4 mobile: ba nút header xếp dọc, không có chỗ nào tràn ngang.
  - Font: không nhấp nháy khi hydrate; dấu tiếng Việt render đúng font chứ không rơi về fallback.

**Một UI change chưa nhìn tận mắt thì chưa xong.** Chỗ nào lệch mockup đã duyệt thì nói đích danh trong hội thoại và cập nhật canvas — mockup cũ còn tệ hơn không có mockup.

- [ ] **Step 5: README sync — đây là gate, không phải lời nhắc**

Dispatch agent `readme-maintainer` (`.claude/agents/readme-maintainer.md`) qua Agent tool. Nó chạy ở context riêng và **chỉ** chạm README: đổi hành vi user thấy được ⇒ một bullet ngắn tiếng Anh trong `## Features`; đổi setup/dependency (ba font mới) ⇒ cập nhật section tương ứng của `client/README.md`. Nó tự stage và commit `docs(ui-redesign): update README`.

- [ ] **Step 6: Cập nhật backlog**

`04-state/backlog.md`: chuyển mục "Đang làm" sang xong; ghi vào §Nợ kỹ thuật hai thứ nếu chúng thành sự thật — preload font bị bỏ (Task 1 Step 7) và `ReactNode` trong store `ui` (Task 8 Step 3).

- [ ] **Step 7: Commit và mở PR**

```bash
git add docs/04-state/backlog.md
git commit -m "docs(ui-redesign): dong feature trong backlog"
```

Rồi `superpowers:requesting-code-review` → `superpowers:verification-before-completion` → `superpowers:finishing-a-development-branch`.

---

## Self-review

**Spec coverage:** design.md §2 token → Task 1 · §3 `readout` → Task 3 + 9 · §4 thanh hành động → Task 4, 7, 8 · §5 stepper → Task 5 + 6 · §6 ba sửa a11y → Task 1 (token), 10 (semantic), 11 (faint) · §7 header stack → Task 2 · §8 phạm vi (rule file) → Task 1 Step 9 · §9 rủi ro → Task 13 Step 2–4. Không mục nào không có task.

**Type consistency:** `Readout` props định nghĩa ở Task 3 và dùng đúng tên đó ở Task 9. `Stepper` nhận `onJump`/`blockedFrom` (Task 5) và `Wizard` truyền đúng hai tên đó (Task 6). `AppShell` prop `actionBar` khai ở Task 4, dùng ở Task 8. `THEME.light.lineStrong` khai ở Task 1 và test đọc đúng tên.

**Hai chỗ plan cố ý để mở, và nói rõ tiêu chí chọn:** preload font (Task 1 Step 7 — bỏ nếu Vite hash tên file) và `actionBar` qua store hay qua `_app.tsx` (Task 8 Step 3 — phương án hai nếu `stores.md` cấm cứng). Cả hai đều có nhánh mặc định và đều phải ghi vào backlog nếu chọn nhánh nợ.
