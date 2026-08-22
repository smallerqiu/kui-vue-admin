import vue from "@vitejs/plugin-vue";
import path from "path";
// import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import VueRouter from "vue-router/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    VueRouter({
      exclude: ["/system/error"],
      routesFolder: "src/pages", // 自动导入路由
    }),
    vue(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".js", ".jsx", ".tsx", ".json", ".vue"],
  },
  server: {
    port: 7006,
  },
  build: {
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        // codeSplitting: "auto",
        entryFileNames: "js/[name]-[hash].js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.some((name) => name.endsWith(".css"))) {
            return "css/[name]-[hash][extname]";
          }
          if (
            assetInfo.names.some((name) =>
              /\.(png|jpe?g|gif|svg|webp|avif|ico)$/.test(name),
            )
          ) {
            return "img/[name]-[hash][extname]";
          }
          if (
            assetInfo.names.some((name) => /\.(woff2?|eot|ttf|otf)$/.test(name))
          ) {
            return "fonts/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;

          // Match package segments instead of the whole absolute path. The
          // project directory itself contains "kui-vue", so a broad includes
          // check would accidentally put every dependency into ui-lib.
          const packagePath = id.split("/node_modules/").at(-1) || "";
          if (packagePath.startsWith("kui-icons/")) return "ui-icons";
          if (packagePath.startsWith("kui-vue/")) return "ui-lib";
          if (packagePath.startsWith("echarts/") || packagePath.startsWith("vue-echarts/"))
            return "charts";
          if (packagePath.startsWith("vue-router/") || packagePath.startsWith("pinia/"))
            return "vue-vendor";
          if (packagePath.startsWith("vue/") || packagePath.startsWith("@vue/")) return "vue";
          if (packagePath.startsWith("dayjs/")) return "dayjs";
        },
      },
    },
  },
});
