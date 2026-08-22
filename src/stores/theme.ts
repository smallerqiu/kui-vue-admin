import { defineStore } from "pinia";

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
    setTheme(theme: string) {
      this.theme = theme;
      localStorage.setItem("theme-mode", theme);
    },
  },
});
