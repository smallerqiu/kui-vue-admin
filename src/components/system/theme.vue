<template></template>
<script setup lang="ts">
import { useThemeStore } from "@/stores/theme";
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
const themeStore = useThemeStore();

const localTheme = computed(() => themeStore.theme);
const monitor = window.matchMedia("(prefers-color-scheme: dark)");
const matchMode = (e: MediaQueryListEvent) => {
  if (!localStorage.getItem("theme-mode")) {
    themeStore.setTheme(e.matches ? "dark" : "light", false);
  }
};

onMounted(() => {
  monitor.addEventListener("change", matchMode);
});
onBeforeUnmount(() => monitor.removeEventListener("change", matchMode));
watch(
  localTheme,
  (mode) => document.documentElement.setAttribute("theme-mode", mode),
  { immediate: true },
);
</script>
