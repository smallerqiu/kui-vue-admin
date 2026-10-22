import { useThemeStore } from "@/stores/theme";
import { computed } from "vue";

/**
 * The waiting state both charts draw for themselves.
 *
 * A chart whose buckets have not arrived yet keeps its box and shows ECharts' own animation inside it,
 * which is the honest version of "the figures are on their way": an empty plot reads as a quiet
 * period. The mask follows the theme because the canvas is drawn on the page's own background.
 */
export function useChartLoading(color: () => string) {
  const themeStore = useThemeStore();
  const isDark = computed(() => themeStore.theme === "dark");
  const loadingOptions = computed(() => ({
    text: "正在取数…",
    color: color(),
    textColor: isDark.value ? "#bfbfbf" : "#8c8c8c",
    maskColor: isDark.value ? "rgba(31, 31, 31, 0.72)" : "rgba(255, 255, 255, 0.72)",
  }));
  return { isDark, loadingOptions };
}
