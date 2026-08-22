<template>
  <VChart class="trend-chart" :option="option" autoresize />
</template>

<script setup lang="ts">
import { useThemeStore } from "@/stores/theme";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type { LineSeriesOption } from "echarts/charts";
import { computed } from "vue";
import VChart from "vue-echarts";

interface TrendPoint {
  label: string;
  value: number;
}

const props = defineProps<{ data: TrendPoint[] }>();
const themeStore = useThemeStore();

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

type ChartOption = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption>;

const option = computed<ChartOption>(() => {
  const dark = themeStore.theme === "dark";
  const textColor = dark ? "#bfbfbf" : "#8c8c8c";
  const splitColor = dark ? "#333333" : "#e9e9e9";

  return {
    animationDuration: 550,
    grid: { top: 16, right: 12, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: dark ? "#262626" : "#ffffff",
      borderColor: splitColor,
      textStyle: { color: dark ? "#f5f5f5" : "#262626" },
      axisPointer: { type: "line", lineStyle: { color: "#54a9ff", opacity: 0.4 } },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: props.data.map((item) => item.label),
      axisLine: { lineStyle: { color: splitColor } },
      axisTick: { show: false },
      axisLabel: { color: textColor },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: textColor, formatter: (value: number) => `${value}k` },
      splitLine: { lineStyle: { color: splitColor, type: "dashed" } },
    },
    series: [{
      name: "访问量",
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 7,
      showSymbol: false,
      data: props.data.map((item) => item.value),
      lineStyle: { width: 3, color: "#54a9ff" },
      itemStyle: { color: "#54a9ff", borderWidth: 2, borderColor: dark ? "#1f1f1f" : "#ffffff" },
      areaStyle: { color: "rgba(84, 169, 255, 0.18)" },
      emphasis: { focus: "series", scale: 1.2 },
    }],
  };
});
</script>

<style scoped>
.trend-chart {
  width: 100%;
  height: 250px;
}
</style>
