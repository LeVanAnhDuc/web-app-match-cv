import { StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

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
            colorPrimary: isDark ? "#6366f1" : "#2563eb",
            borderRadius: 8,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }
        }}
      >
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}
