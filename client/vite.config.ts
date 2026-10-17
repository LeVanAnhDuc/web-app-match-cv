import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 5300 },
  preview: { port: 5300 },
  // Console piping off: with SSR, a server-side warning piped to the browser was piped
  // straight back to the dev server and re-wrapped on every pass, growing the dev log
  // without bound (519 MB in under an hour) and starving the machine of RAM.
  plugins: [
    devtools({ consolePiping: { enabled: false } }),
    tailwindcss(),
    tanstackStart(),
    viteReact()
  ]
});

export default config;
