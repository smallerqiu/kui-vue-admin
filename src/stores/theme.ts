import { defineStore } from "pinia";

export type ThemeMode = "light" | "dark";

export const useThemeStore = defineStore("theme", {
  state: () => ({
    theme:
      localStorage.getItem("theme-mode") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"),
  }),
  getters: {
    isDark: (state) => state.theme === "dark",
  },
  actions: {
    setTheme(theme: ThemeMode, persist = true) {
      this.theme = theme;
      if (persist) localStorage.setItem("theme-mode", theme);
    },
  },
});
