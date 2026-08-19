import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Serial, like playwright.config.ts and for the same reason. Rendering
    // antd through jsdom is CPU-bound, so parallel files starve each other:
    // form-validation and router specs that pass alone would intermittently
    // fail their waitFor windows. Determinism is worth the extra seconds.
    fileParallelism: false
  }
});
