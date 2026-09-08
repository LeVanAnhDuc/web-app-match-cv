import { StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import { THEME } from "#/constants";

function usePrefersDark() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Effect only runs client-side, so `window` is always available here.
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mql.matches);
    const listener = (event: MediaQueryListEvent) => setIsDark(event.matches);
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
            // Phải bằng --color-primary của cùng theme, và colorBorder phải bằng
            // --color-line-strong (không phải --color-line): antd dùng colorBorder cho
            // viền input, và viền input là thứ duy nhất chỉ ra ranh giới control nên
            // phải đạt ≥3:1. Test src/constants/__tests__/theme.test.ts canh cả hai.
            colorPrimary: isDark ? THEME.dark.primary : THEME.light.primary,
            colorBorder: isDark
              ? THEME.dark.lineStrong
              : THEME.light.lineStrong,
            borderRadius: 8,
            fontFamily: THEME.fontFamily
          }
        }}
      >
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
