<template></template>
<script setup lang="ts">
import { useThemeStore } from "@/stores/theme";
import { computed, onMounted } from "vue";
const themeStore = useThemeStore();

const localTheme = computed(() => themeStore.theme);
const monitor = window.matchMedia("(prefers-color-scheme: dark)");
const matchMode = (e: MediaQueryListEvent) => {
  const body = document.documentElement;
  if (e.matches) {
    if (!body.hasAttribute("theme-mode")) {
      body.setAttribute("theme-mode", "dark");
      themeStore.setTheme("dark");
    }
  } else {
    if (body.hasAttribute("theme-mode")) {
      body.removeAttribute("theme-mode");
      themeStore.setTheme("light");
    }
  }
};

monitor.addEventListener("change", matchMode);
onMounted(() => {
  matchMode({ matches: localTheme.value == "dark" } as MediaQueryListEvent);
});
</script>
