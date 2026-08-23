<template>
  <div class="pro-list-page">
    <PageHeader title="经营分析" description="追踪收入、转化和渠道表现。">
      <template #actions>
        <RadioGroup
          v-model="period"
          theme="card"
          type="button"
          :options="periodOptions"
        />
        <Button :icon="Download">导出报告</Button>
      </template>
    </PageHeader>

    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="16" :y-gap="16">
      <GridItem v-for="item in metrics" :key="item.title"
        ><StatCard :title="item.title" :items="[item.data]" bordered reverse
      /></GridItem>
    </Grid>

    <Grid
      class="analytics-content"
      :cols="{ xs: 1, lg: 12 }"
      :x-gap="16"
      :y-gap="16"
    >
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card title="收入趋势" bordered class="panel-card">
          <template #extra
            ><Tag theme="fill">{{ periodLabel }}</Tag></template
          >
          <TrendChart
            :data="revenueTrend"
            name="收入"
            suffix=" 万"
            color="#7b61ff"
          />
        </Card>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card title="订单渠道" bordered class="panel-card"
          ><DonutChart :data="channelData" unit=" 单"
        /></Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 7 }">
        <Card title="核心转化漏斗" bordered class="panel-card">
          <div class="funnel-list">
            <div
              v-for="(item, index) in funnel"
              :key="item.name"
              class="funnel-item"
            >
              <Flex justify="space-between"
                ><span>{{ item.name }}</span
                ><strong>{{ item.value.toLocaleString() }}</strong></Flex
              >
              <div class="funnel-track">
                <span
                  :style="{ width: `${item.percent}%`, background: item.color }"
                ></span>
              </div>
              <small v-if="index < funnel.length - 1"
                >转化率 {{ funnel[index + 1].rate }}%</small
              >
            </div>
          </div>
        </Card>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 5 }">
        <Card title="访问设备" bordered class="panel-card">
          <div class="device-list">
            <div v-for="device in devices" :key="device.name">
              <span class="device-icon"><Icon :type="device.icon" /></span>
              <div>
                <Flex justify="space-between"
                  ><strong>{{ device.name }}</strong
                  ><span>{{ device.percent }}%</span></Flex
                ><Progress
                  :percent="device.percent"
                  :show-info="false"
                  size="small"
                />
              </div>
            </div>
          </div>
        </Card>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import DonutChart from "@/components/charts/DonutChart.vue";
import TrendChart from "@/components/charts/TrendChart.vue";
import { PageHeader } from "kui-vue";
import { Download, Monitor, Smartphone, Tablet } from "kui-icons";
import type { IconType, StatNumberItem } from "kui-vue";
import { computed, ref } from "vue";

const period = ref("month");
const periodOptions = [
  { label: "近 7 天", value: "week" },
  { label: "近 30 天", value: "month" },
  { label: "本年度", value: "year" },
];
const periodLabel = computed(
  () => periodOptions.find((item) => item.value === period.value)?.label,
);
const metrics: Array<{ title: string; data: StatNumberItem }> = [
  {
    title: "营业收入",
    data: {
      value: 128.6,
      precision: 1,
      prefix: "¥",
      suffix: "万",
      desc: "较上期",
      trend: "+16.8%",
      trendStatus: "success",
    },
  },
  {
    title: "订单转化率",
    data: {
      value: 8.42,
      precision: 2,
      suffix: "%",
      desc: "较上期",
      trend: "+1.26%",
      trendStatus: "success",
    },
  },
  {
    title: "客单价",
    data: {
      value: 1268,
      separator: ",",
      prefix: "¥",
      desc: "较上期",
      trend: "+5.4%",
      trendStatus: "success",
    },
  },
  {
    title: "退款率",
    data: {
      value: 1.86,
      precision: 2,
      suffix: "%",
      desc: "较上期",
      trend: "-0.32%",
      trendStatus: "success",
    },
  },
];
const revenueTrend = [
  { label: "8/17", value: 12.8 },
  { label: "8/18", value: 14.6 },
  { label: "8/19", value: 13.2 },
  { label: "8/20", value: 17.8 },
  { label: "8/21", value: 16.4 },
  { label: "8/22", value: 19.7 },
  { label: "8/23", value: 21.5 },
];
const channelData = [
  { name: "官网", value: 486, color: "#54a9ff" },
  { name: "小程序", value: 328, color: "#7b61ff" },
  { name: "合作渠道", value: 246, color: "#22a06b" },
  { name: "线下", value: 126, color: "#f59e0b" },
];
const funnel = [
  {
    name: "访问用户",
    value: 48260,
    percent: 100,
    rate: 34.2,
    color: "#54a9ff",
  },
  { name: "查看商品", value: 16504, percent: 74, rate: 28.6, color: "#7b61ff" },
  { name: "提交订单", value: 4720, percent: 48, rate: 72.4, color: "#22a06b" },
  { name: "完成支付", value: 3417, percent: 34, rate: 0, color: "#f59e0b" },
];
const devices: Array<{ name: string; percent: number; icon: IconType[] }> = [
  { name: "桌面端", percent: 52, icon: Monitor },
  { name: "移动端", percent: 38, icon: Smartphone },
  { name: "平板", percent: 10, icon: Tablet },
];
</script>

<style scoped lang="less">
.analytics-content {
  margin-top: 16px;
}
.panel-card {
  height: 100%;
  box-sizing: border-box;
}
.funnel-list {
  display: grid;
  gap: 18px;
}
.funnel-item {
  position: relative;
}
.funnel-item small {
  position: absolute;
  right: 0;
  bottom: -16px;
  color: var(--kui-color-text-description);
  font-size: 11px;
}
.funnel-track {
  overflow: hidden;
  height: 9px;
  margin-top: 8px;
  border-radius: var(--kui-shape-circle);
  background: var(--kui-color-bg-component);
}
.funnel-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.device-list {
  display: grid;
  gap: 22px;
}
.device-list > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}
.device-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: var(--kui-color-primary);
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
  font-size: 18px;
}
.device-list strong {
  color: var(--kui-color-text-title);
}
.device-list span {
  color: var(--kui-color-text-description);
}
</style>

<route lang="yaml">
meta:
  title: "经营分析"
  icon: "ChartLine"
  order: 1
</route>
