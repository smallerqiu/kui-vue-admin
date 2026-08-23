<template><VChart class="donut-chart" :option="option" autoresize /></template>

<script setup lang="ts">
import { useThemeStore } from "@/stores/theme";
import { PieChart, type PieSeriesOption } from "echarts/charts";
import {
  LegendComponent,
  TooltipComponent,
  type LegendComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { use, type ComposeOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { computed } from "vue";
import VChart from "vue-echarts";

interface DonutItem {
  name: string;
  value: number;
  color?: string;
}
const props = withDefaults(
  defineProps<{ data: DonutItem[]; unit?: string }>(),
  { unit: "%" },
);
const themeStore = useThemeStore();
use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer]);
type ChartOption = ComposeOption<
  PieSeriesOption | LegendComponentOption | TooltipComponentOption
>;

const option = computed<ChartOption>(() => {
  const dark = themeStore.theme === "dark";
  return {
    color: props.data.map((item) => item.color).filter(Boolean) as string[],
    tooltip: {
      trigger: "item",
      formatter: `{b}: {c}${props.unit} ({d}%)`,
      backgroundColor: dark ? "#262626" : "#ffffff",
      borderColor: dark ? "#333333" : "#e9e9e9",
      textStyle: { color: dark ? "#f5f5f5" : "#262626" },
    },
    legend: {
      bottom: 0,
      icon: "circle",
      textStyle: { color: dark ? "#bfbfbf" : "#595959" },
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "43%"],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: {
          borderRadius: 5,
          borderColor: dark ? "#1f1f1f" : "#ffffff",
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 6 },
        data: props.data,
      },
    ],
  };
});
</script>

<style scoped>
.donut-chart {
  width: 100%;
  height: 290px;
}
</style>
