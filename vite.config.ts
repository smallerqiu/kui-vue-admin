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
      "@": path.resolve(__dirname, "/src"),
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
          if (id.includes("node_modules")) {
            if (id.includes("kui-icons")) return "ui-icons";
            if (id.includes("kui-vue")) return "ui-lib";
            if (id.includes("vue-router") || id.includes("pinia"))
              return "vue-vendor";
            if (id.includes("vue")) return "vue";
            if (id.includes("dayjs")) return "dayjs";
          }
        },
      },
    },
  },
});
