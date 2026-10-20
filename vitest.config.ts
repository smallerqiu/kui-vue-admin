import path from "node:path";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    include: ["tests/**/*.spec.ts"],
    // kui-icons 5 declares "type": "module" while `main` still points at a
    // CommonJS dist file, so Node-side loading fails on the extension alone.
    // Inlining makes Vite pick the ESM build the browser path already uses.
    server: { deps: { inline: ["kui-icons"] } },
  },
});
